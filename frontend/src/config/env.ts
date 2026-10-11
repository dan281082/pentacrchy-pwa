// ── Environment configuration ───────────────────────────────────────────────
// All runtime configuration is read from EXPO_PUBLIC_* env vars (see .env /
// .env.example). Nothing here is a secret: only PUBLIC catalogue endpoints and
// display config live in the app. WooCommerce consumer secrets, WP admin creds
// and Firebase server credentials must NEVER be placed in the app bundle.
//
// DATA_SOURCE switches the catalogue layer between realistic local mock data
// and the live read-only WooCommerce Store API — no code changes required.

export type DataSource = "mock" | "live" | "glp";

const str = (v: string | undefined, fallback: string): string =>
  v && v.trim().length > 0 ? v.trim() : fallback;

export const env = {
  appName: str(process.env.EXPO_PUBLIC_APP_NAME, "Pentarchy"),

  // "mock" (local demo data), "live" (direct WooCommerce Store API), or
  // "glp" (the trusted FastAPI proxy -> GLP App Connector on the real store).
  dataSource: (str(process.env.EXPO_PUBLIC_DATA_SOURCE, "mock") as DataSource),

  // Backend proxy base (this app's FastAPI). GLP storefront calls go to
  // {backendUrl}/api/glp/*. The GLP shared secret lives ONLY on the server.
  backendUrl: str(process.env.EXPO_PUBLIC_BACKEND_URL, ""),

  // e.g. https://apeps.co.uk  → Store API at {base}/wp-json/wc/store/v1
  storeApiBaseUrl: str(process.env.EXPO_PUBLIC_STORE_API_BASE_URL, "https://apeps.co.uk"),
  websiteUrl: str(process.env.EXPO_PUBLIC_WEBSITE_URL, "mailto:thepentarchy@proton.me"),
  supportUrl: str(process.env.EXPO_PUBLIC_SUPPORT_URL, "mailto:thepentarchy@proton.me"),
  whatsappUrl: str(process.env.EXPO_PUBLIC_WHATSAPP_URL, ""),

  // Future secure Apeps App Connector (WordPress plugin) base — unused in Phase 1.
  appApiBaseUrl: str(process.env.EXPO_PUBLIC_API_BASE_URL, ""),

  currentVersion: str(process.env.EXPO_PUBLIC_CURRENT_VERSION, "1.0.0"),
  minimumSupportedVersion: str(process.env.EXPO_PUBLIC_MINIMUM_SUPPORTED_VERSION, "1.0.0"),
} as const;

export const storeApiUrl = (path: string): string =>
  `${env.storeApiBaseUrl.replace(/\/$/, "")}/wp-json/wc/store/v1${path}`;

export const isLive = env.dataSource === "live";
