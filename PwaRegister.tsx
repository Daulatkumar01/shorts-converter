"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Registers the service worker and surfaces Chrome's install prompt as a real
 * button, so the app installs like a native one.
 */
export default function PwaRegister() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true,
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    const syncOnline = () => setOffline(!navigator.onLine);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    syncOnline();

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {offline && (
        <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[10.5px] font-bold text-amber-200">
          ⚡ Offline mode
        </span>
      )}
      {promptEvent && !installed && (
        <button
          type="button"
          onClick={() => void install()}
          className="btn-glow hover:btn-glow-hover rounded-full px-3.5 py-1.5 text-[11px] font-bold text-white"
        >
          📲 Install app
        </button>
      )}
      {installed && (
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10.5px] font-bold text-emerald-200">
          ✓ App installed
        </span>
      )}
    </div>
  );
}
