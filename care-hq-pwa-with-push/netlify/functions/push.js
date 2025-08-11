// netlify/functions/push.js
import { blobs } from '@netlify/blobs';
import webpush from 'web-push';

// Expect env vars set in Netlify UI
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:you@example.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { userId, title = 'Care HQ', body = 'Test push', data = {} } = JSON.parse(event.body || '{}');
    if (!userId) return { statusCode: 400, body: 'Missing userId' };
    const store = blobs();
    const sub = await store.get(`subs/${userId}.json`);
    if (!sub) return { statusCode: 404, body: 'No subscription for user' };

    const subscription = JSON.parse(await sub.text());
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, data }));
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: err.message || 'error' };
  }
}
