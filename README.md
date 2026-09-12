# ProSight Report Studio

Your own inspection-report software. Next.js + Supabase. You own every file, the database, and the data.

This is the real, self-hosted version — not an artifact. It runs on your Supabase account and your hosting, billed to you, controlled by you.

---

## What you're setting up

| Piece | What it does | Cost |
|-------|--------------|------|
| **Supabase** | Postgres database + photo storage + your login | Free tier is plenty to start |
| **Anthropic API key** | The AI note-rewrite and photo-reading | ~pennies per finding (~$10–25/mo for your volume) |
| **Vercel** (or any host) | Serves the app to your browser | Free tier works |
| **A domain** (optional) | e.g. app.prosightpropertyinspections.com | You already own domains |

You do **not** need any of this to *look* at the code — but you need all of it to run the live app.

---

## Setup — do these in order

### 1. Install the tools (one time)
You already have Node from Talvio. Confirm:
```bash
node -v      # need 18.17+ (20+ ideal)
npm -v
```

### 2. Create your Supabase project
1. Go to https://supabase.com → sign up → **New project**.
2. Name it `prosight`, pick a region near Michigan (e.g. **East US**), set a strong database password (save it).
3. Wait ~2 min for it to provision.
4. In the project: **Project Settings → API**. Copy these two values:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key
5. **Project Settings → API → service_role** key — copy that too (this one is secret, server-only).

### 3. Create the storage bucket for photos
In Supabase: **Storage → New bucket** → name it `inspection-photos` → keep it **Private** → Create.

### 4. Get your Anthropic API key
1. Go to https://console.anthropic.com → **API Keys → Create Key**.
2. Copy it (starts with `sk-ant-`). Save it — you can't see it again.
3. Add a little credit under **Billing** (a few dollars covers a lot of reports).

### 5. Set up the code
```bash
cd prosight-app
npm install
cp .env.example .env.local
```
Open `.env.local` and paste in your five values (from steps 2 and 4):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
```

### 6. Create the database tables
Two ways — pick one:

**Easy way (copy-paste):** open `supabase/migrations/0001_init.sql`, copy all of it, paste into Supabase **SQL Editor → New query → Run**.

**CLI way (if you use the Supabase CLI):**
```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 7. Run it locally
```bash
npm run dev
```
Open http://localhost:3000 — sign up with your email, and you're in. Create a report; it saves to *your* Supabase.

### 8. Deploy it (when ready)
```bash
npm i -g vercel
vercel
```
Follow the prompts, then add the same four env vars in the Vercel dashboard (**Settings → Environment Variables**). Point your domain at it in Vercel → **Domains**.

---

## What's built

- **Dashboard** — your reports, saved to your database, search, progress.
- **New Report intake** — property → rooms → systems (incl. crawlspace) → review → generates the section skeleton.
- **Editor** — open a report, add findings per section, photos, AI rewrite, severity. *(building)*
- **AI** — note-rewrite + photo-reading via your Anthropic key, server-side. *(building)*
- **PDF export** — matches your report layout. *(building)*

## Owning it
Everything is yours: the Postgres database (export anytime), the photos (in your storage bucket), the code (change anything). Nothing is locked to a platform. When you're ready to sell it to other inspectors, this is the codebase that becomes the product — you'd add multi-tenant accounts and billing on top.

## Structure
```
src/
  app/
    page.tsx            dashboard
    report/[id]/        the editor
    api/
      rewrite/          AI note rewrite
      analyze-photo/    AI photo reading
      upload/           photo upload to storage
  lib/                  supabase clients, types, helpers
  components/           UI pieces
supabase/
  migrations/0001_init.sql   database schema
```
