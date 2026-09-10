import { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

// Personal training tracker: admin-gated in proxy.ts, kept out of search.
// Its own manifest so add-to-home-screen installs "Train" opening at /train
// (dark, standalone) instead of the public yoga site.
export const metadata: Metadata = {
  title: "Train",
  robots: { index: false, follow: false },
  manifest: "/train.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0e16",
  // Android: shrink the layout viewport when the keyboard opens so the fixed
  // rest-timer bar stays visible. iOS ignores this (known limitation).
  interactiveWidget: "resizes-content",
};

export default function TrainLayout({ children }: { children: ReactNode }) {
  // Dark, phone-first shell for logging mid-workout. Barlow for text, Anton
  // for numerals.
  return (
    <div
      className="min-h-dvh bg-[#0a0e16] text-neutral-50 selection:bg-cta/40"
      style={{ fontFamily: "var(--font-barlow), system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
