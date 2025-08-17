import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export type ChatRole = "buyer" | "seller" | "admin";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  at: string; // ISO
  author?: { id: string; name?: string; avatarUrl?: string };
};

export function MockChat({
  orderId,
  me,                // "buyer" | "seller" | "admin"
  buyer,
  seller,
  admin,
  initial,
  onSend,            // callback خارجي اختياري
  headerExtra,       // أي عناصر يمين الهيدر (زرّ رجوع ..الخ)
}: {
  orderId: string;
  me: ChatRole;
  buyer: { id: string; name?: string; avatarUrl?: string };
  seller: { id: string; name?: string; avatarUrl?: string };
  admin: { id: string; name?: string; avatarUrl?: string };
  initial?: ChatMessage[];
  onSend?: (msg: Omit<ChatMessage,"id"|"at">) => void;
  headerExtra?: React.ReactNode;
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>(() => initial || []);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const roleInfo = useMemo(() => ({
    buyer: { label: buyer.name || "Buyer", badge: "bg-sky-600 text-white" },
    seller:{ label: seller.name|| "Seller", badge:"bg-emerald-600 text-white" },
    admin: { label: admin.name || "Admin", badge:"bg-purple-600 text-white" },
  }), [buyer.name, seller.name, admin.name]);

  // auto scroll to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    const author =
      me === "buyer" ? buyer :
      me === "seller" ? seller : admin;

    const next: ChatMessage = {
      id: `m_${Date.now()}`,
      at: new Date().toISOString(),
      role: me,
      text: body,
      author,
    };

    setMsgs((prev) => [...prev, next]);
    setText("");
    onSend?.({
      role: next.role,
      text: next.text,
      author: next.author,
    });
  };

  return (
    <div className="flex flex-col h-[70vh] max-h-[80vh] rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">Order #{orderId}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Badge className="bg-sky-600 text-white">Buyer</Badge>
            <Badge className="bg-emerald-600 text-white">Seller</Badge>
            <Badge className="bg-purple-600 text-white">Admin</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">{headerExtra}</div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1