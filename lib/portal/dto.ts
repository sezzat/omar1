import { permissionsFor, bookingWindow, cancelDeadline, packageRemaining, packageStatus } from "./bookings";
import { db } from "./db";
import { spaceBySlug } from "./spaces";
import { cairoToday } from "./time";
import type {
  BookingDto, BookingRecord, CustomerPackageRecord, CustomerRecord, DashboardDto, DocumentDto, DocumentRecord, InvoiceDto,
  InvoiceRecord, MeDto, PackageBalanceDto, UserRecord,
} from "./types";

export function toMe(user: UserRecord, customer: CustomerRecord): MeDto {
  const pending = [...db().bookings.values()].some((b) => b.customerId === customer.id && b.mode === "request" && b.status === "Pending");
  return {
    user: { id: user.id, email: user.email, emailVerified: user.emailVerified, mobile: user.mobile, preferredLanguage: user.preferredLanguage },
    customer: {
      id: customer.id, type: customer.type, name: customer.name, companyName: customer.companyName,
      // A blacklisted customer must never see that status; the UI shows a neutral "contact us" message instead.
      status: customer.status === "Blacklisted" ? undefined : customer.status,
      hasPendingRequest: pending,
    },
    permissions: permissionsFor(user, customer),
  };
}

export function toBookingDto(b: BookingRecord): BookingDto {
  const space = spaceBySlug(b.spaceSlug);
  const { start, end } = bookingWindow(b);
  const invoice = b.invoiceId ? db().invoices.get(b.invoiceId) : undefined;
  const deadline = cancelDeadline(b);
  const holdAlive = b.status === "Draft" && !!b.holdExpiresAt && Date.parse(b.holdExpiresAt) > Date.now();
  const canCancel = b.status === "Pending" || holdAlive || (b.status === "Confirmed" && Date.now() <= deadline.getTime());
  return {
    id: b.id, ref: b.ref, status: b.status, mode: b.mode, kind: b.kind, spaceSlug: b.spaceSlug,
    spaceName: space?.name ?? { ar: b.spaceSlug, en: b.spaceSlug },
    date: b.date, startTime: b.startTime, hours: b.hours, startDate: b.startDate, termMonths: b.termMonths,
    startsAt: start.toISOString(), endsAt: end.toISOString(), priceEgp: b.priceEgp, holdExpiresAt: b.holdExpiresAt,
    paidByPackage: invoice?.paymentSource === "package", paid: !!invoice && invoice.paymentSource === "online" && invoice.paidEgp > 0,
    invoiceId: b.invoiceId, canCancel, cancelDeadline: b.status === "Confirmed" ? deadline.toISOString() : undefined,
    refundRequested: b.refundRequested, cancelReason: b.cancelReason, review: b.flag ? "payment_review" : undefined,
    notes: b.notes, createdAt: b.createdAt,
  };
}

/** Released holds (never paid) are not shown; late-payment cases stay visible so the customer can see what is happening. */
export const isVisibleBooking = (b: BookingRecord) => !(b.status === "Cancelled" && b.cancelReason === "hold_expired" && !b.flag);

export function toInvoiceDto(i: InvoiceRecord): InvoiceDto {
  const booking = i.bookingId ? db().bookings.get(i.bookingId) : undefined;
  const overdue = (i.status === "Issued" || i.status === "Partially Paid") && i.dueDate < cairoToday();
  return {
    id: i.id, number: i.number, bookingRef: booking?.ref, description: i.description, amountEgp: i.amountEgp, paidEgp: i.paidEgp,
    status: overdue ? "Overdue" : i.status, issueDate: i.issueDate, dueDate: i.dueDate, paymentSource: i.paymentSource,
    vat: { rate: null, amountEgp: null, taxId: null },
  };
}

export function toPackageDto(p: CustomerPackageRecord): PackageBalanceDto {
  return {
    id: p.id, typeSlug: p.typeSlug, name: p.name, unit: p.unit, appliesTo: p.appliesTo, total: p.total, reserved: p.reserved, consumed: p.consumed,
    remaining: packageRemaining(p), validFrom: p.validFrom, validTo: p.validTo, status: packageStatus(p), qrPayload: `FLUX-PKG:${p.id}:${p.qrToken}`,
  };
}

export const toDocumentDto = (d: DocumentRecord): DocumentDto => ({ id: d.id, name: d.name, mime: d.mime, sizeBytes: d.sizeBytes, purpose: d.purpose, uploadedAt: d.uploadedAt });

export function customerBookings(customerId: string): BookingRecord[] {
  return [...db().bookings.values()].filter((b) => b.customerId === customerId && isVisibleBooking(b));
}
export const customerInvoices = (customerId: string) => [...db().invoices.values()].filter((i) => i.customerId === customerId);
export const customerPackages = (customerId: string) => [...db().packages.values()].filter((p) => p.customerId === customerId);

export function toDashboard(customer: CustomerRecord): DashboardDto {
  const now = Date.now();
  const bookings = customerBookings(customer.id);
  const upcoming = bookings
    .filter((b) => (b.status === "Confirmed" || b.status === "Draft") && bookingWindow(b).end.getTime() > now && (b.status !== "Draft" || (b.holdExpiresAt ? Date.parse(b.holdExpiresAt) > now : false)))
    .sort((a, b) => bookingWindow(a).start.getTime() - bookingWindow(b).start.getTime())
    .map(toBookingDto);
  const pendingRequests = bookings.filter((b) => b.status === "Pending").map(toBookingDto);
  const outstandingInvoices = customerInvoices(customer.id)
    .map(toInvoiceDto)
    .filter((i) => i.status === "Issued" || i.status === "Partially Paid" || i.status === "Overdue")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const packages = customerPackages(customer.id).map(toPackageDto).filter((p) => p.status === "Active");
  return { upcoming, pendingRequests, outstandingInvoices, packages };
}
