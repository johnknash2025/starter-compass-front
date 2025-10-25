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
3. No env vars are needed. Hit **Deploy** and the timeline goes live globally.

> Because everything is static + client-managed, the preview/production builds will behave exactly like local dev.

---

## Customization Ideas

- Swap the local persistence with Vercel KV/Blob or your favorite DB
- Replace the trending logic with real analytics from your backend
- Introduce authentication (NextAuth, Clerk, etc.) and multi-user feeds
- Skin the glass panels with your brand colors by tweaking the CSS tokens in `globals.css`

Enjoy shipping ✨
