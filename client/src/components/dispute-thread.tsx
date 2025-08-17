import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export type DisputeMessage = {
  id: string;
  role: "buyer" | "seller" | "admin";
  text: string;
  at: string; // ISO
};

export type AdminOrder = {
  id: string;
  buyer: string;
  seller: string;
  amount: number;
  currency: string; // "TON" | "USDT"
  status: "held" | "released" | "refunded" | "disputed";
  createdAt: string; // ISO
  disputeThread?: DisputeMessage[];
};

export function DisputeThread({
  open,
  onOpenChange,
  order,
  onPost,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: AdminOrder | null;
  onPost: (orderId: string, msg: Omit<DisputeMessage, "id"|"at">) => void;
}) {
  const [text, setText] = useState("");
  if (!order) return null;

  const badgeClr = (r: DisputeMessage["role"]) =>
    r === "admin" ? "bg-purple-600 text-white"
    : r === "buyer" ? "bg-sky-600 text-white"
    : "bg-emerald-600 text-white";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Dialog.Title className="text-base font-semibold">Dispute · #{order.id.slice(0,6)}</Dialog.Title>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}><X className="w-4 h-4" /></Button>
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-auto pr-1">
            {(order.disputeThread || []).map((m) => (
              <div key={m.id} className="rounded-md border p-2 bg-background/60">
                <div className="flex items-center gap-2 text-xs mb-1">
                  <Badge className={badgeClr(m.role)}>{m.role}</Badge>
                  <span className="text-muted-foreground">{new Date(m.at).toLocaleString()}</span>
                </div>
                <div className="text-sm">{m.text}</div>
              </div>
            ))}
            {(!order.disputeThread || order.disputeThread.length === 0) && (
              <div className="text-sm text-muted-foreground">No messages yet.</div>
            )}
          </div>

          <div className="mt-3 space-y-2">
            <Textarea rows={3} value={text} onChange={(e)=>setText(e.target.value)} placeholder="Type a message as admin…" />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={()=>{ setText(""); onOpenChange(false); }}>Close</Button>
              <Button
                onClick={()=>{
                  if (!text.trim()) return;
                  onPost(order.id, { role: "admin", text: text.trim() });
                  setText("");
                }}
              >
                Send
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}