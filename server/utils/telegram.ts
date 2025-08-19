// server/utils/telegram.ts
export async function tgSendMessage(chatId: string | number, text: string, replyMarkup?: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(body) });
    await r.json(); // optional check
  } catch (e) {
    console.error("[tgSendMessage] error:", (e as any)?.message || e);
  }
}

/** عرّف ADMIN_TELEGRAM_ID بالـ ENV (رقمي) */
export async function notifyAdmin(text: string) {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (adminId) await tgSendMessage(adminId, text);
}