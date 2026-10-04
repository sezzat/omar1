import type { PublicSpace } from "@/lib/catalog/types";
import { localize } from "@/lib/i18n";
import { availabilityFor } from "./availability";
import { newId, randomToken } from "./crypto";
import { db, nextBookingRef, nextInvoiceNumber } from "./db";
import { expireHolds } from "./holds";
import { absoluteLink, queueEmail } from "./mail";
import { CLOSE_HOUR, OPEN_HOUR, spaceBySlug } from "./spaces";
import { addDays, cairoInstant, cairoToday, CANCEL_WINDOW_HOURS, HOLD_MINUTES, isIsoDate } from "./time";
import type {
  BookingRecord, CustomerPackageRecord, CustomerRecord, InvoiceRecord, MeDto, PaymentSessionRecord, UserRecord,
} from "./types";

export type Result<T> = { ok: true; value: T } | { ok: false; status: number; code: string; fields?: Record<string, string>; details?: Record<string, unknown> };
const fail = (status: number, code: string, details?: Record<string, unknown>, fields?: Record<string, string>): Result<never> => ({ ok: false, status, code, details, fields });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });

const DAY_START = "09:00";
const DAY_END = "18:00";
const MAX_OPEN_REQUESTS = 3;

/* ------------------------------------------------------------------ permissions */

export function permissionsFor(user: UserRecord, customer: CustomerRecord): MeDto["permissions"] {
  const blocked = customer.status === "Inactive" || customer.status === "Suspended" || customer.status === "Blacklisted";
  return {
    canBookShortTerm: !blocked,
    canRequestMonthly: !blocked,
    contactUs: blocked,
    needsEmailVerification: !user.emailVerified,
  };
}

/* ------------------------------------------------------------------ times and prices */

export function bookingWindow(b: BookingRecord): { start: Date; end: Date } {
  if (b.startTime && b.date) {
    const start = cairoInstant(b.date, b.startTime);
    return { start, end: new Date(start.getTime() + (b.hours ?? 1) * 3_600_000) };
  }
  if (b.date) return { start: cairoInstant(b.date, DAY_START), end: cairoInstant(b.date, DAY_END) };
  const startDate = b.startDate ?? cairoToday();
  const end = new Date(`${startDate}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + (b.termMonths ?? 1));
  return { start: cairoInstant(startDate), end: cairoInstant(end.toISOString().slice(0, 10)) };
}

export function cancelDeadline(b: BookingRecord): Date {
  return new Date(bookingWindow(b).start.getTime() - CANCEL_WINDOW_HOURS * 3_600_000);
}

const unitPrice = (space: PublicSpace, unit: "hour" | "day" | "month") => space.prices.find((p) => p.unit === unit)?.amount ?? space.fromPrice.amount;

/* ------------------------------------------------------------------ invoices and confirmation */

function createInvoice(booking: BookingRecord, space: PublicSpace, opts: { source: "online" | "package"; amountEgp: number; gatewayRef?: string }): InvoiceRecord {
  const today = cairoToday();
  const name = space.name;
  const detail =
    booking.hours != null
      ? { ar: `${name.ar}، ${booking.hours} ساعة`, en: `${name.en}, ${booking.hours} ${booking.hours === 1 ? "hour" : "hours"}` }
      : { ar: name.ar, en: name.en };
  const invoice: InvoiceRecord = {
    id: newId("inv"), number: nextInvoiceNumber(), customerId: booking.customerId, bookingId: booking.id, description: detail,
    amountEgp: opts.amountEgp, paidEgp: opts.amountEgp, status: "Paid", issueDate: today, dueDate: today, paymentSource: opts.source, gatewayRef: opts.gatewayRef,
  };
  db().invoices.set(invoice.id, invoice);
  return invoice;
}

/** Confirms a booking, creates its Paid invoice (BR-008) and queues the confirmation email. */
function confirm(booking: BookingRecord, space: PublicSpace, opts: { source: "online" | "package"; amountEgp: number; gatewayRef?: string }): InvoiceRecord {
  booking.status = "Confirmed";
  booking.holdExpiresAt = undefined;
  booking.cancelReason = undefined;
  booking.cancelledAt = undefined;
  const invoice = createInvoice(booking, space, opts);
  booking.invoiceId = invoice.id;

  const customer = db().customers.get(booking.customerId);
  const user = [...db().users.values()].find((u) => u.customerId === booking.customerId);
  if (customer && user) {
    queueEmail("booking-confirmed", user.email, user.preferredLanguage, {
      ref: booking.ref,
      space: localize(user.preferredLanguage, space.name),
      when: `${booking.date ?? booking.startDate} ${booking.startTime ?? ""}`.trim() + (booking.hours ? ` (${booking.hours}h)` : ""),
      invoice: invoice.number,
      amount: opts.source === "package" ? "covered by package" : `EGP ${opts.amountEgp}`,
      link: absoluteLink(user.preferredLanguage, `/portal/bookings/${booking.id}`),
    });
  }
  return invoice;
}

/* ------------------------------------------------------------------ packages */

function packageStatus(p: CustomerPackageRecord, today = cairoToday()): "Active" | "Expired" | "Depleted" {
  if (p.validTo < today) return "Expired";
  return p.total - p.reserved - p.consumed <= 0 ? "Depleted" : "Active";
}
export const packageRemaining = (p: CustomerPackageRecord) => p.total - p.reserved - p.consumed;
export { packageStatus };

function findCoveringPackage(customerId: string, kind: PublicSpace["kind"], units: number, onDate: string): CustomerPackageRecord | undefined {
  const today = cairoToday();
  return [...db().packages.values()]
    .filter((p) => p.customerId === customerId && p.appliesTo === kind && p.validFrom <= today && p.validTo >= onDate && packageRemaining(p) >= units)
    .sort((a, b) => a.validTo.localeCompare(b.validTo))[0];
}

/* ------------------------------------------------------------------ Flow A: instant booking */

export interface InstantInput {
  spaceSlug: string;
  date: string;
  startTime?: string;
  hours?: number;
  usePackage?: boolean;
}

function nearestStarts(space: PublicSpace, date: string, hours: number, wanted: number): string[] {
  const a = availabilityFor(space, date);
  if (a.kind !== "hourly") return [];
  const free: number[] = [];
  for (let h = OPEN_HOUR; h + hours <= CLOSE_HOUR; h++) {
    const slots = a.slots.filter((s) => Number(s.start.slice(0, 2)) >= h && Number(s.start.slice(0, 2)) < h + hours);
    if (slots.length === hours && slots.every((s) => s.available)) free.push(h);
  }
  return free.sort((x, y) => Math.abs(x - wanted) - Math.abs(y - wanted)).slice(0, 3).sort((x, y) => x - y).map((h) => `${String(h).padStart(2, "0")}:00`);
}

export function createInstantBooking(user: UserRecord, customer: CustomerRecord, input: InstantInput): Result<BookingRecord> {
  expireHolds();
  if (!permissionsFor(user, customer).canBookShortTerm) return fail(403, "booking_not_allowed");

  const rec = spaceBySlug(String(input.spaceSlug ?? ""));
  if (!rec || !rec.isPublic) return fail(404, "space_not_found");
  const space = rec as PublicSpace;
  if (space.bookingMode !== "instant") return fail(400, "not_instant");

  const today = cairoToday();
  if (!isIsoDate(input.date) || input.date < today || input.date > addDays(today, 365)) return fail(400, "invalid_date");

  const hourly = !space.quantityBased;
  let hours = 1;
  let startTime: string | undefined;
  if (hourly) {
    hours = Number(input.hours);
    const m = /^(\d{2}):00$/.exec(String(input.startTime ?? ""));
    if (!Number.isInteger(hours) || hours < 1 || hours > 4 || !m) return fail(400, "invalid_time");
    const startHour = Number(m[1]);
    if (startHour < OPEN_HOUR || startHour + hours > CLOSE_HOUR) return fail(400, "invalid_time");
    startTime = m[0];
    if (cairoInstant(input.date, startTime).getTime() <= Date.now()) return fail(400, "slot_in_past");

    const a = availabilityFor(space, input.date);
    const needed = a.kind === "hourly" ? a.slots.filter((s) => Number(s.start.slice(0, 2)) >= startHour && Number(s.start.slice(0, 2)) < startHour + hours) : [];
    if (needed.length !== hours || needed.some((s) => !s.available)) {
      return fail(409, "slot_taken", { alternatives: nearestStarts(space, input.date, hours, startHour) });
    }
  } else {
    const a = availabilityFor(space, input.date);
    if (a.kind !== "daily" || a.seatsLeft <= 0) {
      const alternatives: string[] = [];
      for (let i = 1; i <= 7 && alternatives.length < 3; i++) {
        const next = availabilityFor(space, addDays(input.date, i));
        if (next.kind === "daily" && next.seatsLeft > 0) alternatives.push(addDays(input.date, i));
      }
      return fail(409, "slot_taken", { alternatives });
    }
    const dup = [...db().bookings.values()].some(
      (b) => b.customerId === customer.id && b.spaceSlug === space.slug && b.date === input.date && ["Draft", "Confirmed", "Checked-in"].includes(b.status),
    );
    if (dup) return fail(409, "already_booked_that_day");
  }

  const price = space.quantityBased ? unitPrice(space, "day") : unitPrice(space, "hour") * hours;
  const booking: BookingRecord = {
    id: newId("bkg"), ref: nextBookingRef(), customerId: customer.id, spaceSlug: space.slug, kind: space.kind, mode: "instant", status: "Draft",
    date: input.date, startTime, hours: hourly ? hours : undefined, documentIds: [], priceEgp: price,
    holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(), createdAt: new Date().toISOString(), refundRequested: false,
  };
  db().bookings.set(booking.id, booking);

  if (input.usePackage) {
    const units = hourly ? hours : 1;
    const pkg = findCoveringPackage(customer.id, space.kind, units, input.date);
    if (!pkg) {
      db().bookings.delete(booking.id);
      return fail(400, "package_not_applicable");
    }
    pkg.reserved += units;
    booking.packageId = pkg.id;
    booking.packageUnits = units;
    confirm(booking, space, { source: "package", amountEgp: 0 });
  }
  return ok(booking);
}

/* ------------------------------------------------------------------ Flow B: monthly request */

export interface RequestInput {
  spaceSlug: string;
  startDate: string;
  termMonths: number;
  notes?: string;
  documentIds?: string[];
}

export function createRequest(user: UserRecord, customer: CustomerRecord, input: RequestInput): Result<BookingRecord> {
  if (!permissionsFor(user, customer).canRequestMonthly) return fail(403, "booking_not_allowed");
  const rec = spaceBySlug(String(input.spaceSlug ?? ""));
  if (!rec || !rec.isPublic) return fail(404, "space_not_found");
  const space = rec as PublicSpace;
  if (space.bookingMode !== "request") return fail(400, "not_request");

  const today = cairoToday();
  const fields: Record<string, string> = {};
  if (!isIsoDate(input.startDate) || input.startDate < today || input.startDate > addDays(today, 365)) fields.startDate = "invalid";
  if (![3, 6, 12].includes(Number(input.termMonths))) fields.termMonths = "invalid";
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes.length > 1000) fields.notes = "too_long";
  const docIds = Array.isArray(input.documentIds) ? input.documentIds.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
  if (docIds.some((id) => db().documents.get(id)?.customerId !== customer.id)) fields.documentIds = "invalid";
  if (Object.keys(fields).length) return fail(422, "validation", undefined, fields);

  const open = [...db().bookings.values()].filter((b) => b.customerId === customer.id && b.mode === "request" && b.status === "Pending").length;
  if (open >= MAX_OPEN_REQUESTS) return fail(429, "too_many_requests");

  const booking: BookingRecord = {
    id: newId("bkg"), ref: nextBookingRef(), customerId: customer.id, spaceSlug: space.slug, kind: space.kind, mode: "request", status: "Pending",
    startDate: input.startDate, termMonths: Number(input.termMonths), notes: notes || undefined, documentIds: docIds,
    priceEgp: unitPrice(space, "month") * Number(input.termMonths), createdAt: new Date().toISOString(), refundRequested: false,
  };
  db().bookings.set(booking.id, booking);
  // A monthly request moves an Active customer to Pending Approval; it never blocks short-term booking.
  if (customer.status === "Active") customer.status = "Pending Approval";
  queueEmail("request-received", user.email, user.preferredLanguage, {
    ref: booking.ref, space: localize(user.preferredLanguage, space.name), link: absoluteLink(user.preferredLanguage, `/portal/bookings/${booking.id}`),
  });
  return ok(booking);
}

/* ------------------------------------------------------------------ cancellation */

export function cancelBooking(customer: CustomerRecord, id: string): Result<BookingRecord> {
  expireHolds();
  const b = db().bookings.get(id);
  if (!b || b.customerId !== customer.id) return fail(404, "booking_not_found");

  if (b.status === "Draft" || b.status === "Pending") {
    b.status = "Cancelled";
    b.cancelReason = "customer";
    b.cancelledAt = new Date().toISOString();
    b.holdExpiresAt = undefined;
    return ok(b);
  }
  if (b.status !== "Confirmed") return fail(409, "cannot_cancel");

  const deadline = cancelDeadline(b);
  if (Date.now() > deadline.getTime()) return fail(409, "outside_cancel_window", { deadline: deadline.toISOString() });

  b.status = "Cancelled";
  b.cancelReason = "customer";
  b.cancelledAt = new Date().toISOString();
  // FR-PKG-006: the reserved balance returns on a timely cancellation.
  if (b.packageId && b.packageUnits) {
    const pkg = db().packages.get(b.packageId);
    if (pkg) pkg.reserved = Math.max(0, pkg.reserved - b.packageUnits);
  }
  // Refunds are notes only in the BRD: a paid booking creates a refund request and staff refund in the gateway dashboard.
  const invoice = b.invoiceId ? db().invoices.get(b.invoiceId) : undefined;
  if (invoice?.paymentSource === "online" && invoice.paidEgp > 0) b.refundRequested = true;
  return ok(b);
}

/* ------------------------------------------------------------------ hosted checkout (mock gateway) */

const gw = globalThis as unknown as { __fluxGatewayDown?: boolean };
export const setGatewayDown = (down: boolean) => { gw.__fluxGatewayDown = down; };
export const isGatewayDown = () => gw.__fluxGatewayDown === true || process.env.FLUX_MOCK_GATEWAY_DOWN === "1";

export function createCheckout(user: UserRecord, customer: CustomerRecord, bookingId: string): Result<PaymentSessionRecord> {
  expireHolds();
  const b = db().bookings.get(bookingId);
  if (!b || b.customerId !== customer.id) return fail(404, "booking_not_found");
  if (!permissionsFor(user, customer).canBookShortTerm) return fail(403, "booking_not_allowed");
  if (!user.emailVerified) return fail(403, "email_not_verified");
  if (b.status !== "Draft") return fail(409, b.cancelReason === "hold_expired" ? "hold_expired" : "not_payable");
  if (b.priceEgp <= 0) return fail(409, "not_payable");
  // Gateway outage: the booking stays Draft until the hold expires, and nothing is charged.
  if (isGatewayDown()) return fail(503, "gateway_unavailable");

  const existing = [...db().sessions.values()].find((s) => s.bookingId === b.id && s.status === "open");
  if (existing) return ok(existing);
  const session: PaymentSessionRecord = {
    id: newId("cs"), bookingId: b.id, amountEgp: b.priceEgp, gatewayRef: `gw_${randomToken(8)}`, gatewayState: "pending", status: "open",
    createdAt: new Date().toISOString(), expiresAt: b.holdExpiresAt ?? new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(),
  };
  db().sessions.set(session.id, session);
  return ok(session);
}

/* ------------------------------------------------------------------ payment events (webhook) */

export interface PaymentEvent {
  type: "payment.succeeded" | "payment.failed";
  gatewayRef: string;
  sessionId: string;
  amountEgp: number;
}

export type EventOutcome = "processed" | "duplicate" | "ignored";

/** Applies a verified gateway event. Idempotent per gateway reference and event type: gateways retry. */
export function applyPaymentEvent(ev: PaymentEvent): EventOutcome {
  const key = `${ev.type}:${ev.gatewayRef}`;
  if (db().processedGatewayRefs.has(key)) return "duplicate";
  const session = [...db().sessions.values()].find((s) => s.gatewayRef === ev.gatewayRef && s.id === ev.sessionId);
  if (!session) return "ignored";
  db().processedGatewayRefs.add(key);

  if (ev.type === "payment.failed") {
    if (session.status === "open") session.status = "failed";
    return "processed";
  }

  session.status = "paid";
  const booking = db().bookings.get(session.bookingId);
  const space = booking ? (spaceBySlug(booking.spaceSlug) as PublicSpace | undefined) : undefined;
  if (!booking || !space) return "processed";
  const user = [...db().users.values()].find((u) => u.customerId === booking.customerId);
  const review = () => {
    booking.refundRequested = true;
    if (user) queueEmail("payment-review", user.email, user.preferredLanguage, { ref: booking.ref, link: absoluteLink(user.preferredLanguage, `/portal/bookings/${booking.id}`) });
  };

  if (ev.amountEgp !== session.amountEgp) {
    booking.flag = "amount_mismatch";
    review();
    return "processed";
  }
  if (booking.status === "Confirmed" || booking.status === "Checked-in" || booking.status === "Completed") return "processed";

  const heldAlive = booking.status === "Draft" && !!booking.holdExpiresAt && Date.parse(booking.holdExpiresAt) > Date.now();
  const releasedByExpiry = booking.status === "Cancelled" && booking.cancelReason === "hold_expired";
  const stillDraft = booking.status === "Draft";

  if (heldAlive || ((stillDraft || releasedByExpiry) && slotStillFree(space, booking))) {
    confirm(booking, space, { source: "online", amountEgp: session.amountEgp, gatewayRef: session.gatewayRef });
    return "processed";
  }
  // Paid after the hold expired and the slot is gone (or the customer cancelled): never silently double-book.
  booking.status = "Cancelled";
  booking.cancelReason = booking.cancelReason ?? "hold_expired";
  booking.flag = "late_payment_slot_taken";
  review();
  return "processed";
}

function slotStillFree(space: PublicSpace, b: BookingRecord): boolean {
  if (!b.date) return false;
  const a = availabilityFor(space, b.date, b.id);
  if (a.kind === "daily") return a.seatsLeft > 0;
  if (a.kind !== "hourly" || !b.startTime) return false;
  const start = Number(b.startTime.slice(0, 2));
  const need = a.slots.filter((s) => Number(s.start.slice(0, 2)) >= start && Number(s.start.slice(0, 2)) < start + (b.hours ?? 1));
  return need.length === (b.hours ?? 1) && need.every((s) => s.available);
}

/* ------------------------------------------------------------------ reconciliation job */

/** Asks the gateway about open sessions whose webhook never arrived, then confirms or releases them. */
export function reconcile(): { confirmed: number; expired: number; released: number } {
  let confirmed = 0;
  let expired = 0;
  const now = Date.now();
  for (const s of db().sessions.values()) {
    if (s.status !== "open") continue;
    if (s.gatewayState === "paid") {
      if (applyPaymentEvent({ type: "payment.succeeded", gatewayRef: s.gatewayRef, sessionId: s.id, amountEgp: s.amountEgp }) === "processed") confirmed += 1;
    } else if (s.gatewayState === "failed") {
      s.status = "failed";
    } else if (Date.parse(s.expiresAt) <= now) {
      s.status = "expired";
      expired += 1;
    }
  }
  return { confirmed, expired, released: expireHolds() };
}

/* ------------------------------------------------------------------ staff actions (development only) */

export function staffCheckIn(id: string): Result<BookingRecord> {
  const b = db().bookings.get(id);
  if (!b) return fail(404, "booking_not_found");
  if (b.status !== "Confirmed") return fail(409, "cannot_check_in");
  b.status = "Checked-in";
  consumePackage(b);
  return ok(b);
}

export function staffComplete(id: string): Result<BookingRecord> {
  const b = db().bookings.get(id);
  if (!b) return fail(404, "booking_not_found");
  if (b.status !== "Confirmed" && b.status !== "Checked-in") return fail(409, "cannot_complete");
  if (b.status === "Confirmed") consumePackage(b);
  b.status = "Completed";
  return ok(b);
}

/** FR-PKG: the balance is consumed on check-in or completion, whichever comes first. */
function consumePackage(b: BookingRecord): void {
  if (!b.packageId || !b.packageUnits) return;
  const pkg = db().packages.get(b.packageId);
  if (!pkg) return;
  pkg.reserved = Math.max(0, pkg.reserved - b.packageUnits);
  pkg.consumed += b.packageUnits;
}
