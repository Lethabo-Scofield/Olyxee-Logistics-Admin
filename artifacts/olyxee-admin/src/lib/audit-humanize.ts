// Turns raw audit-log rows into plain-English sentences a non-technical
// operator can skim. Anything we don't recognise falls back to a sensible
// "<Verb> <entity>" so we never show raw SCREAMING_SNAKE codes in the UI.

import { formatDistanceToNow, format } from "date-fns";

type Meta = Record<string, unknown> | null | undefined;

function str(meta: Meta, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function prettyStatus(s: string | undefined): string {
  if (!s) return "—";
  return s
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function shortId(id: string | null | undefined): string {
  if (!id) return "";
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export type AuditTone = "create" | "update" | "email" | "delete" | "neutral";

export interface HumanizedAudit {
  title: string;        // one-line natural sentence
  detail?: string;      // optional extra context (status change, reason, …)
  tone: AuditTone;      // drives the accent colour
}

export function humanizeAudit(log: {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Meta;
}): HumanizedAudit {
  const { action, entityType, entityId, metadata } = log;
  const ref = str(metadata, "trackingId") ?? shortId(entityId);

  switch (action) {
    case "CREATE_ORDER":
      return {
        title: ref ? `New order created — ${ref}` : "New order created",
        tone: "create",
      };

    case "UPDATE_ORDER_STATUS":
    case "ORDER_STATUS_TRANSITION": {
      const prev = prettyStatus(str(metadata, "previousStatus"));
      const next = prettyStatus(str(metadata, "newStatus"));
      const reason = str(metadata, "reason");
      return {
        title: ref
          ? `Order ${ref} moved from ${prev} to ${next}`
          : `Order moved from ${prev} to ${next}`,
        detail: reason,
        tone: "update",
      };
    }

    case "RESEND_EMAIL": {
      const emailStatus = str(metadata, "emailStatus");
      return {
        title: ref ? `Customer email resent for order ${ref}` : "Customer email resent",
        detail:
          emailStatus === "failed"
            ? "Delivery failed"
            : emailStatus === "sent"
              ? "Delivered"
              : undefined,
        tone: "email",
      };
    }

    case "CREATE_CUSTOMER": {
      const name = str(metadata, "fullName") ?? str(metadata, "name");
      return {
        title: name ? `New customer added — ${name}` : "New customer added",
        tone: "create",
      };
    }

    case "UPDATE_CUSTOMER": {
      const name = str(metadata, "fullName") ?? str(metadata, "name");
      return {
        title: name ? `Customer updated — ${name}` : "Customer updated",
        tone: "update",
      };
    }

    case "UPDATE_BUSINESS":
      return { title: "Business settings updated", tone: "update" };

    default: {
      // Generic fallback — turn VERB_NOUN_PHRASE into "Verb noun phrase".
      const verb = action.split("_")[0]?.toLowerCase() ?? "changed";
      const rest = action.split("_").slice(1).join(" ").toLowerCase();
      const sentence = `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${rest || entityType}`.trim();
      const tone: AuditTone = action.startsWith("DELETE")
        ? "delete"
        : action.startsWith("CREATE")
          ? "create"
          : action.startsWith("UPDATE")
            ? "update"
            : "neutral";
      return { title: ref ? `${sentence} — ${ref}` : sentence, tone };
    }
  }
}

export function formatWhen(createdAt: string): { relative: string; absolute: string } {
  const d = new Date(createdAt);
  return {
    relative: formatDistanceToNow(d, { addSuffix: true }),
    absolute: format(d, "MMM d, yyyy · HH:mm"),
  };
}
