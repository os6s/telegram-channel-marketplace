// server/utils/telegram.ts

type InlineKeyboardButton = {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: { url: string };
};

type ReplyMarkup =
  | { inline_keyboard: InlineKeyboardButton[][] }
  | { remove_keyboard: true }
  | { force_reply: true }
  | { keyboard: InlineKeyboardButton[][]; resize_keyboard?: boolean; one_time_keyboard?: boolean };

/**
 * Send a Telegram message. Returns true on success, false otherwise.
 */
export async function tgSendMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: ReplyMarkup
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[tgSendMessage] TELEGRAM_BOT_TOKEN missing");
    return false;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML" as const,
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
      console.error("[tgSendMessage] Telegram API error:", j);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[tgSendMessage] error:", (e as any)?.message || e);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/** Notify a single admin (ADMIN_TELEGRAM_ID env). Returns true if sent. */
export async function notifyAdmin(text: string): Promise<boolean> {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminId) {
    console.warn("[notifyAdmin] ADMIN_TELEGRAM_ID not set");
    return false;
  }
  return tgSendMessage(adminId, text);
}