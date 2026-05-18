// ─── Order lifecycle FSM ──────────────────────────────────────────────────────
// A small, self-contained finite state machine for order status changes.
//
// Why a separate module?
//   * Transition rules live in ONE place — routes, jobs, and tests all read
//     from the same source of truth.
//   * Pure helpers (canTransition, validateTransition, isStuck) have zero DB
//     dependencies, so they're trivial to unit-test.
//   * DB-touching helpers (transitionOrder, findStuckOrders) take the live
//     drizzle `db` only when they need it, keeping the surface area clean.
//
// Vocabulary note: the existing `orders.current_status` column is a free-text
// `text` field that historically stored values like "Order received" / "In
// transit". This FSM introduces a strict, typed lifecycle vocabulary. Orders
// that don't speak this vocabulary are rejected by transitionOrder() with a
// clear error rather than silently falling through — failing loud is the
// right default for a state machine.

import { and, eq, inArray } from "drizzle-orm";
import {
  db as defaultDb,
  ordersTable,
  trackingEventsTable,
  auditLogsTable,
} from "@workspace/db";
import { generateId } from "./id";

// ─── Vocabulary ──────────────────────────────────────────────────────────────
export const FSM_ORDER_STATUSES = [
  "Created",
  "Confirmed",
  "Processing",
  "Packed",
  "Dispatched",
  "Delivered",
  "Cancelled",
] as const;

export type OrderFsmStatus = (typeof FSM_ORDER_STATUSES)[number];

export const INITIAL_STATUS: OrderFsmStatus = "Created";

export function isFsmStatus(s: string): s is OrderFsmStatus {
  return (FSM_ORDER_STATUSES as readonly string[]).includes(s);
}

// ─── Transition table ────────────────────────────────────────────────────────
// Each key lists the statuses you're allowed to move TO from that key.
//   * The happy path is linear: Created → Confirmed → Processing → Packed
//     → Dispatched → Delivered.
//   * "Cancelled" is reachable from any pre-Dispatched state — once a parcel
//     is on the road we treat cancellation as a different workflow (refund,
//     return, etc.), not a lifecycle transition.
//   * Delivered and Cancelled are terminal — no further transitions.
//
// Re-emitting the same status (e.g. Processing → Processing) is intentionally
// disallowed: it's almost always a duplicate API call, and we'd rather error
// than spam the event log.
export const VALID_TRANSITIONS: Readonly<
  Record<OrderFsmStatus, readonly OrderFsmStatus[]>
> = {
  Created: ["Confirmed", "Cancelled"],
  Confirmed: ["Processing", "Cancelled"],
  Processing: ["Packed", "Cancelled"],
  Packed: ["Dispatched", "Cancelled"],
  Dispatched: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

export function canTransition(
  from: OrderFsmStatus,
  to: OrderFsmStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// Throw-style validator used by transitionOrder(). Returns a structured
// failure rather than throwing so route handlers can map it straight onto an
// HTTP response without try/catch noise.
export type ValidationResult =
  | { ok: true }
  | { ok: false; code: "invalid_transition" | "unknown_status" | "terminal_state"; message: string };

export function validateTransition(
  from: string,
  to: string,
): ValidationResult {
  if (!isFsmStatus(from)) {
    return {
      ok: false,
      code: "unknown_status",
      message: `Order status "${from}" is not part of the lifecycle FSM. Expected one of: ${FSM_ORDER_STATUSES.join(", ")}.`,
    };
  }
  if (!isFsmStatus(to)) {
    return {
      ok: false,
      code: "unknown_status",
      message: `Target status "${to}" is not a valid lifecycle status.`,
    };
  }
  if (VALID_TRANSITIONS[from].length === 0) {
    return {
      ok: false,
      code: "terminal_state",
      message: `Order is already ${from} — no further transitions are allowed.`,
    };
  }
  if (!canTransition(from, to)) {
    const allowed = VALID_TRANSITIONS[from].join(", ") || "none";
    return {
      ok: false,
      code: "invalid_transition",
      message: `Cannot move from ${from} to ${to}. Allowed next steps: ${allowed}.`,
    };
  }
  return { ok: true };
}

// ─── Stuck-order detection ───────────────────────────────────────────────────
// Thresholds beyond which an order in a given state is considered "stuck" and
// likely needs human attention. Statuses not listed have no threshold — we
// only flag the operational states where dwell time signals a problem.
export const STUCK_THRESHOLDS_MS: Partial<Record<OrderFsmStatus, number>> = {
  Created: 24 * 60 * 60 * 1000,
  Processing: 48 * 60 * 60 * 1000,
  Packed: 24 * 60 * 60 * 1000,
  Dispatched: 72 * 60 * 60 * 1000,
};

// Pure helper — given a status and how long the order has been in it, decide
// whether it's stuck. Exposed for tests and for the route handler.
export function isStuck(
  status: string,
  lastUpdatedAt: Date,
  now: Date = new Date(),
): boolean {
  if (!isFsmStatus(status)) return false;
  const threshold = STUCK_THRESHOLDS_MS[status];
  if (threshold === undefined) return false;
  return now.getTime() - lastUpdatedAt.getTime() > threshold;
}

// ─── Core transition function ────────────────────────────────────────────────
export interface TransitionInput {
  orderId: string;
  businessId: string;
  toStatus: OrderFsmStatus;
  updatedBy: string;
  /** Free-text justification, persisted on the event log. */
  reason?: string | null;
}

export interface TransitionSuccess {
  success: true;
  currentStatus: OrderFsmStatus;
  message: string;
  eventId: string;
}

export interface TransitionFailure {
  success: false;
  currentStatus: string | null;
  message: string;
  eventId: null;
  /** Machine-readable failure category, useful for HTTP status mapping. */
  code:
    | "not_found"
    | "invalid_transition"
    | "unknown_status"
    | "terminal_state";
}

export type TransitionResult = TransitionSuccess | TransitionFailure;

/**
 * Move an order to a new status, atomically.
 *
 * Writes are wrapped in a single transaction so the order's `current_status`
 * and the matching event-log row commit (or roll back) together. The audit
 * log is written inside the same transaction — it's part of the same
 * write-or-nothing story.
 *
 * Returns the shape required by the spec: {success, currentStatus, message,
 * eventId}, plus a machine-readable `code` on failures so callers can map
 * cleanly onto HTTP statuses.
 */
export async function transitionOrder(
  input: TransitionInput,
  database: typeof defaultDb = defaultDb,
): Promise<TransitionResult> {
  const { orderId, businessId, toStatus, updatedBy, reason } = input;

  const order = await database.query.ordersTable.findFirst({
    where: and(
      eq(ordersTable.id, orderId),
      eq(ordersTable.businessId, businessId),
    ),
  });

  if (!order) {
    return {
      success: false,
      currentStatus: null,
      message: "Order not found.",
      eventId: null,
      code: "not_found",
    };
  }

  const previousStatus = order.currentStatus;
  const validation = validateTransition(previousStatus, toStatus);
  if (!validation.ok) {
    return {
      success: false,
      currentStatus: previousStatus,
      message: validation.message,
      eventId: null,
      code: validation.code,
    };
  }

  // All writes commit together — partial failures are impossible.
  const eventId = await database.transaction(async (tx) => {
    const newEventId = generateId();

    // The tracking_events table is our event log. The schema doesn't have a
    // dedicated previous_status column (it pre-dates this FSM), so we encode
    // the transition arrow in the human-readable `message` and keep the full
    // typed payload on the audit log below.
    const noteParts = [`${previousStatus} → ${toStatus}`];
    if (reason && reason.trim()) noteParts.push(reason.trim());
    await tx.insert(trackingEventsTable).values({
      id: newEventId,
      orderId,
      status: toStatus,
      message: noteParts.join(" — "),
      createdBy: updatedBy,
    });

    // Defense-in-depth optimistic check: only update if the row is still in
    // the previousStatus we observed above. If another request raced us to
    // the same order, this returns 0 rows and we roll back rather than
    // silently overwriting a newer state.
    const updated = await tx
      .update(ordersTable)
      .set({ currentStatus: toStatus, updatedAt: new Date() })
      .where(
        and(
          eq(ordersTable.id, orderId),
          eq(ordersTable.businessId, businessId),
          eq(ordersTable.currentStatus, previousStatus),
        ),
      )
      .returning({ id: ordersTable.id });

    if (updated.length === 0) {
      throw new ConcurrentTransitionError(orderId);
    }

    // Typed event log — mirrors the user-facing spec (order_id,
    // previous_status, new_status, timestamp, updated_by, reason).
    await tx.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId: updatedBy,
      action: "ORDER_STATUS_TRANSITION",
      entityType: "order",
      entityId: orderId,
      metadata: {
        previousStatus,
        newStatus: toStatus,
        reason: reason?.trim() || null,
        eventId: newEventId,
      },
    });

    return newEventId;
  });

  return {
    success: true,
    currentStatus: toStatus,
    message: `Order moved from ${previousStatus} to ${toStatus}.`,
    eventId,
  };
}

// Thrown inside the transaction when another request beat us to the order.
// Caught at the route boundary so we can return a clean 409 Conflict instead
// of leaking a 500.
export class ConcurrentTransitionError extends Error {
  constructor(public readonly orderId: string) {
    super(`Order ${orderId} was modified by another request`);
    this.name = "ConcurrentTransitionError";
  }
}

// ─── Stuck order query ───────────────────────────────────────────────────────
export interface StuckOrder {
  orderId: string;
  trackingId: string;
  currentStatus: OrderFsmStatus;
  updatedAt: string;
  stuckForMs: number;
  thresholdMs: number;
  /** Pre-formatted human message, e.g. "Stuck in Processing for 62h". */
  reason: string;
}

function formatHours(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  return `${hours}h`;
}

/**
 * Returns all orders for `businessId` whose current_status is one of the
 * watched lifecycle states AND whose updatedAt is older than the configured
 * threshold for that state.
 *
 * Implementation note: we filter the DB-side query down to candidate
 * statuses (the watched set) but do the per-status threshold comparison in
 * application code. The threshold values are small and only 4 statuses are
 * watched, so this is cheaper to read than the SQL CASE alternative — and
 * the candidate set is naturally bounded by the FSM, not by data volume.
 */
export async function findStuckOrders(
  businessId: string,
  now: Date = new Date(),
  database: typeof defaultDb = defaultDb,
): Promise<StuckOrder[]> {
  const watched = Object.keys(STUCK_THRESHOLDS_MS) as OrderFsmStatus[];

  const candidates = await database
    .select({
      id: ordersTable.id,
      trackingId: ordersTable.trackingId,
      currentStatus: ordersTable.currentStatus,
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.businessId, businessId),
        inArray(ordersTable.currentStatus, watched),
      ),
    );

  const stuck: StuckOrder[] = [];
  for (const row of candidates) {
    if (!isFsmStatus(row.currentStatus)) continue;
    const threshold = STUCK_THRESHOLDS_MS[row.currentStatus];
    if (threshold === undefined) continue;
    const stuckForMs = now.getTime() - row.updatedAt.getTime();
    if (stuckForMs <= threshold) continue;
    stuck.push({
      orderId: row.id,
      trackingId: row.trackingId,
      currentStatus: row.currentStatus,
      updatedAt: row.updatedAt.toISOString(),
      stuckForMs,
      thresholdMs: threshold,
      reason: `Stuck in ${row.currentStatus} for ${formatHours(stuckForMs)} (threshold ${formatHours(threshold)}).`,
    });
  }

  // Most-stuck first — operators care about the worst offenders.
  stuck.sort((a, b) => b.stuckForMs - a.stuckForMs);
  return stuck;
}
