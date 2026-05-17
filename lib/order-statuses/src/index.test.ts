import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  STATUS_COPY,
  SUGGESTED_MESSAGES,
  isTerminal,
  nextStatuses,
  statusChoices,
  statusCopy,
  suggestedMessages,
} from "./index";

describe("ORDER_STATUSES", () => {
  it("contains the nine canonical statuses", () => {
    expect(ORDER_STATUSES).toEqual([
      "Order received",
      "Processing",
      "Driver assigned",
      "In transit",
      "Delayed",
      "Out for delivery",
      "Delivered",
      "Failed delivery",
      "Cancelled",
    ]);
  });
});

describe("isTerminal", () => {
  it("treats Delivered and Cancelled as terminal", () => {
    expect(isTerminal("Delivered")).toBe(true);
    expect(isTerminal("Cancelled")).toBe(true);
  });

  it("treats every other status as non-terminal", () => {
    for (const s of ORDER_STATUSES) {
      if (s === "Delivered" || s === "Cancelled") continue;
      expect(isTerminal(s), `${s} should not be terminal`).toBe(false);
    }
  });

  it("returns false for unknown statuses (no false-positive lockout)", () => {
    expect(isTerminal("Bogus")).toBe(false);
  });
});

describe("statusChoices", () => {
  it("returns null for terminal statuses", () => {
    expect(statusChoices("Delivered")).toBeNull();
    expect(statusChoices("Cancelled")).toBeNull();
  });

  it("returns null for unknown statuses", () => {
    expect(statusChoices("Bogus")).toBeNull();
  });

  it("recommends Processing after Order received", () => {
    expect(statusChoices("Order received")).toEqual({
      primary: "Processing",
      exceptions: ["Delayed", "Cancelled"],
    });
  });

  it("recommends Delivered as the natural finish of Out for delivery", () => {
    const c = statusChoices("Out for delivery");
    expect(c?.primary).toBe("Delivered");
    expect(c?.exceptions).toContain("Failed delivery");
  });
});

describe("Failed delivery recovery (regression for the recovery-path fix)", () => {
  // Before the fix, Failed delivery only offered Driver assigned / Delayed /
  // Cancelled — which silently removed the "try again today" and "send back
  // to hub" paths admins actually need. Lock that contract in.
  const choices = statusChoices("Failed delivery");

  it("is not a dead end", () => {
    expect(choices).not.toBeNull();
  });

  it("recommends Out for delivery as the same-day retry", () => {
    expect(choices?.primary).toBe("Out for delivery");
  });

  it("exposes the full recovery menu", () => {
    expect(choices?.exceptions).toEqual([
      "Driver assigned",
      "In transit",
      "Delayed",
      "Cancelled",
    ]);
  });

  it("never offers Delivered straight from a failed attempt", () => {
    expect(nextStatuses("Failed delivery")).not.toContain("Delivered");
  });
});

describe("nextStatuses", () => {
  it("returns [] for terminal statuses", () => {
    expect(nextStatuses("Delivered")).toEqual([]);
    expect(nextStatuses("Cancelled")).toEqual([]);
  });

  it("puts the primary first, exceptions after", () => {
    const next = nextStatuses("Order received");
    expect(next[0]).toBe("Processing");
    expect(next.slice(1)).toEqual(["Delayed", "Cancelled"]);
  });

  it("never includes the current status as a next choice", () => {
    for (const s of ORDER_STATUSES) {
      expect(nextStatuses(s), `${s} should not loop back to itself`).not.toContain(s);
    }
  });

  it("never produces duplicates", () => {
    for (const s of ORDER_STATUSES) {
      const n = nextStatuses(s);
      expect(new Set(n).size).toBe(n.length);
    }
  });

  it("only proposes known statuses", () => {
    for (const s of ORDER_STATUSES) {
      for (const n of nextStatuses(s)) {
        expect(ORDER_STATUSES).toContain(n);
      }
    }
  });

  it("every non-terminal status can eventually reach Delivered or Cancelled", () => {
    // BFS — guards against a future edit accidentally creating an island.
    for (const start of ORDER_STATUSES) {
      if (isTerminal(start)) continue;
      const seen = new Set<string>([start]);
      const queue: string[] = [start];
      let reachedTerminal = false;
      while (queue.length) {
        const cur = queue.shift()!;
        if (isTerminal(cur)) {
          reachedTerminal = true;
          break;
        }
        for (const n of nextStatuses(cur)) {
          if (!seen.has(n)) {
            seen.add(n);
            queue.push(n);
          }
        }
      }
      expect(reachedTerminal, `${start} cannot reach a terminal status`).toBe(true);
    }
  });
});

describe("statusCopy", () => {
  it("returns the canonical copy for known statuses", () => {
    expect(statusCopy("Delivered").tone).toBe("positive");
    expect(statusCopy("Failed delivery").tone).toBe("negative");
  });

  it("returns a safe fallback for unknown statuses", () => {
    const c = statusCopy("Bogus");
    expect(c.headline).toContain("Bogus");
    expect(c.tone).toBe("neutral");
  });

  it("has copy for every canonical status", () => {
    for (const s of ORDER_STATUSES) {
      expect(STATUS_COPY[s], `missing copy for ${s}`).toBeDefined();
    }
  });

  it("uses valid 6-digit hex accent colors", () => {
    for (const s of ORDER_STATUSES) {
      expect(STATUS_COPY[s].accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("suggestedMessages", () => {
  it("returns [] for unknown statuses (no crash)", () => {
    expect(suggestedMessages("Bogus")).toEqual([]);
  });

  it("provides at least one suggestion for every non-initial status", () => {
    for (const s of ORDER_STATUSES) {
      if (s === "Order received") continue;
      expect(
        SUGGESTED_MESSAGES[s]?.length ?? 0,
        `expected suggestions for ${s}`,
      ).toBeGreaterThan(0);
    }
  });
});
