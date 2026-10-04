"use client";

import { useEffect, useState } from "react";
import { usePortal } from "../PortalProvider";
import "../bookings/bookings.css";

/** Package QR code drawn in the browser, with a text fallback of the same code. */
export function QrCode({ payload, name }: { payload: string; name: string }) {
  const { t } = usePortal();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    import("qrcode")
      .then((QR) => QR.toDataURL(payload, { errorCorrectionLevel: "M", margin: 4, width: 176, color: { dark: "#111820", light: "#ffffff" } }))
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [payload]);

  return (
    <div className="bk-qr">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} width={176} height={176} alt={t.home.packages.qrAlt.replace("{name}", name)} />
      ) : (
        <div style={{ width: 176, height: 176 }} aria-hidden="true" />
      )}
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        {failed && <p className="bk-fail" role="alert">{t.home.packages.qrFailed}</p>}
        <p className="muted" style={{ fontSize: 13 }}>{t.home.packages.qrFallback}</p>
        <code className="ltr">{payload}</code>
      </div>
    </div>
  );
}
