# Apeps ecosystem — module architecture

The app is built as an extensible ecosystem, not a fixed storefront. New modules
plug in **without restructuring** navigation or state.

## How it works
- **Registry** (`src/modules/registry.ts`) is the single source of truth. Each
  module is a `ModuleDefinition` (`src/modules/types.ts`): id, title, icon, group,
  realm (`customer` | `admin`), status (`available` | `beta` | `planned`),
  `requiresAuth`, `placement` (`account` | `home` | `hub`), and an optional
  `flagKey` / `route`.
- **Feature flags** (`src/config/feature-flags.ts`) turn modules on/off per env
  or via remote config (`setRemoteFlags` from the Apeps App Connector `/config`).
  Env override: `EXPO_PUBLIC_FLAGS="loyalty-dashboard,referral"`.
- **Surfaces** (Account today; Home/hub later) render modules by calling
  `getCustomerModules(placement)` — they never hard-code module lists.
- **Generic host** `app/module/[id].tsx` renders a registered component
  (`src/modules/component-map.tsx`) or a roadmap placeholder if the module is
  still `planned`.

## Add a new module (3 steps)
1. Add an entry to `MODULES` in `registry.ts` (set `status`, `placement`, `flagKey`).
2. Build the screen. Either:
   - register it in `component-map.tsx` (hosted at `/module/<id>`), **or**
   - give it a dedicated `route` and screen file under `app/`.
3. Enable it: set `status: "available"` and turn its `flagKey` on
   (env / remote config). Done — it appears in the relevant surfaces.

## State management convention
Each module owns its own Zustand store at `src/modules/<id>/store.ts`
(persisted via `src/store/persist.ts` if needed) and its own TanStack Query keys
namespaced by module id. This keeps modules self-contained and removable.

## Realms & the Owner/Admin dashboard
`realm: "admin"` modules (e.g. `owner-dashboard`) are **never** rendered in the
customer app (empty `placement`). The admin dashboard must be a **separate app**
with **separate authentication, permissions, MFA, device approval and audit
logging** — do not hide admin features behind the customer app.

## Planned modules (registered, dark by default)
Loyalty dashboard · Reward levels · Refer a friend · Refill Club ·
Authenticity checker (QR) · Product verification · Live order tracking ·
Notification centre · Account security · Learn (educational library) ·
Support assistant · Owner dashboard (admin realm).
