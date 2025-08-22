// server/utils/telegram.ts
export async function tgSendMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: unknown
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!j?.ok) {
      console.error("[tgSendMessage] telegram error:", j);
    }
  } catch (e) {
    console.error("[tgSendMessage] error:", (e as any)?.message || e);
  } finally {
    clearTimeout(timeout);
  }
}

/** عرّف ADMIN_TELEGRAM_ID بالـ ENV (رقمي) */
export async function notifyAdmin(text: string) {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (adminId) await tgSendMessage(adminId, text);
}