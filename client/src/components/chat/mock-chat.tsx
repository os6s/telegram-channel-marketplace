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
  onSend,            // optional callback
  headerExtra,       // e.g. Back button, status chip...
}: {
  orderId: string;
  me: ChatRole;
  buyer: { id: string; name?: string; avatarUrl?: string };
  seller: { id: string; name?: string; avatarUrl?: string };
  admin: { id: string; name?: string; avatarUrl?: string };
  initial?: ChatMessage[];
  onSend?: (msg: Omit<ChatMessage, "id" | "at">) => void;
  headerExtra?: React.ReactNode;
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>(() => initial || []);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const roleInfo = useMemo(
    () => ({
      buyer: { label: buyer.name || "Buyer", badge: "bg-sky-600 text-white" },
      seller: { label: seller.name || "Seller", badge: "bg-emerald-600 text-white" },
      admin: { label: admin.name || "Admin", badge: "bg-purple-600 text-white" },
    }),
    [buyer.name, seller.name, admin.name]
  );

  // auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    const author = me === "buyer" ? buyer : me === "seller" ? seller : admin;

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

  const bubbleAlign = (r: ChatRole) =>
    r === me ? "items-end text-right" : "items-start text-left";

  const bubbleStyle = (r: ChatRole) =>
    r === me
      ? "bg-primary text-primary-foreground"
      : r === "buyer"
      ? "bg-sky-600 text-white"
      : r === "seller"
      ? "bg-emerald-600 text-white"
      : "bg-purple-600 text-white";

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
      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-3 space-y-2 bg-background">
        {msgs.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-6">
            No messages yet.
          </div>
        )}

        {msgs.map((m) => {
          const who =
            m.role === "buyer" ? buyer : m.role === "seller" ? seller : admin;
          return (
            <div key={m.id} className={`flex flex-col ${bubbleAlign(m.role)} gap-1`}>
              <div className="text-[10px] text-muted-foreground">
                {who?.name || m.role} · {new Date(m.at).toLocaleString()}
              </div>
              <div
                className={`max-w-[80%] rounded-md px-3 py-2 ${bubbleStyle(m.role)}`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="border-t bg-card p-2">
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message as ${roleInfo[me].label}…`}
            className="flex-1 bg-background"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button onClick={send} className="self-stretch">
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}