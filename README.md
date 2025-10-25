## Pulsewave - Vercel-ready Mini SNS

Pulsewave is a lightweight social feed you can deploy to Vercel in minutes. It is built on **Next.js 15 (App Router)** with zero additional services, so it ships anywhere Vercel can run. All posts are cached locally in the browser via `localStorage`, which keeps the prototype stateful without needing a database.

### Highlights

- Hero section, composer, feed, trends, and insight cards combined in a single page
- Local drafting with character counter, quick inspiration button, and tag parsing
- Reaction buttons (like / boost / reply) with optimistic updates
- Trending tag filters and automatic community insight metrics
- Dark, glassy UI that feels at home on modern Vercel landing pages

---

## Run Locally

```bash
cd starter-compass-front
npm install   # first time only
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and start posting.

### Project Structure

- `src/app/page.tsx` – all Pulsewave UI/logic (client component)
- `src/app/globals.css` – theme, glassmorphism utilities, base tokens
- `src/app/layout.tsx` – metadata + Geist font wiring

Feel free to split components or wire up a real backend/API route as you grow the feature set.

---

## Deploy to Vercel

1. Push this folder to GitHub (or import directly from the CLI).  
2. On [vercel.com/new](https://vercel.com/new) choose the repo, keep the defaults (`build`: `next build`, `install`: `npm install`).  
3. Set the Supabase env vars listed below, then hit **Deploy** to launch the real-time timeline.

> Because everything is static + client-managed, the preview/production builds will behave exactly like local dev.

---

## Connect to Supabase

1. Create a Supabase project and note the `PROJECT_URL` and `SERVICE_ROLE_KEY`.  
2. Run the SQL in [`supabase/schema.sql`](supabase/schema.sql) from the Supabase SQL Editor to create the `posts` table + increment function.  
3. Add the following environment variables (locally via `.env.local`, on Vercel via Project Settings → Environment Variables):

```
SUPABASE_URL=https://pbktwbqlzimtbmonjiul.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# (optionally) SUPABASE_KEY=your-service-role-key  # alias supported in code
GITHUB_ID=github-oauth-client-id
GITHUB_SECRET=github-oauth-client-secret
GOOGLE_CLIENT_ID=google-oauth-client-id
GOOGLE_CLIENT_SECRET=google-oauth-client-secret
NEXTAUTH_SECRET=run `openssl rand -base64 32`
```

> The service role key is only ever used inside Next.js Route Handlers, so it is never exposed to the browser. If you also want client-side Supabase access elsewhere, add `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Once those values are set, Pulsewave stores posts, reactions, and insights in Supabase instead of localStorage. If the env vars are missing, the UI gracefully falls back to local seed data so you can still demo the experience.

---

## Enable GitHub / Google login

Pulsewave now requires a signed-in user to post or react. Set up both OAuth providers plus an Auth secret:

1. **GitHub**: Settings → Developer settings → OAuth Apps → “New OAuth App”  
   - Homepage URL: `https://your-vercel-domain.vercel.app` (or `http://localhost:3000` for dev)  
   - Authorization callback URL: `https://your-vercel-domain.vercel.app/api/auth/callback/github`  
   - Copy the Client ID/Secret into `GITHUB_ID` / `GITHUB_SECRET`.
2. **Google**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → “OAuth client ID” (Web).  
   - Authorized redirect URI: `https://your-vercel-domain.vercel.app/api/auth/callback/google`  
   - Save the Client ID/Secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
3. Generate `NEXTAUTH_SECRET`: `openssl rand -base64 32` (or use any secure random string).
4. Optional: run `./scripts/push-vercel-env.sh` to sync these values to Vercel.

After redeploying, a toolbar + composer prompt users to log in via GitHub or Google, and posts are tied to the authenticated identity. Avatar colors are also deterministic per handle, so the same user always appears with the same gradient.

---

## Sync environment variables to Vercel (optional)

環境変数を手で入力する代わりに、Vercel CLI と付属スクリプトでまとめて反映できます。

```bash
cd starter-compass-front
npm install -g vercel            # まだの場合
vercel login                     # 1度だけ
vercel link                      # プロジェクトと紐付け
./scripts/push-vercel-env.sh     # .env.local → development/preview/production へ同期
```

環境ごとの同期先を変えたい場合は `VERCEL_ENVIRONMENTS=development,production ./scripts/push-vercel-env.sh` のように指定してください。`VERCEL_PROJECT_NAME` を設定すると `vercel link` の検出がうまくいかない環境でも確実に紐付けできます。

---

## Customization Ideas

- Swap the local persistence with Vercel KV/Blob or your favorite DB
- Replace the trending logic with real analytics from your backend
- Introduce authentication (NextAuth, Clerk, etc.) and multi-user feeds
- Skin the glass panels with your brand colors by tweaking the CSS tokens in `globals.css`

Enjoy shipping ✨
