import { Router, Request, Response } from "express";

const router = Router();

const ESCROW_ADDRESS = "UQAdnKLl4-hXE_oDoqTwD22aA3ou884lqEQrTzazKI3zxIhf";
const COMMENT_TEXT = "ton/ton!!!";

function toNano(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount invalid");
  const [i, f = ""] = String(amount).split(".");
  const f9 = (f + "000000000").slice(0, 9);
  const s = `${i}${f9}`.replace(/^0+/, "");
  return s.length ? s : "0";
}

router.post("/deposit", (req: Request, res: Response) => {
  const { amount } = req.body as { amount?: number };
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ ok: false, error: "amount > 0 required" });
  }

  const nanoAmount = toNano(amount);
  const validUntil = Math.floor(Date.now() / 1000) + 15 * 60;

  const tonConnectTx = {
    validUntil,
    messages: [
      {
        address: ESCROW_ADDRESS,
        amount: nanoAmount,
        // ❗️التعليق النصي (COMMENT_TEXT) ما ينضاف هنا لأن TonConnect يحتاج payload خاص.
        // حالياً نخلي العملية تحويل صافي للمحفظة.
      },
    ],
  };

  return res.json({
    ok: true,
    deposit: {
      asset: "TON",
      amount,
      tonConnectTx,
    },
  });
});

export default router;