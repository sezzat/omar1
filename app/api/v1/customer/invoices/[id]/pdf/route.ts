import { db } from "@/lib/portal/db";
import { toInvoiceDto } from "@/lib/portal/dto";
import { fail, withCustomer } from "@/lib/portal/http";
import { simplePdf } from "@/lib/portal/pdf";

export const GET = withCustomer<{ id: string }>(({ customer, params }) => {
  const rec = db().invoices.get(params.id);
  if (!rec || rec.customerId !== customer.id) return fail(404, "invoice_not_found");
  const i = toInvoiceDto(rec);
  const pdf = simplePdf([
    { text: "Flux Business Hub", size: 20, bold: true, gap: 6 },
    { text: "El Seyouf, Alexandria", gap: 18 },
    { text: `Invoice ${i.number}`, size: 16, bold: true, gap: 10 },
    { text: `Status: ${i.status}` },
    { text: `Issue date: ${i.issueDate}` },
    { text: `Due date: ${i.dueDate}` },
    { text: `Customer: ${customer.companyName ?? customer.name}`, gap: 10 },
    { text: `Description: ${i.description.en}${i.bookingRef ? ` (${i.bookingRef})` : ""}` },
    { text: `Amount: EGP ${i.amountEgp.toLocaleString("en-US")}` },
    { text: `Paid: EGP ${i.paidEgp.toLocaleString("en-US")}`, gap: 10 },
    { text: "VAT: shown here once tax settings are enabled (Tax-Ready fields only in this phase).", size: 9 },
  ]);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${i.number}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
});
