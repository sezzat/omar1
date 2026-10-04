"use client";

import type { ReactNode, Ref } from "react";
import "./auth.css";

/** Narrow centered card shared by the auth pages: the page h1, optional lead, body and links below. */
export function AuthCard({ title, lead, headingRef, children, links }: {
  title: string; lead?: string; headingRef?: Ref<HTMLHeadingElement>; children: ReactNode; links?: ReactNode;
}) {
  return (
    <div className="auth">
      <div className="auth__card panel">
        <h1 className="auth__title" tabIndex={-1} ref={headingRef}>{title}</h1>
        {lead && <p className="auth__lead">{lead}</p>}
        <div className="auth__body">{children}</div>
        {links && <div className="auth__links">{links}</div>}
      </div>
    </div>
  );
}
