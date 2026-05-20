# Olyxee → Customer Website Tracking Integration Brief

**To:** Olyxee Admin dev team (`logistics.olyxee.com`)
**From:** FreightShift International Logistics (first integrator)

This brief covers what `logistics.olyxee.com` needs to ship so that customer-facing websites can plug a public `/track?code=…` page into Olyxee. Our website (`freightshiftlogistics.co.za`) is **built, deployed, and already calling your API** — it currently shows the empty/error state because the endpoint isn't live yet.

> ⚠️ **Important:** Olyxee is a multi-business platform. Everything below has to work for **every business** in Olyxee, not just FreightShift. The two places this matters most are **tracking-ID generation** (section 1) and **CORS** (section 3). Please don't hard-code anything FreightShift-specific.

---

## What you need to ship

### 1. Per-business tracking-ID generator

Today the platform generates IDs like `OLY-XXX-XXXX`. That works for one tenant but breaks the moment a second business signs up — every customer-facing email goes out branded "OLY-…" regardless of who actually shipped the cargo, and IDs from different businesses are indistinguishable.

**Required change:** the prefix has to come from the business, not the platform.

**Add a setting:** Admin → Settings → Business → **Tracking ID prefix** (3–5 uppercase letters, e.g. `FSL`, `ACME`, `LOG`).

**Required ID format:**
```
{PREFIX}-{3 alphanumerics}-{4 alphanumerics}
```
- `PREFIX` — that business's configured prefix (e.g. `FSL`).
- The two random chunks together must be globally unique across the whole Olyxee install (not just per-business), since the public lookup endpoint is keyed by ID alone.
- Use unambiguous characters only — drop `0/O` and `1/I/L` to avoid customer typos.
- Example: `FSL-7K3-9PQ4`, `ACME-Q42-8H7P`.

**Validation rules:**
- Prefix is required, 3–5 chars, A–Z only, must be unique across all businesses in Olyxee.
- Existing orders keep their old ID — only newly created orders use the new prefix.
- Surface the configured prefix prominently in admin so dispatchers know what their IDs look like.

**FreightShift's prefix:** `FSL`

---

### 2. Public tracking endpoint

```
GET https://logistics.olyxee.com/api/public/track/:trackingId
```

- No authentication.
- `404` if the tracking ID isn't found.
- `200` with the JSON payload below if found.
- Rate limit ~60 req/min/IP. `Cache-Control: public, max-age=30`.
- Works for **any** business's IDs (FSL-…, ACME-…, etc.) since each ID is globally unique.

**Response shape (must match exactly — every customer site will rely on this contract):**

```json
{
  "trackingId": "FSL-7K3-9PQ4",
  "reference": "FSL-2026-0418",
  "origin": "Shenzhen, CN",
  "destination": "Johannesburg, ZA",
  "mode": "sea",
  "estimatedDeliveryDate": "2026-05-22",
  "currentStatus": "out_for_delivery",
  "events": [
    {
      "at": "2026-05-20T07:12:00Z",
      "status": "out_for_delivery",
      "label": "Out for delivery",
      "message": "On the truck for final-mile delivery.",
      "location": "Joburg Hub"
    },
    {
      "at": "2026-05-19T16:40:00Z",
      "status": "in_transit",
      "label": "Released from customs",
      "location": "OR Tambo"
    }
  ]
}
```

**Field rules**

| Field                   | Type     | Required | Notes                                                                 |
| ----------------------- | -------- | -------- | --------------------------------------------------------------------- |
| `trackingId`            | string   | ✅       | Echo back the canonical ID (uppercase, with dashes, with prefix).     |
| `currentStatus`         | enum     | ✅       | One of the status values below.                                       |
| `events[]`              | array    | ✅       | Newest first. Empty array is OK for brand-new orders.                 |
| `events[].at`           | ISO 8601 | ✅       | UTC, e.g. `2026-05-20T07:12:00Z`.                                     |
| `events[].status`       | enum     | ✅       | One of the status values below.                                       |
| `events[].label`        | string   | ✅       | Short human label (e.g. "Out for delivery").                          |
| `events[].message`      | string   | ⛔       | Optional one-line note shown under the label.                         |
| `events[].location`     | string   | ⛔       | Optional, e.g. "OR Tambo".                                            |
| `reference`             | string   | ⛔       | The business's internal order ref.                                    |
| `origin`, `destination` | string   | ⛔       | "City, CC" format preferred.                                          |
| `mode`                  | enum     | ⛔       | `sea` \| `air` \| `road`.                                             |
| `estimatedDeliveryDate` | ISO date | ⛔       | Date only (`YYYY-MM-DD`) or full ISO 8601. Omit if unknown.           |

**Allowed `currentStatus` / `events[].status` values:**

```
pending
picked_up
in_transit
customs
out_for_delivery
delivered
delayed
failed_delivery
returned
cancelled
```

**Do NOT include** in the response (it's a public endpoint, anyone with an ID can hit it):
- Customer email, phone, or address
- Pricing, invoice, or commercial terms
- Internal staff notes
- The owning business's name, internal IDs, or other orders
- Any other orders for the same customer

The customer already knows which business they shipped with — the page lives on that business's own website. Don't leak cross-business data.

---

### 3. CORS — per-business origin allow-list

A single global `ALLOWED_ORIGINS` env var **won't scale**. Every new business onboarding to Olyxee will need their website origin whitelisted, and you don't want to be redeploying the API every time.

**Recommended:** read allowed origins from each business's settings (you already collect "Website URL" — extend it to "Allowed website origins", comma-separated). The CORS middleware then resolves the request's `Origin` against the union of all businesses' allowed origins.

**Minimum acceptable (for launch):** keep `ALLOWED_ORIGINS` env var but make it comma-separated and document how to add new tenants. Add FreightShift's origins now:

```
https://freightshiftlogistics.co.za,https://www.freightshiftlogistics.co.za
```

Without CORS, browsers block the request and the customer's `/track` page shows "Tracking is temporarily unavailable".

> While we're testing on Replit, please also temporarily allow our preview domain — we'll send you the exact URL when ready, and you can drop it once we're on the production domain.

---

### 4. Website URL setting (per business — already exists)

You already have Settings → Business → **Website URL**. Two things to confirm:

- The status-email template uses `{websiteUrl}/track?code={trackingId}` for the tracking button. Confirm this is in place per the integration guide.
- For FreightShift, set Website URL to:
  ```
  https://freightshiftlogistics.co.za
  ```

That ensures every status email FreightShift sends links straight to a working page on our site.

---

## How customers will actually use this

For clarity (and because the customer-side question came up): there's no customer login on the website side. Two flows, both already work on ours and should work for any business that ships a `/track` page:

1. **Automatic** — customer clicks the button in their status email → lands on `https://{business}.com/track?code=FSL-XXX-XXXX` → the page reads `?code=` and fetches immediately. This is the 99% case.
2. **Manual fallback** — customer lost the email, goes to `/track`, pastes the ID into the search box → URL updates to `/track?code=…` and renders the same page.

The tracking ID itself is the auth — anyone with the ID can see that one shipment, nobody else can. That's why a per-business prefix matters: it gives each business a branded, recognisable ID space and prevents accidental cross-business lookups feeling generic.

---

## How to test end-to-end

1. Ship the per-business prefix setting (section 1) and ship the public endpoint (section 2).
2. Add FreightShift's origins to CORS (section 3) and set FreightShift's Website URL to `https://freightshiftlogistics.co.za` (section 4).
3. In Olyxee Admin, set FreightShift's tracking prefix to `FSL`.
4. Create a test order for a FreightShift test customer — the generated ID should be `FSL-XXX-XXXX`.
5. Push the order through a couple of statuses (Pending → Picked up → In transit).
6. Open the email, click the button → should land on `https://freightshiftlogistics.co.za/track?code=FSL-XXX-XXXX` and show the live status and timeline.
7. Sanity-check the payload directly:
   ```bash
   curl -i https://logistics.olyxee.com/api/public/track/FSL-XXX-XXXX
   ```
8. Repeat steps 3–7 with a second test business using a different prefix (e.g. `ACME`) to confirm the multi-tenant path works.

---

## What we've already done on our side

For reference, no action needed from you on these — just so you know the contract we've built against:

- `/track` page is live on `freightshiftlogistics.co.za` (and linked from the main nav).
- It reads `?code=` from the URL on mount and on browser back/forward.
- Manual search input updates the URL so customers can bookmark/share.
- It calls `https://logistics.olyxee.com/api/public/track/:trackingId` directly (configurable via `VITE_OLYXEE_API_BASE` if the URL ever changes).
- States handled: idle, loading, found (with timeline + ETA + "what next"), 404 ("no shipment found"), and network/CORS error ("temporarily unavailable").
- Page is `noindex` so individual tracking pages don't leak into Google.

---

## Quick confirm before you build

A short reply on these would let us close the loop:

- [ ] Confirm the endpoint URL will be exactly `https://logistics.olyxee.com/api/public/track/:trackingId`. If different, send the final URL.
- [ ] Confirm the JSON shape in section 2 matches what you'll return.
- [ ] Confirm the per-business prefix approach (section 1) works for you, or propose an alternative — but it must let FreightShift's IDs look like `FSL-…`, not `OLY-…`.
- [ ] Confirm CORS will be per-business (or at minimum that you'll document how to add new tenants to `ALLOWED_ORIGINS`).
- [ ] Confirm the 10 status values cover everything Olyxee can emit today.

---

## Contact

**FreightShift technical contact:** info@freightshiftlogistics.co.za
**WhatsApp:** +27 68 109 5543
