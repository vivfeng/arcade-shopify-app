export type PaymentStatus = "PAID" | "PENDING" | "REFUNDED";

export type FulfillmentStatus =
  | "UNFULFILLED"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "DELIVERED";

export type OrderRow = {
  id: string;
  orderNumber: string;
  date: string;
  customerName: string;
  productName: string;
  payment: PaymentStatus;
  fulfillment: FulfillmentStatus;
  total: number;
  manufacturer: string;
  eta: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
};
