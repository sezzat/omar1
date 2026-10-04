import { hashPassword, randomToken } from "./crypto";
import { addDays, cairoToday } from "./time";
import type {
  BookingRecord, CustomerPackageRecord, CustomerRecord, DocumentRecord, InvoiceRecord, OutboxRecord,
  PaymentSessionRecord, UserRecord,
} from "./types";

/**
 * In-memory stand-in for the Phase 1 database (customers, users, bookings, invoices, packages, payments).
 * It lives on globalThis so development reloads keep it, and it resets when the server restarts.
 * Demo accounts (password Flux@2026) are listed in the README.
 */
export interface Db {
  customers: Map<string, CustomerRecord>;
  users: Map<string, UserRecord>;
  bookings: Map<string, BookingRecord>;
  invoices: Map<string, InvoiceRecord>;
  packages: Map<string, CustomerPackageRecord>;
  documents: Map<string, DocumentRecord>;
  sessions: Map<string, PaymentSessionRecord>;
  outbox: OutboxRecord[];
  /** Hashed single-use tokens. */
  verifyTokens: Map<string, { userId: string; expiresAt: number }>;
  resetTokens: Map<string, { userId: string; expiresAt: number }>;
  /** Hashed refresh tokens, with a family id so a replayed token revokes the whole chain. */
  refreshTokens: Map<string, { userId: string; family: string; expiresAt: number; used: boolean }>;
  revokedFamilies: Set<string>;
  /** Gateway references already processed (webhook idempotency). */
  processedGatewayRefs: Set<string>;
  seq: { booking: number; invoice: number };
}

const g = globalThis as unknown as { __fluxDb?: Db };

export function db(): Db {
  return (g.__fluxDb ??= seed());
}

export function nextBookingRef(): string {
  const d = db();
  d.seq.booking += 1;
  return `BKG-${new Date().getUTCFullYear()}-${String(d.seq.booking).padStart(4, "0")}`;
}

export function nextInvoiceNumber(): string {
  const d = db();
  d.seq.invoice += 1;
  return `INV-${new Date().getUTCFullYear()}-${String(d.seq.invoice).padStart(4, "0")}`;
}

export const DEMO_PASSWORD = "Flux@2026";

function seed(): Db {
  const today = cairoToday();
  const now = new Date().toISOString();
  const d: Db = {
    customers: new Map(), users: new Map(), bookings: new Map(), invoices: new Map(), packages: new Map(),
    documents: new Map(), sessions: new Map(), outbox: [], verifyTokens: new Map(), resetTokens: new Map(),
    refreshTokens: new Map(), revokedFamilies: new Set(), processedGatewayRefs: new Set(),
    seq: { booking: 1, invoice: 142 },
  };
  const passwordHash = hashPassword(DEMO_PASSWORD);

  const customer = (c: Partial<CustomerRecord> & Pick<CustomerRecord, "id" | "name" | "email" | "mobile" | "status">): CustomerRecord => {
    const rec: CustomerRecord = { type: "individual", createdAt: now, documentIds: [], ...c };
    d.customers.set(rec.id, rec);
    return rec;
  };
  const user = (id: string, c: CustomerRecord, extra: Partial<UserRecord> = {}) => {
    d.users.set(id, { id, customerId: c.id, email: c.email, mobile: c.mobile, emailVerified: true, passwordHash, preferredLanguage: "ar", createdAt: now, ...extra });
  };

  const mona = customer({ id: "cus_mona", name: "Mona Hassan", email: "mona@example.com", mobile: "+201000000001", status: "Pending Approval" });
  user("usr_mona", mona);
  const nour = customer({ id: "cus_nour", name: "Nour Adel", email: "nour@example.com", mobile: "+201000000002", status: "Active" });
  user("usr_nour", nour, { preferredLanguage: "en" });
  const omar = customer({ id: "cus_omar", name: "Omar Fathy", email: "omar@example.com", mobile: "+201000000003", status: "Suspended" });
  user("usr_omar", omar);
  const sara = customer({ id: "cus_sara", name: "Sara Mostafa", email: "sara@example.com", mobile: "+201000000004", status: "Blacklisted" });
  user("usr_sara", sara);
  const newbie = customer({ id: "cus_newbie", name: "Karim Samir", email: "newbie@example.com", mobile: "+201000000005", status: "Active" });
  user("usr_newbie", newbie, { emailVerified: false });
  // Created by staff in the admin portal, no online login yet: registering with this email links to it after verification.
  customer({ id: "cus_existing", type: "company", name: "Ahmed Gaber", companyName: "Delta Trading Co.", email: "existing@example.com", mobile: "+201000000009", status: "Active" });

  const booking = (b: Partial<BookingRecord> & Pick<BookingRecord, "id" | "customerId" | "spaceSlug" | "kind" | "mode" | "status" | "priceEgp">): BookingRecord => {
    const rec: BookingRecord = {
      ref: `BKG-${new Date().getUTCFullYear()}-${String(d.seq.booking++).padStart(4, "0")}`,
      documentIds: [], createdAt: now, refundRequested: false, ...b,
    };
    d.bookings.set(rec.id, rec);
    return rec;
  };
  const invoice = (i: Partial<InvoiceRecord> & Pick<InvoiceRecord, "id" | "customerId" | "description" | "amountEgp" | "status" | "dueDate">): InvoiceRecord => {
    const rec: InvoiceRecord = { number: `INV-${new Date().getUTCFullYear()}-${String(d.seq.invoice++).padStart(4, "0")}`, paidEgp: 0, issueDate: today, ...i };
    d.invoices.set(rec.id, rec);
    return rec;
  };

  // Mona: paid room booking, paid hot desk, a pending monthly request, a past completed booking.
  const room = booking({ id: "bkg_mona_room", customerId: mona.id, spaceSlug: "meeting-room-a", kind: "meeting-room", mode: "instant", status: "Confirmed", date: addDays(today, 3), startTime: "10:00", hours: 2, priceEgp: 700 });
  const inv1 = invoice({ id: "inv_mona_1", customerId: mona.id, bookingId: room.id, description: { ar: "قاعة الاجتماعات A، ساعتان", en: "Meeting Room A, 2 hours" }, amountEgp: 700, paidEgp: 700, status: "Paid", dueDate: addDays(today, -1), issueDate: addDays(today, -1), paymentSource: "online" });
  room.invoiceId = inv1.id;
  const desk = booking({ id: "bkg_mona_desk", customerId: mona.id, spaceSlug: "hot-desk-zone", kind: "hot-desk", mode: "instant", status: "Confirmed", date: addDays(today, 8), priceEgp: 120 });
  const inv2 = invoice({ id: "inv_mona_2", customerId: mona.id, bookingId: desk.id, description: { ar: "ركن عمل ليوم واحد", en: "Hot desk day pass" }, amountEgp: 120, paidEgp: 120, status: "Paid", dueDate: today, paymentSource: "online" });
  desk.invoiceId = inv2.id;
  booking({ id: "bkg_mona_office", customerId: mona.id, spaceSlug: "private-office-204", kind: "private-office", mode: "request", status: "Pending", startDate: addDays(today, 28), termMonths: 3, priceEgp: 28500, notes: "Team of four, starting next month." });
  const past = booking({ id: "bkg_mona_past", customerId: mona.id, spaceSlug: "meeting-room-b", kind: "meeting-room", mode: "instant", status: "Completed", date: addDays(today, -10), startTime: "11:00", hours: 1, priceEgp: 250 });
  const inv3 = invoice({ id: "inv_mona_3", customerId: mona.id, bookingId: past.id, description: { ar: "قاعة الاجتماعات B، ساعة", en: "Meeting Room B, 1 hour" }, amountEgp: 250, paidEgp: 250, status: "Paid", dueDate: addDays(today, -10), issueDate: addDays(today, -10), paymentSource: "online" });
  past.invoiceId = inv3.id;
  // Outstanding invoices created by staff (deposit and an overdue balance), paid by the existing manual methods.
  invoice({ id: "inv_mona_dep", customerId: mona.id, description: { ar: "عربون المكتب الخاص", en: "Private office deposit" }, amountEgp: 9500, status: "Issued", dueDate: addDays(today, 11) });
  invoice({ id: "inv_mona_over", customerId: mona.id, description: { ar: "رصيد قاعة الاجتماعات", en: "Meeting room balance" }, amountEgp: 700, status: "Overdue", dueDate: addDays(today, -1) });

  d.packages.set("pkg_mona_meeting", {
    id: "pkg_mona_meeting", customerId: mona.id, typeSlug: "meeting-room-10-hours", name: { ar: "باقة 10 ساعات لقاعات الاجتماعات", en: "Meeting room, 10 hours" },
    unit: "hours", appliesTo: "meeting-room", total: 10, reserved: 0, consumed: 4, validFrom: addDays(today, -3), validTo: addDays(today, 57), qrToken: randomToken(8),
  });

  // Nour: Active, one hot-desk package and an issued invoice.
  d.packages.set("pkg_nour_desk", {
    id: "pkg_nour_desk", customerId: nour.id, typeSlug: "hot-desk-10-days", name: { ar: "باقة 10 أيام لركن العمل", en: "Hot desk, 10 days" },
    unit: "days", appliesTo: "hot-desk", total: 10, reserved: 0, consumed: 2, validFrom: addDays(today, -5), validTo: addDays(today, 55), qrToken: randomToken(8),
  });
  invoice({ id: "inv_omar_1", customerId: omar.id, description: { ar: "اشتراك شهري", en: "Monthly subscription" }, amountEgp: 2800, status: "Issued", dueDate: addDays(today, 5) });

  return d;
}
