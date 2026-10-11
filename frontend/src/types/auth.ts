// ── Auth domain model ────────────────────────────────────────────────────────
// Shared by the mock and live (Apeps App Connector) auth providers. The app
// treats WordPress/WooCommerce as the source of truth for identity; `approved`
// is ALWAYS server-authoritative (the lock screen is UX only).

export interface AppUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  telegramUsername: string;
  approved: boolean;
  /** Server-authoritative staff fulfilment permission (glp_fulfil_orders). */
  fulfilment?: boolean;
  manage?: boolean;
  members?: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  customer: AppUser;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  telegramUsername: string;
}
