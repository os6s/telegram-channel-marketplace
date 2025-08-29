// server/routes/wallet.ts
import { Router, Request, Response } from "express";

const router = Router();

// Use a bounceable user-friendly address (EQ... recommended).
const ESCROW_ADDRESS = "EQAdnKLl4-hXE_oDoqTwD22aA3ou884lqEQrTzazKI3zxIhf";

function toNanoStr(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount invalid");
  const [i, f = ""] = String(amount).split(".");
  const f9 = (f + "000000000").slice(0, 9);
  const s = `${i.replace(/^0+/, "")}${f9}`.replace(/^0+/, "");
  return s.length ? s : "0";
}

router.post("/deposit", (req: Request, res: Response) => {
  try {
    const { amount, chain } = req.body as { amount?: number; chain?: "mainnet" | "testnet" };

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ ok: false, error: "amount > 0 required" });
    }

    // Optional: log/validate chain to avoid mainnet/testnet mismatches.
    if (chain && chain !== "mainnet" && chain !== "testnet") {
      return res.status(400).json({ ok: false, error: "invalid chain" });
    }

    // Build TonConnect transaction
    const tonConnectTx = {
      validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes per spec
      messages: [
        {
          address: ESCROW_ADDRESS,          // user-friendly address
          amount: toNanoStr(amount),        // string, nanotons
          // payload/stateInit omitted -> pure TON transfer
        },
      ],
    };

    return res.json({
      ok: true,
      deposit: {
        asset: "TON",
        amount,
        chain: chain || "mainnet",
        tonConnectTx,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

export default router;