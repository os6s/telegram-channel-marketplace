import { eq, and, ilike, sql } from "drizzle-orm";
import { db } from "../../../db.js";
import { listings, users } from "@shared/schema";

/** safe stringify */
export const S = (v: unknown) => (v == null ? "" : String(v));

/** يحوّل إلى رقم أو undefined */
export function toNum(v: unknown): number | undefined {
  if (v == null || S(v).trim() === "") return undefined;
  const n = Number(S(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** البحث عن يوزر باليوزرنيم (case-insensitive) */
export async function getUserByUsernameInsensitive(username: string) {
  if (!username) return null;
  const u = await db.query.users.findFirst({
    where: ilike(users.username, username), // ilike = case-insensitive
  });
  return u || null;
}

/** يرجع listing إذا موجود وفعال */
export async function getListingOrNull(id: string) {
  if (!id) return null;
  const l = await db.query.listings.findFirst({
    where: and(eq(listings.id, id), eq(listings.isActive, true)),
  });
  return l || null;
}

/** إرسال رسالة تيليجرام */
export async function sendTelegramMessage(
  telegramId: string | number | null | undefined,
  text: string,
  replyMarkup?: any
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const chatId = Number(telegramId);
  if (!Number.isFinite(chatId)) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
  } catch (e: any) {
    console.error("sendTelegramMessage error:", e?.message || e);
  }
}