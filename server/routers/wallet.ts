// server/routers/wallet.ts
import { Router, Request, Response } from "express";

const router = Router();

// عنوان الإسكرو الثابت
const ESCROW_ADDRESS = "UQAdnKLl4-hXE_oDoqTwD22aA3ou884lqEQrTzazKI3zxIhf";
// تعليق واحد فقط كما طَلَبت
const COMMENT_TEXT = "ton/ton!!!";

type DepositBody = { amount?: number };

/** تحويل TON إلى nanoTON كسلسلة صحيحة */
function toNano(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount invalid");
  const [i, f = ""] = String(amount).split(".");
  const f9 = (f + "000000000").slice(0, 9);
  const s = `${i}${f9}`.replace(/^0+/, "");
  return s.length ? s : "0";
}

/**
 * POST /api/wallet/deposit
 * body: { amount: number }
 * يرجّع:
 * - tonDeepLink: رابط ton:// للموافقة داخل محفظة تيليجرام أو أي محفظة تدعم السكيما
 * - tonAltLink: بديل http
 * - tonConnectTx: كائن جاهز لـ TonConnectUI (بدون payload للتعليق لتفادي أخطاء التكويد)
 */
router.post("/deposit", (req: Request, res: Response) => {
  const { amount } = (req.body || {}) as DepositBody;

  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, error: "amount لازم يكون > 0" });
  }

  const nanoAmount = toNano(amount);
  const text = encodeURIComponent(COMMENT_TEXT);

  // روابط عميقة
  const tonDeepLink = `ton://transfer/${encodeURIComponent(
    ESCROW_ADDRESS
  )}?amount=${nanoAmount}&text=${text}`;

  const tonAltLink = `https://tonhub.com/transfer/${encodeURIComponent(
    ESCROW_ADDRESS
  )}?amount=${nanoAmount}&text=${text}`;

  // TonConnect: رسالة تحويل بسيطة فقط
  const validUntil = Math.floor(Date.now() / 1000) + 15 * 60;
  const tonConnectTx = {
    validUntil,
    messages: [
      {
        address: ESCROW_ADDRESS,
        amount: nanoAmount,
        // ملاحظة: التعليق لا يظهر داخل TonConnect بدون payload.
        // تم طلب الاعتماد على COMMENT_TEXT فقط في الروابط العميقة.
      },
    ],
  };

  return res.json({
    ok: true,
    mode: "demo",
    deposit: {
      asset: "TON",
      amount,
      nanoAmount,
      toAddress: ESCROW_ADDRESS,
      comment: COMMENT_TEXT,
      tonDeepLink,
      tonAltLink,
      tonConnectTx,
      expiresAt: new Date(validUntil * 1000).toISOString(),
    },
  });
});

export default router;