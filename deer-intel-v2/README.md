This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## AI Scout (optional)

The AI Scout page's "Ask AI Scout" section calls a real LLM and needs its own Anthropic API key:

1. Get a key from [console.anthropic.com](https://console.anthropic.com).
2. Copy `.env.local.example` to `.env.local` and paste the key into `ANTHROPIC_API_KEY` (for local dev), or add `ANTHROPIC_API_KEY` under your Vercel project's Environment Variables (for the deployed app).
3. Restart `npm run dev` (or redeploy) after adding the key.

Without a key, that section of the page shows an "isn't turned on yet" message — everything else in the app works normally either way.

## Login & Cloud Sync (optional)

By default Deer Intel saves everything in the browser's local storage — no
account needed. You can optionally turn on **login + cloud sync** (backed by
[Supabase](https://supabase.com)) so a hunter can create an account and keep
their properties, cameras, stands, hunts, photos, and deer profiles synced
across devices.

To enable it:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the project's **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
   This creates the `deer_intel_state` table and row-level security policies so
   each user can only read/write their own data.
3. From **Settings → API**, copy the **Project URL** and **anon/public key**.
4. Put them in `.env.local` (local dev) or your Vercel project's Environment
   Variables (deployed) as `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both are safe to expose to the browser; the
   anon key is protected by the RLS policies. **Never** use the `service_role`
   key here.
5. Restart `npm run dev` (or redeploy).

Once configured, a **Sign In** control appears in the top navigation and a full
**Account & Cloud Sync** panel appears under Settings. How it behaves:

- **First sign-in** reconciles safely — if the cloud is empty it uploads this
  device's data; if this device is empty it downloads the cloud's; if both have
  data the most recently edited wins (no silent data loss for a fresh device).
- **Edits** are pushed to the cloud automatically (debounced), and the app pulls
  newer data when the tab regains focus, so multiple devices stay in sync.
- **Signing out** keeps this device's local data intact; it just stops syncing.

Sign-in options: **GitHub**, email + password, and magic link. Which ones work
depends on what you enable under Supabase **Authentication → Providers**.

For **GitHub** sign-in ("Continue with GitHub"):

1. In Supabase, enable the **GitHub** provider (Authentication → Providers →
   GitHub) — Supabase shows you a **callback URL** there.
2. Create a GitHub OAuth App (GitHub → Settings → Developer settings → OAuth
   Apps) and paste that Supabase callback URL as the **Authorization callback
   URL**. Copy the Client ID/secret back into Supabase.
3. Under Supabase **Authentication → URL Configuration**, set your **Site URL**
   and add your app origins (e.g. `http://localhost:3000` and your deployed
   Vercel URL) to **Redirect URLs**, so the app can be returned to after login.

Without the env vars, none of this UI appears and the app stays fully
local-only.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
