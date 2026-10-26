# ShortsLab 🎬

**Lambi YouTube video → aesthetic 9:16 Shorts**, copyright-free generative music ke saath — aur ek click me **auto title/description + auto upload**.

---

## ⚡ Chrome me abhi kholo

Preview URL seedha Chrome me paste karo. Bas.

---

## 🌐 Permanent deploy (free)

### Step 1 — Code GitHub par

```bash
git init && git add -A && git commit -m "ShortsLab"
git branch -M main
git remote add origin https://github.com/<user>/shortslab.git
git push -u origin main
```

### Step 2 — Database (free Postgres)

| Provider | Link | Notes |
| --- | --- | --- |
| **Neon** (recommended) | neon.tech | Free tier, connection string copy karo |
| Supabase | supabase.com | Postgres + connection pooling |
| Vercel Postgres | vercel.com/storage | Vercel use karte ho to easiest |

Connection string aisa dikhega:
```
postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require
```

### Step 3 — Vercel par deploy

1. [vercel.com/new](https://vercel.com/new) → GitHub repo **Import**
2. Framework preset: **Next.js** (auto-detect)
3. **Environment Variables** me daalo:

| Key | Value |
| --- | --- |
| `DATABASE_URL` | Step 2 ka connection string |
| `GOOGLE_CLIENT_ID` | Google Cloud se (neeche Step 5) |
| `GOOGLE_CLIENT_SECRET` | Google Cloud se |
| `CREDENTIAL_ENC_KEY` | koi bhi lambi random string (token encryption) |

4. **Deploy** → `https://<project>.vercel.app` mil jayega

### Step 4 — Tables banao

Local terminal se, `DATABASE_URL` remote wala:

```bash
DATABASE_URL="postgresql://..." npx drizzle-kit push
```

Music library (12 tracks) pehli request par auto-seed ho jayegi.

### Step 5 — Google OAuth (upload ke liye)

1. [console.cloud.google.com](https://console.cloud.google.com) → naya project
2. **APIs & Services → Library** → `YouTube Data API v3` → **Enable**
3. **OAuth consent screen**:
   - User type: **External**
   - App name: `ShortsLab`
   - Scopes: `.../auth/youtube.upload` (sirf ye ek)
   - **Test users** me apna Gmail add karo
4. **Credentials → Create credentials → OAuth client ID → Web application**
5. **Authorised redirect URIs** me daalo:

```
https://<project>.vercel.app/api/auth/youtube/callback
```

> ⚠️ Exact match chahiye — trailing slash nahi, `http` vs `https` sahi.

6. Client ID + Secret copy karke Vercel env me daalo → **Redeploy**

### Step 6 — Chrome me install karo (PWA)

Deploy hone ke baad Chrome me site kholo → address bar me **install icon** (⊂) dabao, ya
**⋮ menu → Cast, save and share → Install page as app**.

App alag window me khulega, desktop/phone par icon ban jayega.

---

## 🔑 Railway / Render (Vercel nahi chahiye)

**Railway:** [railway.app/new](https://railway.app/new) → GitHub repo → add **PostgreSQL** plugin
(`railway variables` se `DATABASE_URL` milta hai) → Settings → Generate Domain.

**Render:** [render.com](https://render.com) → New → Web Service (repo) → Build `npm run build`,
Start `npm run start` → add Postgres → env vars same as above.

---

## 🎬 Poora workflow

```
YouTube link → trim + style → music chuno → render.sh se MP4
                                            ↓
        Chrome me Publish tab → MP4 drop → 🚀 auto upload
        (title, description, tags, hashtags sab khud likhe jaate hain)
```

1. **Home** par link paste karo
2. **Studio** me trim (15/30/45/60s), layout, captions, music
3. **Export** tab → `render.sh` + `music.wav` download → `bash render.sh` → MP4
4. **Publish** tab → `✨ Auto-write` → MP4 drop → `🚀 Upload`
5. **`/publish`** → Autopilot se poori series schedule karo

---

## 🛡️ Music copyright

Music koi "library" nahi hai — ek **synth engine** hai (`src/lib/music.ts`). Har track ek
musical DNA (seed + chords + scale + drum pattern) hai jo browser me Web Audio API se
live generate hota hai. **Koi sample, koi recording nahi** → Content ID claim namumkin.

---

## 🧪 Local dev

```bash
npm install
cp .env.example .env       # DATABASE_URL bharo
npx drizzle-kit push
npm run dev                # http://localhost:3000
```

---

## ⚠️ Note on video download

ShortsLab YouTube ka video download nahi karta (ToS). Rendering `render.sh` (yt-dlp + ffmpeg)
se hoti hai, jo aap apne machine par chalate ho. Uske baad upload ek click me automatic hai.
