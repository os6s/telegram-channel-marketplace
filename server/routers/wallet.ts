import { Router, Request, Response } from "express";
import { beginCell } from "ton-core";

const router = Router();

// عنوان الإسكرو (bounceable address)
const ESCROW_ADDRESS = "EQAdnKLl4-hXE_oDoqTwD22aA3ou884lqEQrTzazKI3zxIhf";
const COMMENT_TEXT = "ton/ton!!!";

// تحويل TON إلى nano كـ string
function toNanoStr(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount invalid");
  const [i, f = ""] = String(amount).split(".");
  const f9 = (f + "000000000").slice(0, 9);
  const s = `${i.replace(/^0+/, "")}${f9}`.replace(/^0+/, "");
  return s.length ? s : "0";
}

// توليد payload نصّي كـ base64
function buildCommentPayload(text: string): string {
  const cell = beginCell().storeUint(0, 32).storeStringTail(text).endCell();
  return cell.toBoc().toString("base64");
}

// POST /api/wallet/deposit
router.post("/deposit", (req: Request, res: Response) => {
  try {
    const { amount } = req.body as { amount?: number };

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ ok: false, error: "amount > 0 required" });
    }

    const tonConnectTx = {
      validUntil: Math.floor(Date.now() / 1000) + 300, // 5 دقائق
      messages: [
        {
          address: ESCROW_ADDRESS,
          amount: toNanoStr(amount),
          payload: buildCommentPayload(COMMENT_TEXT), // ✅ تعليق يظهر في Popup
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
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

export default router;