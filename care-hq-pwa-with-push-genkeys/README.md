# Care HQ (PWA)

Minimal doctor/appointment + billing tracker. Offline-capable PWA, deploy-ready for Netlify.

## Quick start
```bash
npm i
npm run dev
```

## Build
```bash
npm run build
```

## Deploy (Netlify)
- Push to GitHub
- New site from Git -> set build command `npm run build`, publish dir `dist`



## Web Push setup
1. Generate VAPID keys:
   ```bash
   npx web-push generate-vapid-keys
   ```
   Put the public key into `.env` as `VITE_VAPID_PUBLIC_KEY`, and set both keys in Netlify env vars:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - (optional) `VAPID_SUBJECT` like `mailto:you@example.com`

2. Deploy to Netlify. Ensure Functions are enabled (they live in `netlify/functions`).

3. In the app header, click 🔔 Enable Push then 🧪 to send a test. A daily scheduled nudge will also fire around 8am CT.
