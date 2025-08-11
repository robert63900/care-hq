// netlify/functions/daily.js
// Scheduled daily nudge @ 13:00 UTC (~8am CT in summer).
// Requires Netlify Scheduled Functions via netlify.toml config.
import { list, get, blobs } from '@netlify/blobs';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:you@example.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export async function handler(event, context) {
  try {
    const store = blobs();
    const items = await list({ prefix: 'subs/' });
    const promises = items.blobs.map(async (b) => {
      const res = await get(b.key);
      if (!res) return;
      const sub = JSON.parse(await res.text());
      try {
        await webpush.sendNotification(sub, JSON.stringify({
          title: 'Care HQ — Daily Check',
          body: 'Quick scan: any appointments or bills coming up?',
          data: { t: Date.now() }
        }));
      } catch (e) {
        // swallow individual failures
      }
    });
    await Promise.all(promises);
    return { statusCode: 200, body: JSON.stringify({ ok: true, sent: (items.blobs || []).length }) };
  } catch (err) {
    return { statusCode: 500, body: err.message || 'error' };
  }
}
