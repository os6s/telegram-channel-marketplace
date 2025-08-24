import { eq, sql } from "drizzle-orm";
import { db } from "../../../db.js";
import { listings, users } from "@shared/schema";

export const S = (v: unknown) => (v == null ? "" : String(v));

export function toNum(v: unknown): number | null {
  if (v == null || S(v).trim() === "") return null;
  const n = Number(S(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function getUserByUsernameInsensitive(username: string) {
  const u = await db.query.users.findFirst({
    where: sql`lower(${users.username}) = ${username.toLowerCase()}`,
  });
  return u || null;
}

export async function getListingOrNull(id: string) {
  const l = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  return l || null;
}

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
  } catch {}
}
