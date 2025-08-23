// client/src/pages/disputes/index.tsx
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { telegramWebApp } from "@/lib/telegram";

type Dispute = {
  id: string;
  paymentId?: string | null;
  buyerUsername?: string | null;
  sellerUsername?: string | null;
  status: "open" | "resolved" | "cancelled" | string;
  reason?: string | null;
  listingTitle?: string | null;
  createdAt?: string | null;
  lastUpdateAt?: string | null;
};

const statusBadge = (s: string) => {
  if (s === "open") return <Badge className="bg-amber-500 text-white">مفتوح</Badge>;
  if (s === "resolved") return <Badge className="bg-emerald-600 text-white">محسوم</Badge>;
  if (s === "cancelled") return <Badge className="bg-gray-400 text-white">ملغى</Badge>;
  return <Badge>{s}</Badge>;
};

export default function DisputesIndex() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const me = telegramWebApp?.user?.username || null;

  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  // توسيع الويب فيو
  useEffect(() => {
    try { telegramWebApp?.expand?.(); } catch {}
  }, []);

  // حماية الوصول: لازم يكون عنده username داخل تيليگرام
  useEffect(() => {
    if (!me) {
      setDenied(true);
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const data = await apiRequest("GET", "/api/disputes?me=1");
        if (!mounted) return;
        if (!Array.isArray(data)) {
          setItems([]);
        } else {
          setItems(data as Dispute[]);
        }
      } catch (e: any) {
        if (!mounted) return;
        setItems([]);
        toast({ title: "خطأ", description: e?.message || "تعذر جلب النزاعات", variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [me, toast]);

  if (denied) {
    return (
      <div className="p-4 space-y-3">
        <h1 className="text-lg font-semibold">النزاعات</h1>
        <Card>
          <CardContent className="p-4 text-sm">
            غير مسموح. افتح التطبيق من داخل تيليگرام وبحسابك.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-semibold">النزاعات</h1>

      {loading ? (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">جاري التحميل…</CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-4 text-sm">ما عندك نزاعات حالياً.</CardContent></Card>
      ) : (
        items.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {statusBadge(String(d.status))}
                  {d.listingTitle ? <span className="text-sm opacity-80">— {d.listingTitle}</span> : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {d.createdAt ? new Date(d.createdAt).toLocaleString() : ""}
                </div>
                <div className="text-sm">
                  {d.buyerUsername ? `المشتري: @${d.buyerUsername}` : null}
                  {d.sellerUsername ? `، البائع: @${d.sellerUsername}` : null}
                </div>
                {d.reason ? <div className="text-xs opacity-70">السبب: {d.reason}</div> : null}
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/disputes/${d.id}`}>
                  <Button size="sm">فتح المحادثة</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* زر رجوع اختياري */}
      <div className="pt-2">
        <Button variant="secondary" size="sm" onClick={() => navigate("/")}>رجوع</Button>
      </div>
    </div>
  );
}