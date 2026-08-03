// PROVISIONAL types — tracking data will come from WooCommerce order data plus
// the store's tracking source (Royal Mail / shipment-tracking plugin). This
// module NEVER invents dispatch dates, delivery dates or tracking events.

export interface TrackingEvent {
  id: string;
  status: string;
  description: string;
  timestamp: string; // ISO — only when the courier provides it
  location?: string | null;
}

export interface OrderTracking {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  dispatchDate: string | null; // null unless provided
  courier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDelivery: string | null; // only when the courier provides it
  events: TrackingEvent[]; // empty until real courier events exist
}
