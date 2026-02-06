# Nova Landing + Backend (Netlify Functions + Netlify Blobs)

This project started as a static landing page (`site/`). I added a small backend using **Netlify Functions** and **Netlify Blobs** to make the site stateful.

## What the backend adds

- **Site-wide settings** stored server-side (so the Admin panel changes affect all visitors)
  - `GET /api/settings` (public)
  - `PUT /api/settings` (admin-only)
- **Demo orders** (no real payments — just records a checkout attempt)
  - `POST /api/orders` (logged-in user)
  - `GET /api/orders?limit=50` (admin-only)
- **Health check**
  - `GET /api/health`

The frontend pages have been updated to:

- render quickly from local defaults
- then **hydrate from `/api/settings`** when available
- keep a localStorage fallback for development without the backend

## Deploy on Netlify

1. Push this repo to GitHub.
2. Create a new site on Netlify from the repo.
3. Build settings:
   - **Publish directory:** `site`
   - **Functions directory:** `netlify/functions`
   - (already set in `netlify.toml`)
4. Enable **Identity** in your Netlify site settings.
5. (Optional) Make signups invite-only in Identity settings.

### Make yourself an admin

Your Identity user needs the role `admin` in `app_metadata.roles`.

Two options:

- Set `ADMIN_EMAILS` environment variable on Netlify (comma-separated), then sign up with one of those emails:

  - `ADMIN_EMAILS="you@domain.com"`

  The `identity-signup` function will add the `admin` role automatically for matching emails.

- Or manually set a user's role in the Netlify Identity dashboard.

## Local development

You can run the site locally with Netlify Dev:

```bash
npm install
npm run dev
```

Notes:

- The static site runs from `site/`.
- Functions are available under `/.netlify/functions/*` and also `/api/*` (via redirects).
- Netlify Identity works best when the project is linked to a Netlify site.

## Files added

- `netlify/functions/settings.js`
- `netlify/functions/orders.js`
- `netlify/functions/health.js`
- `netlify/functions/identity-signup.js`
- `netlify.toml`
- `package.json`

