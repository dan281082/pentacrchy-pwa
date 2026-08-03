# Live order tracking module

**Purpose:** Show delivery progress for a customer's order — order status,
courier, tracking number/link and courier events — from WooCommerce order data
plus the store's tracking source (Royal Mail / shipment-tracking plugin).

**Required App Connector endpoints (PROVISIONAL):**
- `GET /orders/{orderId}/tracking` (ownership-scoped) →
  `{ order_id, order_number, order_status, dispatch_date, courier,
     tracking_number, tracking_url, estimated_delivery, events[] }`.

**Authentication:** Required, and the connector MUST enforce that the order
belongs to the authenticated customer (no horizontal access).

**WooCommerce / plugin dependency:** WooCommerce orders + the active shipment
tracking plugin (tracking meta) and/or Royal Mail tracking URL.

**What remains mocked:** Mock adapter returns EMPTY tracking (no events, null
dates). Estimated delivery is shown ONLY if the courier provides it — never
invented. Provisional sample payload is used for parser tests only.

**Acceptance criteria:**
- No fabricated dispatch/delivery dates or events.
- Tracking link opens the courier's own source.
- One customer can never load another customer's tracking.
