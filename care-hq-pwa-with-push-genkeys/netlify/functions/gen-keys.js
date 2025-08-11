// netlify/functions/gen-keys.js
// One-time helper to generate VAPID keys on Netlify so you don't need Node locally.
// Deploy the site, then open: /.netlify/functions/gen-keys
import webpush from 'web-push';

export async function handler() {
  const keys = webpush.generateVAPIDKeys();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keys)
  };
}
