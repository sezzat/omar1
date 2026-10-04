import Link from "next/link";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

/** The missing page has no language context, so the message is shown in both. */
export default function NotFound() {
  return (
    <div className="wrap page-head">
      <h1 className="h1">{ar.notFound.title}</h1>
      <p className="lead">{ar.notFound.text}</p>
      <Link className="btn" href="/ar">{ar.notFound.home}</Link>
      <h2 className="h2" style={{ marginTop: 32 }} dir="ltr" lang="en">{en.notFound.title}</h2>
      <p className="lead" dir="ltr" lang="en">{en.notFound.text}</p>
      <Link className="btn" href="/en" dir="ltr" lang="en">{en.notFound.home}</Link>
    </div>
  );
}
