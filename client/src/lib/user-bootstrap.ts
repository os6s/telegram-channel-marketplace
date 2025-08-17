// client/src/lib/user-bootstrap.ts
import { telegramWebApp } from "@/lib/telegram";

export async function bootstrapUser(): Promise<string | null> {
  const tg = telegramWebApp?.user;
  if (!tg?.id) return null;

  // جرّب تجيب الموجود
  try {
    const r = await fetch(`/api/users?telegramId=${tg.id}`, { credentials: "include" });
    if (r.ok) {
      const u = await r.json();
      if (u?.id) {
        localStorage.setItem("sellerId", u.id);
        return u.id;
      }
    }
  } catch {}

  // أو أنشئه
  try {
    const r = await fetch(`/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        telegramId: String(tg.id),
        username: tg.username ?? null,
        firstName: tg.first_name ?? null,
        lastName: tg.last_name ?? null,
        tonWallet: null,
      }),
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (u?.id) {
      localStorage.setItem("sellerId", u.id);
      return u.id;
    }
  } catch {}

  return null;
}