"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import "./intro.css";

const FLAG = "flux-intro";

/**
 * Plays once per browser session. The overlay is server-rendered so the CSS animation starts
 * immediately; the script below only records that it played and lets visitors skip it.
 * An inline script in the root layout sets html[data-intro="skip"] for returning sessions.
 */
export function Intro({ tagline, skip }: { tagline: string; skip: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const node = ref.current;
    const finish = () => {
      root.dataset.intro = "skip";
    };
    try {
      sessionStorage.setItem(FLAG, "1");
    } catch {
      /* storage can be blocked; the intro then replays on next visit */
    }
    const cap = window.setTimeout(finish, 4500);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(cap);
      window.removeEventListener("keydown", onKey);
      // Leaving the home page ends the intro for the rest of the session. A development-only
      // strict-mode remount keeps the node connected, so it does not end the intro early.
      if (!node?.isConnected) finish();
    };
  }, []);

  const finish = () => {
    document.documentElement.dataset.intro = "skip";
  };

  return (
    <div className="intro" ref={ref} onClick={finish}>
      <span className="intro__sweep intro__sweep--deep" aria-hidden="true" />
      <span className="intro__sweep intro__sweep--light" aria-hidden="true" />
      <div className="intro__stack">
        <div className="intro__logo">
          <Image src="/flux-logo.png" alt="Flux Business Hub" width={853} height={492} priority unoptimized />
        </div>
        <p className="intro__tagline">{tagline}</p>
      </div>
      <button type="button" className="btn btn--sm intro__skip" onClick={finish}>
        {skip}
      </button>
    </div>
  );
}
