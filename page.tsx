import Link from "next/link";
import { headers } from "next/headers";
import CopyField from "@/components/CopyField";
import { googleCredentials } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chrome par publish kaise kare — ShortsLab",
  description:
    "ShortsLab ko internet par live karo (Vercel / Railway), Google OAuth set karo aur Chrome me app ki tarah install karo.",
};

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pl-12">
      <span className="absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[12px] font-black text-white shadow-[0_6px_20px_-6px_rgba(168,85,247,.9)]">
        {n}
      </span>
      <h3 className="pt-1 text-[13.5px] font-bold">{title}</h3>
      <div className="mt-2 space-y-3 text-[12px] leading-relaxed text-white/60">
        {children}
      </div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-cyan-100/85">
      {children}
    </pre>
  );
}

export default async function DeployPage() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? "http";
  const host =
    h.get("x-forwarded-host")?.split(",")[0] ?? h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;
  const redirectUri = `${origin}/api/auth/youtube/callback`;

  const { configured } = googleCredentials();
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const vercelGuess = "https://your-project.vercel.app";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* header */}
      <header className="relative overflow-hidden rounded-[2rem] border border-white/10 p-6 sm:p-8">
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(30rem 20rem at 15% 0%, rgba(217,70,239,.35), transparent 60%), radial-gradient(26rem 18rem at 90% 20%, rgba(6,182,212,.3), transparent 60%)",
          }}
        />
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-400" />
          Deployment guide
        </span>
        <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          Chrome par <span className="grad-text">publish</span> kaise kare
        </h1>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-white/60">
          Do kaam hain: app ko internet par live karna, aur phir Chrome me app ki
          tarah install karna. Neeche sab step-by-step hai — copy buttons ke saath.
        </p>
      </header>

      {/* A — right now */}
      <section className="glass rounded-3xl p-5 sm:p-6">
        <h2 className="text-sm font-bold">🟢 A · Abhi Chrome me kholo (0 setup)</h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
          Ye preview URL Chrome / kisi bhi browser me paste kar do. Login kuch nahi
          chahiye.
        </p>
        <div className="mt-3">
          <CopyField value={origin} label="Is app ka live URL" />
        </div>
        <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
          <p className="text-[12px] font-bold text-cyan-200">
            📲 Chrome me app ki tarah install karo
          </p>
          <ol className="mt-2 space-y-1 text-[11.5px] leading-relaxed text-cyan-100/75">
            <li>
              1. Chrome me ye URL kholo (Chrome **https** par hona chahiye)
            </li>
            <li>
              2. Address bar ke right side **install icon** (⊕ / ⊂) dabao —{" "}
              <i>Install &quot;ShortsLab&quot;</i>
            </li>
            <li>
              3. Ya: **⋮ menu → Cast, save and share → Install page as app**
            </li>
            <li>
              4. Android Chrome: **⋮ → Add to Home screen**
            </li>
          </ol>
          <p className="mt-2.5 text-[11px] text-cyan-100/55">
            Install hone ke baad alag window me khulega, desktop par icon ban jayega,
            aur app offline bhi shell load karegi.
          </p>
        </div>
      </section>

      {/* B — permanent */}
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">🌐 B · Permanent deploy (free)</h2>
            <p className="mt-1.5 max-w-md text-[12px] leading-relaxed text-white/55">
              Preview URL temporary hota hai. Vercel par free deploy karke apna
              permanent link lo — 5 minute ka kaam hai.
            </p>
          </div>
          <a
            href="https://vercel.com/new"
            target="_blank"
            rel="noreferrer"
            className="btn-glow hover:btn-glow-hover shrink-0 rounded-full px-4 py-2 text-[12px] font-bold text-white"
          >
            vercel.com/new →
          </a>
        </div>

        <div className="mt-6 space-y-7">
          <Step n="1" title="Code GitHub par push karo">
            <Code>{`git init && git add -A && git commit -m "ShortsLab"
git branch -M main
git remote add origin https://github.com/<user>/shortslab.git
git push -u origin main`}</Code>
            <p className="text-[11px] text-white/40">
              GitHub Desktop use karte ho to bas repo banao aur files drag karo.
            </p>
          </Step>

          <Step n="2" title="Free Postgres database banao">
            <p>
              <a
                href="https://neon.tech"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-cyan-300 underline decoration-cyan-400/40"
              >
                neon.tech
              </a>{" "}
              (recommended) ya{" "}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-cyan-300 underline decoration-cyan-400/40"
              >
                supabase.com
              </a>{" "}
              par free project banao → dashboard se connection string copy karo.
            </p>
            <CopyField
              value="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
              label="Connection string aisa dikhega"
            />
          </Step>

          <Step n="3" title="Vercel par import + env vars">
            <p>
              <a
                href="https://vercel.com/new"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-cyan-300 underline decoration-cyan-400/40"
              >
                vercel.com/new
              </a>{" "}
              → apna GitHub repo <b>Import</b> → Framework <b>Next.js</b> (auto) →
              <b> Environment Variables</b> me ye 4 daalo:
            </p>
            <CopyField
              multiline
              label=".env — Vercel me inhe paste karo"
              value={`DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
CREDENTIAL_ENC_KEY=any-long-random-string`}
              hint="CREDENTIAL_ENC_KEY ke liye: openssl rand -hex 32 (ye tokens encrypt karta hai)"
            />
            <p className="text-[11px] text-white/40">
              Google wale 2 keys abhi khali chhod sakte ho — app chalta rahega, sirf
              upload kaam nahi karega. Baad me add karke redeploy kar dena.
            </p>
          </Step>

          <Step n="4" title="Deploy dabao — URL mil jayega">
            <p>
              Deploy hone ke baad URL aisa hoga:{" "}
              <code className="text-cyan-200">{vercelGuess}</code>
            </p>
          </Step>

          <Step n="5" title="Database tables banao">
            <p>Apne local terminal se (repo folder me):</p>
            <Code>{`DATABASE_URL="postgresql://...neon..." npx drizzle-kit push`}</Code>
            <p className="text-[11px] text-white/40">
              12-track music library pehli request par khud seed ho jayegi.
            </p>
          </Step>

          <Step n="6" title="Google OAuth — upload ke liye (ek permission)">
            <ol className="space-y-1.5">
              <li>
                1.{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-cyan-300 underline decoration-cyan-400/40"
                >
                  console.cloud.google.com
                </a>{" "}
                → naya project
              </li>
              <li>
                2. <b>APIs &amp; Services → Library</b> → <b>YouTube Data API v3</b> →{" "}
                <b>Enable</b>
              </li>
              <li>
                3. <b>OAuth consent screen</b> → User type <b>External</b> → App name
                <code className="mx-1 text-cyan-200">ShortsLab</code> →{" "}
                <b>Test users</b> me apna Gmail add karo
              </li>
              <li>
                4. <b>Credentials → Create credentials → OAuth client ID → Web
                application</b>
              </li>
              <li>
                5. <b>Authorised redirect URIs</b> me neeche wala exact value daalo 👇
              </li>
            </ol>

            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
              <p className="text-[11.5px] font-bold text-amber-200">
                {isLocal
                  ? "⚠️ Abhi local URL hai — deploy hone ke baad yahan wapas aao"
                  : "✅ Ye tumhare current domain ka exact redirect URI hai"}
              </p>
              <div className="mt-2.5">
                <CopyField
                  value={redirectUri}
                  label="Authorised redirect URI"
                  hint="Exact match chahiye — trailing slash nahi, https sahi."
                />
              </div>
              {isLocal && (
                <p className="mt-2 text-[10.5px] text-amber-100/60">
                  Deployed hone ke baad pattern:{" "}
                  <code className="text-cyan-200">
                    https://your-project.vercel.app/api/auth/youtube/callback
                  </code>
                </p>
              )}
            </div>

            <p>
              6. Client ID + Secret copy karke Vercel env me daalo →{" "}
              <b>Redeploy</b>. Bas!
            </p>
          </Step>

          <Step n="7" title="Chrome me install karo (ab PWA ready hai)">
            <p>
              Deployed URL Chrome me kholo → address bar ka install icon, ya{" "}
              <b>⋮ → Install page as app</b>. Desktop par icon, phone par home screen.
            </p>
          </Step>
        </div>
      </section>

      {/* status */}
      <section className="glass rounded-3xl p-5 sm:p-6">
        <h2 className="text-sm font-bold">🔍 Is deployment ki status</h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {[
            {
              k: "Database",
              ok: Boolean(process.env.DATABASE_URL),
              yes: "DATABASE_URL set hai",
              no: "DATABASE_URL missing",
            },
            {
              k: "YouTube upload",
              ok: configured,
              yes: "Google keys set hain — upload live",
              no: "Google keys nahi hain — sirf preview chalega",
            },
            {
              k: "HTTPS (PWA install)",
              ok: proto === "https",
              yes: "HTTPS hai — Chrome me install hoga",
              no: "HTTP hai — install ke liye HTTPS chahiye",
            },
            {
              k: "Redirect URI",
              ok: !isLocal,
              yes: "Public domain — OAuth ke liye ready",
              no: "Localhost — Google console me warning dega",
            },
          ].map((row) => (
            <div
              key={row.k}
              className={`flex items-start gap-2.5 rounded-2xl border p-3 ${
                row.ok
                  ? "border-emerald-400/25 bg-emerald-400/5"
                  : "border-amber-400/25 bg-amber-400/5"
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  row.ok
                    ? "bg-emerald-400/25 text-emerald-200"
                    : "bg-amber-400/25 text-amber-200"
                }`}
              >
                {row.ok ? "✓" : "!"}
              </span>
              <div>
                <p className="text-[12px] font-bold">{row.k}</p>
                <p
                  className={`text-[11px] ${
                    row.ok ? "text-emerald-200/70" : "text-amber-200/70"
                  }`}
                >
                  {row.ok ? row.yes : row.no}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10.5px] leading-relaxed text-white/35">
          Google keys set nahi hona koi problem nahi — app ka baaki sab kuch (trim,
          preview, music, metadata, render script) bina keys ke kaam karta hai. Sirf
          upload button ke liye chahiye.
        </p>
      </section>

      {/* alt hosts */}
      <section className="glass rounded-3xl p-5 sm:p-6">
        <h2 className="text-sm font-bold">🚄 Vercel nahi? Alternatives</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[12.5px] font-bold">Railway</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/50">
              railway.app/new → GitHub repo → <b>PostgreSQL</b> plugin add (URL khud
              mil jata hai) → Settings → Generate Domain.
            </p>
            <a
              href="https://railway.app/new"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[11px] font-semibold text-cyan-300/80 hover:text-cyan-200"
            >
              railway.app/new →
            </a>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[12.5px] font-bold">Render</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/50">
              render.com → New → <b>Web Service</b> (repo). Build:{" "}
              <code className="text-cyan-200">npm run build</code>, Start:{" "}
              <code className="text-cyan-200">npm run start</code>. Free Postgres
              add karo.
            </p>
            <a
              href="https://render.com"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[11px] font-semibold text-cyan-300/80 hover:text-cyan-200"
            >
              render.com →
            </a>
          </div>
        </div>
      </section>

      {/* troubleshooting */}
      <section className="glass rounded-3xl p-5 sm:p-6">
        <h2 className="text-sm font-bold">🛠️ Common problems</h2>
        <div className="mt-3 space-y-3 text-[11.5px] leading-relaxed">
          {[
            [
              "redirect_uri_mismatch",
              "Google console me URI bilkul match nahi kar raha. Trailing slash hatao, http/https check karo, aur deploy hone wala exact domain use karo.",
            ],
            [
              "app/access_denied (Error 403: access_denied)",
              "Consent screen Testing mode me hai aur tumhara Gmail test users me nahi hai. Add karo ya app ko Publish karo.",
            ],
            [
              "quotaExceeded",
              "YouTube upload quota (default 6 units/video, 10,000/day) khatam. Kal try karo ya Google se quota increase request karo.",
            ],
            [
              "Install icon nahi dikh raha",
              "HTTPS zaroori hai aur service worker/manifest load hona chahiye. Page hard-refresh karo (Ctrl+Shift+R).",
            ],
            [
              "Database connection fail",
              "DATABASE_URL me ?sslmode=require hai? Neon/Supabase pooled URL use karo. Tables banao: npx drizzle-kit push",
            ],
          ].map(([q, a]) => (
            <details
              key={q}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-3"
            >
              <summary className="cursor-pointer list-none text-[12px] font-bold text-white/80 marker:hidden">
                <span className="mr-1.5 text-white/40 group-open:hidden">▸</span>
                <span className="mr-1.5 hidden text-white/40 group-open:inline">▾</span>
                {q}
              </summary>
              <p className="mt-2 pl-5 text-[11.5px] text-white/55">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3 pb-4">
        <Link
          href="/publish"
          className="btn-glow hover:btn-glow-hover rounded-full px-5 py-2.5 text-[12px] font-bold text-white"
        >
          ← Auto Publish
        </Link>
        <Link
          href="/"
          className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-[12px] font-semibold text-white/80 transition hover:bg-white/10"
        >
          Studio
        </Link>
      </div>
    </div>
  );
}
