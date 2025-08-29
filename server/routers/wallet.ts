import { Router, Request, Response } from "express";
import { toNano } from "@ton/core"; // safer conversion

const router = Router();

// Escrow wallet address (mainnet, bounceable)
const ESCROW_ADDRESS = "EQAdnKLl4-hXE_oDoqTwD22aA3ou884lqEQrTzazKI3zxIhf";
const COMMENT_TEXT = "ton/ton!!!"; // static comment for testing

// POST /api/wallet/deposit
router.post("/deposit", (req: Request, res: Response) => {
  try {
    const { amount } = req.body as { amount?: number };

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ ok: false, error: "amount > 0 required" });
    }

    // Build TonConnect transaction
    const tonConnectTx = {
      validUntil: Math.floor(Date.now() / 1000) + 300, // valid for 5 min
      messages: [
        {
          address: ESCROW_ADDRESS,
          amount: toNano(amount).toString(), // convert TON -> nanotons
          payload: COMMENT_TEXT              // plain string comment
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