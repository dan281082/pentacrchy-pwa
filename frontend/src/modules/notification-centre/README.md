# Notification centre module

**Purpose:** In-app notification inbox (read/unread), notification preferences
(transactional + consented marketing), deep-link routing when a notification is
opened, and a device-registration interface for FCM.

**Required App Connector endpoints (PROVISIONAL):**
- `GET /notifications` → inbox array
- `POST /notifications/{id}/read`
- `GET|POST /notifications/preferences`
- `POST /device/register` (public; associates to the customer when authed) —
  already implemented in the connector.

**Authentication:** Inbox + preferences require sign-in. Device registration is
public (associates to the user when a token is present).

**WooCommerce / plugin dependency:** Firebase Cloud Messaging (client config in
the app; SERVER key stays in the connector). Transactional notifications are
driven by WooCommerce order hooks in the connector.

**What remains mocked:** Inbox returns `[]`; preferences return the safe default
(transactional ON, marketing OFF); mark-read / update / device-register resolve
OK without a backend. No fabricated notifications are shown.

**Acceptance criteria:**
- Marketing notifications require explicit opt-in (off by default).
- Opening a notification deep-links to the correct destination.
- Read/unread reflects server state with safe local optimistic updates.
- Device token, platform, app version and prefs are stored server-side only.
