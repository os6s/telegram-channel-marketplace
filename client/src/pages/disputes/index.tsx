// client/src/pages/disputes/index.tsx
import { useEffect, useMemo, useState } from "react";
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

  const hasTG = !!telegramWebApp;
  const me = telegramWebApp?.user?.username || null;

  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  // فورماتر تواريخ محلي
  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  // ✅ ألغينا المنع: لا setDenied ولا رسالة "افتح من داخل تيليگرام"
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);

    (async () => {
      try {
        // الخادم يرجّع نزاعات المستخدم الحالي إن وُجد. خارج تيليجرام غالبًا يرجّع قائمة فارغة.
        const data = await apiRequest<Dispute[]>("GET", "/api/disputes?me=1");
        if (ac.signal.aborted) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (ac.signal.aborted) return;
        toast({
          variant: "destructive",
          title: "خطأ",
          description: e?.message || "فشل جلب النزاعات",
        });
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [hasTG, me, toast]);

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
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{d.listingTitle || d.paymentId || d.id}</div>
                {statusBadge(String(d.status || ""))}
              </div>
              <div className="text-sm text-muted-foreground">
                {d.reason || "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {d.createdAt ? `بداية: ${fmt.format(new Date(d.createdAt))}` : null}
                {d.lastUpdateAt ? ` • آخر تحديث: ${fmt.format(new Date(d.lastUpdateAt))}` : null}
              </div>
              <div className="pt-2">
                <Link href={`/disputes/${encodeURIComponent(d.id)}`}>
                  <Button size="sm">فتح المحادثة</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <div className="pt-2">
        <Button variant="secondary" size="sm" onClick={() => navigate("/")}>رجوع</Button>
      </div>
    </div>
  );
}