import type { L10n } from "@/lib/i18n";
import type { SpaceKind } from "@/lib/catalog/types";

export type Lang = "ar" | "en";
export type CustomerType = "individual" | "company";
export type CustomerStatus = "Active" | "Inactive" | "Pending Approval" | "Suspended" | "Blacklisted";
export type BookingStatus = "Draft" | "Pending" | "Confirmed" | "Checked-in" | "Completed" | "Cancelled" | "No-show";
export type InvoiceStatus = "Draft" | "Issued" | "Partially Paid" | "Paid" | "Overdue" | "Cancelled";
export type BookingMode = "instant" | "request";

/* ------------------------------------------------------------------ records (server only) */

export interface CustomerRecord {
  id: string;
  type: CustomerType;
  name: string;
  companyName?: string;
  email: string;
  mobile: string;
  status: CustomerStatus;
  createdAt: string;
  documentIds: string[];
}

export interface UserRecord {
  id: string;
  customerId: string;
  email: string;
  mobile: string;
  emailVerified: boolean;
  passwordHash: string;
  preferredLanguage: Lang;
  createdAt: string;
  /** Registered with contact details already on file: no access until the on-file email is verified. */
  linkPending?: boolean;
}

export interface BookingRecord {
  id: string;
  ref: string;
  customerId: string;
  spaceSlug: string;
  kind: SpaceKind;
  mode: BookingMode;
  status: BookingStatus;
  /** Hourly and daily bookings. */
  date?: string;
  startTime?: string;
  hours?: number;
  /** Monthly requests. */
  startDate?: string;
  termMonths?: number;
  notes?: string;
  documentIds: string[];
  priceEgp: number;
  holdExpiresAt?: string;
  packageId?: string;
  packageUnits?: number;
  invoiceId?: string;
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: "customer" | "hold_expired" | "staff";
  refundRequested: boolean;
  /** Set when staff must look at the booking (late payment, amount mismatch). */
  flag?: "late_payment_slot_taken" | "amount_mismatch";
}

export interface InvoiceRecord {
  id: string;
  number: string;
  customerId: string;
  bookingId?: string;
  description: L10n;
  amountEgp: number;
  paidEgp: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paymentSource?: "online" | "package" | "manual";
  gatewayRef?: string;
}

export interface CustomerPackageRecord {
  id: string;
  customerId: string;
  typeSlug: string;
  name: L10n;
  unit: "hours" | "days";
  appliesTo: SpaceKind;
  total: number;
  reserved: number;
  consumed: number;
  validFrom: string;
  validTo: string;
  qrToken: string;
}

export interface DocumentRecord {
  id: string;
  customerId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  purpose: "identity" | "commercial-registration" | "other";
  uploadedAt: string;
  data: Buffer;
}

export interface PaymentSessionRecord {
  id: string;
  bookingId: string;
  amountEgp: number;
  gatewayRef: string;
  /** What the (mock) gateway believes happened. */
  gatewayState: "pending" | "paid" | "failed" | "abandoned";
  /** What Flux has processed. */
  status: "open" | "paid" | "failed" | "expired";
  createdAt: string;
  expiresAt: string;
}

export interface OutboxRecord {
  id: string;
  to: string;
  lang: Lang;
  template: "verify-email" | "reset-password" | "already-registered" | "booking-confirmed" | "request-received" | "payment-review";
  subject: string;
  body: string;
  link?: string;
  status: "queued" | "sent" | "failed";
  attempts: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ DTOs (what the browser sees) */

export interface ApiError {
  error: { code: string; fields?: Record<string, string>; details?: Record<string, unknown> };
}

export interface MeDto {
  user: { id: string; email: string; emailVerified: boolean; mobile: string; preferredLanguage: Lang };
  customer: {
    id: string;
    type: CustomerType;
    name: string;
    companyName?: string;
    /** Omitted for blacklisted customers: they must never see their status. */
    status?: CustomerStatus;
    hasPendingRequest: boolean;
  };
  permissions: {
    canBookShortTerm: boolean;
    canRequestMonthly: boolean;
    /** True when the UI must show the neutral "contact us" message instead of booking. */
    contactUs: boolean;
    /** Email must be verified before the first online payment. */
    needsEmailVerification: boolean;
  };
}

export interface BookingDto {
  id: string;
  ref: string;
  status: BookingStatus;
  mode: BookingMode;
  kind: SpaceKind;
  spaceSlug: string;
  spaceName: L10n;
  date?: string;
  startTime?: string;
  hours?: number;
  startDate?: string;
  termMonths?: number;
  /** ISO instants for sorting and countdowns. */
  startsAt: string;
  endsAt: string;
  priceEgp: number;
  holdExpiresAt?: string;
  paidByPackage: boolean;
  paid: boolean;
  invoiceId?: string;
  canCancel: boolean;
  cancelDeadline?: string;
  refundRequested: boolean;
  cancelReason?: "customer" | "hold_expired" | "staff";
  /** "payment_review": staff are checking a late or mismatched payment. */
  review?: "payment_review";
  notes?: string;
  createdAt: string;
}

export interface InvoiceDto {
  id: string;
  number: string;
  bookingRef?: string;
  description: L10n;
  amountEgp: number;
  paidEgp: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paymentSource?: "online" | "package" | "manual";
  /** Tax-Ready: VAT fields exist but are not computed in this phase. */
  vat: { rate: number | null; amountEgp: number | null; taxId: string | null };
}

export interface PackageBalanceDto {
  id: string;
  typeSlug: string;
  name: L10n;
  unit: "hours" | "days";
  appliesTo: SpaceKind;
  total: number;
  reserved: number;
  consumed: number;
  remaining: number;
  validFrom: string;
  validTo: string;
  status: "Active" | "Expired" | "Depleted";
  /** Text encoded in the reception QR code. */
  qrPayload: string;
}

export interface DocumentDto {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  purpose: DocumentRecord["purpose"];
  uploadedAt: string;
}

export interface DashboardDto {
  upcoming: BookingDto[];
  pendingRequests: BookingDto[];
  outstandingInvoices: InvoiceDto[];
  packages: PackageBalanceDto[];
}

export interface CheckoutDto {
  sessionId: string;
  /** Path (without language) of the hosted checkout page. */
  checkoutPath: string;
  amountEgp: number;
  expiresAt: string;
}

export interface AuthDto {
  accessToken: string;
  /** Seconds. */
  expiresIn: number;
  me: MeDto;
}
