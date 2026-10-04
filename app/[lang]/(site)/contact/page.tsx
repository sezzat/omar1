import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/ContactForm";
import { Icon } from "@/components/Icon";
import { LocalBusinessJsonLd } from "@/components/JsonLd";
import { getMessages, isLocale, localize } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { branch } from "@/lib/site";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getMessages(lang);
  return pageMetadata(lang, "/contact", t.meta.contact.title, t.meta.contact.description);
}

export default async function ContactPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getMessages(lang);

  return (
    <div className="wrap">
      <LocalBusinessJsonLd locale={lang} />
      <div className="page-head">
        <h1 className="h1">{t.contact.title}</h1>
        <p className="lead">{t.contact.lead}</p>
      </div>
      <div className="loc" style={{ paddingBottom: 64 }}>
        <div>
          <div className="map photo photo--sunken" role="img" aria-label={t.contact.mapLabel}>
            <span className="photo__label">{t.contact.mapLabel}</span>
          </div>
          <ul className="facts">
            <li><Icon name="pin" /><div>{localize(lang, branch.address)}<small>{localize(lang, branch.area)}، {localize(lang, branch.city)}</small></div></li>
            <li><Icon name="phone" /><div><span className="ltr">{branch.phone}</span><small>{t.contact.phone}</small></div></li>
            <li><Icon name="mail" /><div><span className="ltr">{branch.email}</span><small>{t.contact.email}</small></div></li>
            <li><Icon name="clock" /><div>{localize(lang, branch.hours)}<small>{t.contact.hours}</small></div></li>
          </ul>
        </div>
        <div className="panel" id="contact-form" style={{ scrollMarginTop: 24 }}>
          <h2>{t.contact.formTitle}</h2>
          <p className="muted">{t.contact.formLead}</p>
          <ContactForm t={t.contact} />
        </div>
      </div>
    </div>
  );
}
