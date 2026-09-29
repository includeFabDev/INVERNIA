import { env } from '../config/env.js';

export async function sendTelegramAlert(message) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ALERT_CHAT_ID) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_ALERT_CHAT_ID, text: `INVERNIA: ${message}` }),
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    console.warn('[Telegram] alert delivery failed');
    return false;
  }
}