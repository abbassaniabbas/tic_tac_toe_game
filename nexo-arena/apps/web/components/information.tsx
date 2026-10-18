/* eslint-disable @next/next/no-html-link-for-pages -- Document navigation preserves the offline static HTML fallback. */
import type { ReactNode } from "react";
export const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
export function Information({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main id="main-content" className="information container">
      <a href="/" className="text-button">
        ← NEXO Arena
      </a>
      <p className="eyebrow">NEXO ARENA</p>
      <h1>{title}</h1>
      {children}
      <nav aria-label="Information" className="legal-nav">
        <a href="/privacy">Privacy</a>
        <a href="/support">Support</a>
        <a href="/delete-account">Delete account</a>
      </nav>
    </main>
  );
}
export function SupportContact() {
  return supportEmail ? (
    <p>
      Contact the publisher at{" "}
      <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. Please do not
      include sign-in codes or passwords.
    </p>
  ) : (
    <p>
      For additional help, use the publisher contact listed with your
      installation.
    </p>
  );
}
