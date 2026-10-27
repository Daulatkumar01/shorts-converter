import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShortsLab — Long video se Aesthetic Shorts",
  description:
    "Kisi bhi YouTube long video ko 9:16 Shorts me cut karo, copyright-free generative background music add karo, hook captions lagao aur auto-publish karo.",
  applicationName: "ShortsLab",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ShortsLab",
  },
  icons: {
    icon: [
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
  },
  openGraph: {
    title: "ShortsLab — Long video se Aesthetic Shorts",
    description:
      "Trim, copyright-free music, auto title/description aur ek-click YouTube upload.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#07060d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07060d]/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-violet-600 to-cyan-400 text-sm font-black text-white shadow-[0_8px_26px_-8px_rgba(168,85,247,.9)]">
            ▶
            <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/25" />
          </span>
          <span className="text-[15px] font-extrabold tracking-tight">
            Shorts<span className="grad-text">Lab</span>
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 text-[13px] sm:gap-1">
          <Link
            href="/"
            className="rounded-lg px-2.5 py-1.5 text-white/70 transition hover:bg-white/5 hover:text-white sm:px-3"
          >
            Studio
          </Link>
          <Link
            href="/projects"
            className="rounded-lg px-2.5 py-1.5 text-white/70 transition hover:bg-white/5 hover:text-white sm:px-3"
          >
            Shorts
          </Link>
          <Link
            href="/publish"
            className="rounded-lg px-2.5 py-1.5 font-semibold text-emerald-300/90 transition hover:bg-emerald-400/10 hover:text-emerald-200 sm:px-3"
          >
            Publish
          </Link>
          <Link
            href="/deploy"
            className="rounded-lg px-2.5 py-1.5 font-semibold text-cyan-300/90 transition hover:bg-cyan-400/10 hover:text-cyan-200 sm:px-3"
          >
            Deploy
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <Nav />
        <div className="mx-auto flex max-w-7xl items-center justify-end px-4 pt-3 sm:px-6">
          <PwaRegister />
        </div>
        <main className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-white/40 sm:px-6">
          <p>
            ShortsLab · music engine browser me synthesise hota hai (zero samples,
            zero copyright claims) · rendering yt-dlp + ffmpeg script se
          </p>
          <p className="mt-2">
            <Link
              href="/deploy"
              className="font-semibold text-cyan-300/70 transition hover:text-cyan-200"
            >
              Is app ko Chrome / internet par kaise publish kare →
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
