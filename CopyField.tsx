"use client";

import { useState } from "react";

type Props = {
  value: string;
  label?: string;
  multiline?: boolean;
  /** extra chars shown before the copy row */
  hint?: string;
};

export default function CopyField({ value, label, multiline, hint }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for older browsers / non-secure contexts
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* noop */
      }
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <span className="block text-[11px] font-semibold text-white/55">
          {label}
        </span>
      )}
      <div className="flex items-stretch gap-2">
        {multiline ? (
          <textarea
            readOnly
            value={value}
            rows={Math.min(8, value.split("\n").length)}
            onClick={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 resize-y rounded-xl border border-white/12 bg-black/55 px-3 py-2 font-mono text-[11px] leading-relaxed text-cyan-200 outline-none focus:border-cyan-400/60"
          />
        ) : (
          <input
            readOnly
            value={value}
            onClick={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 truncate rounded-xl border border-white/12 bg-black/55 px-3 py-2 font-mono text-[11.5px] text-cyan-200 outline-none focus:border-cyan-400/60"
          />
        )}
        <button
          type="button"
          onClick={() => void copy()}
          className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold transition ${
            copied
              ? "bg-emerald-400/20 text-emerald-200"
              : "border border-white/15 bg-white/5 text-white/75 hover:bg-white/15"
          }`}
        >
          {copied ? "✓ Copied" : "📋 Copy"}
        </button>
      </div>
      {hint && <p className="text-[10.5px] text-white/35">{hint}</p>}
    </div>
  );
}
