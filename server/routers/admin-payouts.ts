import type { Express } from "express";
import { storage } from "../storage";

// ملاحظـة: الوصول محصور إدارياً. أضف middleware adminAuth إن متوفر.
export function mountAdminPayouts(app: Express) {
  // عرض طلبات سحب لمستخدم محدد
  app.get("/admin/payouts", async (req, res) => {
    const sellerId = String(req.query.sellerId || "");
    if (!sellerId) return res.status(400).json({ error: "sellerId_required" });
    const rows = await storage.listPayoutsBySeller(sellerId);
    res.json(rows);
  });

  // تأكيد الإرسال
  app.patch("/admin/payouts/:id/approve", async (req, res) => {
    const id = req.params.id;
    const txHash = String(req.body?.txHash || "");
    const checklist = String(req.body?.checklist || "manual-checked");
    if (!txHash || txHash.length < 16) return res.status(400).json({ error: "tx_hash_required" });
    const up = await storage.updatePayout(id, {
      status: "sent",
      adminChecked: true,
      txHash,
      checklist,
    });
    res.json(up);
  });

  // رفض الطلب
  app.patch("/admin/payouts/:id/reject", async (req, res) => {
    const id = req.params.id;
    const reason = String(req.body?.reason || "rejected");
    const up = await storage.updatePayout(id, {
      status: "rejected",
      adminChecked: true,
      checklist: reason,
    });
    res.json(up);
  });
}