// PROVISIONAL types for the notification centre. Server data (inbox +
// preferences) lives in the Apeps App Connector; only local optimistic read
// state lives in the module store.

export type NotificationCategory =
  | "order"
  | "tracking"
  | "restock"
  | "offers"
  | "loyalty"
  | "reorder"
  | "new-products"
  | "security";

export interface NotificationData {
  productId?: number;
  orderId?: number;
  url?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  read: boolean;
  createdAt: string; // ISO
  data?: NotificationData;
}

// Transactional categories default ON; marketing categories default OFF
// (explicit consent required before any marketing notification).
export interface NotificationPreferences {
  orderUpdates: boolean; // transactional
  trackingUpdates: boolean; // transactional
  restocks: boolean; // marketing
  newProducts: boolean; // marketing
  offers: boolean; // marketing
  loyalty: boolean; // marketing
  reorderReminders: boolean; // marketing (customer-controlled, off by default)
}

export interface DeviceRegistration {
  token: string;
  platform: "android" | "ios";
  appVersion: string;
}
