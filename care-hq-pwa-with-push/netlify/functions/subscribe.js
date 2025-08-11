// netlify/functions/subscribe.js
import { blobs } from '@netlify/blobs';

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { userId, subscription } = JSON.parse(event.body || '{}');
    if (!userId || !subscription) {
      return { statusCode: 400, body: 'Missing userId or subscription' };
    }
    const store = blobs();
    // Store one sub per user (overwrite latest)
    await store.set(`subs/${userId}.json`, JSON.stringify(subscription), { contentType: 'application/json' });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: err.message || 'error' };
  }
}
