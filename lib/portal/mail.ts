import { db } from "./db";
import { newId } from "./crypto";
import type { Lang, OutboxRecord } from "./types";
import { siteUrl } from "@/lib/site";

/**
 * Notifications module: transactional email goes through a database outbox so a failing provider never blocks a booking.
 * In this build the "provider" is a stub that marks messages sent and logs them; the outbox is readable in development
 * at /api/v1/dev/outbox. A real Email adapter replaces `deliver`.
 */
type Template = OutboxRecord["template"];

const copy: Record<Template, Record<Lang, (v: Record<string, string>) => { subject: string; body: string }>> = {
  "verify-email": {
    en: (v) => ({ subject: "Verify your email for Flux Business Hub", body: `Hello ${v.name},\n\nConfirm your email address to book and pay online:\n${v.link}\n\nThe link works for 24 hours. If you did not create an account, ignore this message.` }),
    ar: (v) => ({ subject: "أكّد بريدك الإلكتروني في Flux Business Hub", body: `مرحباً ${v.name}،\n\nأكّد بريدك الإلكتروني لتتمكن من الحجز والدفع أونلاين:\n${v.link}\n\nالرابط صالح لمدة 24 ساعة. إذا لم تنشئ حساباً فتجاهل هذه الرسالة.` }),
  },
  "reset-password": {
    en: (v) => ({ subject: "Reset your Flux password", body: `Hello ${v.name},\n\nChoose a new password here:\n${v.link}\n\nThe link works for one hour. If you did not ask for this, ignore this message.` }),
    ar: (v) => ({ subject: "إعادة تعيين كلمة مرور Flux", body: `مرحباً ${v.name}،\n\nاختر كلمة مرور جديدة من هنا:\n${v.link}\n\nالرابط صالح لمدة ساعة. إذا لم تطلب ذلك فتجاهل هذه الرسالة.` }),
  },
  "already-registered": {
    en: () => ({ subject: "You already have a Flux account", body: "Someone tried to register with this email address. You already have an account, so sign in or reset your password if you forgot it." }),
    ar: () => ({ subject: "لديك حساب في Flux بالفعل", body: "حاول شخص ما التسجيل بهذا البريد الإلكتروني. لديك حساب بالفعل، سجّل الدخول أو أعد تعيين كلمة المرور إذا نسيتها." }),
  },
  "booking-confirmed": {
    en: (v) => ({ subject: `Booking ${v.ref} confirmed`, body: `Your booking ${v.ref} for ${v.space} on ${v.when} is confirmed.\nInvoice ${v.invoice}: ${v.amount}.\n\nManage it here: ${v.link}` }),
    ar: (v) => ({ subject: `تم تأكيد الحجز ${v.ref}`, body: `تم تأكيد حجزك ${v.ref} لـ ${v.space} في ${v.when}.\nالفاتورة ${v.invoice}: ${v.amount}.\n\nتابع حجزك من هنا: ${v.link}` }),
  },
  "request-received": {
    en: (v) => ({ subject: `Request ${v.ref} received`, body: `We received your request for ${v.space}. Our team will review it and contact you about the deposit and invoice.\n\nFollow its status: ${v.link}` }),
    ar: (v) => ({ subject: `تم استلام الطلب ${v.ref}`, body: `استلمنا طلبك لـ ${v.space}. سيراجعه فريقنا ويتواصل معك بشأن العربون والفاتورة.\n\nتابع حالة الطلب: ${v.link}` }),
  },
  "payment-review": {
    en: (v) => ({ subject: `We received your payment for ${v.ref}`, body: `Your payment arrived after the held time expired and the slot was no longer free. Our team will contact you and refund you.\n\nBooking: ${v.link}` }),
    ar: (v) => ({ subject: `استلمنا دفعتك للحجز ${v.ref}`, body: `وصلت دفعتك بعد انتهاء مهلة الحجز، وكان الموعد قد حُجز لشخص آخر. سيتواصل معك فريقنا ويسترد لك المبلغ.\n\nالحجز: ${v.link}` }),
  },
};

export function absoluteLink(lang: Lang, path: string): string {
  return `${siteUrl}/${lang}${path}`;
}

function deliver(record: OutboxRecord): void {
  // Stub provider: always succeeds. A failing real provider would leave the record "queued" and a retry job would pick it up.
  record.attempts += 1;
  record.status = "sent";
  console.info(`[mail] ${record.template} to ${record.to}`);
}

export function queueEmail(template: Template, to: string, lang: Lang, vars: Record<string, string>): OutboxRecord {
  const { subject, body } = copy[template][lang](vars);
  const record: OutboxRecord = { id: newId("eml"), to, lang, template, subject, body, link: vars.link, status: "queued", attempts: 0, createdAt: new Date().toISOString() };
  db().outbox.push(record);
  try {
    deliver(record);
  } catch {
    record.status = "failed";
  }
  return record;
}
