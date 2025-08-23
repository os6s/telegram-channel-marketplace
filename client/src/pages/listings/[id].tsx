// client/src/pages/listing/[id].tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ensureTelegramReady, telegramWebApp } from "@/lib/telegram";

type Listing = {
  id: string;
  kind?: string;
  platform?: string|null;
  username?: string|null;
  sellerUsername?: string|null;
  title?: string|null;
  description?: string|null;
  price: string;
  currency?: string|null;
  isActive?: boolean;
  createdAt?: string;
  canDelete?: boolean; // اختياري من الباك
};

export default function ListingDetailsPage({ params }: { params: { id: string } }) {
  const id = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => { ensureTelegramReady(); }, []);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("action") === "buy") setConfirmOpen(true);
    } catch {}
  }, []);

  const { data: listing, isLoading } = useQuery({
    enabled: !!id,
    queryKey: ["/api/listings", id],
    queryFn: async () => await apiRequest("GET", `/api/listings/${id}`) as Listing,
    refetchOnWindowFocus: false,
  });

  const fmt = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 9 }), []);

  // شراء: ينشئ Payment ثم Dispute
  const buyMutation = useMutation({
    mutationFn: async () => {
      const pay = await apiRequest("POST", "/api/payments", { listingId: id });
      const paymentId: string | undefined = pay?.id;
      if (paymentId) {
        try { await apiRequest("POST", "/api/disputes", { paymentId }); } catch {}
      }
      return { paymentId };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({ title: "تم إنشاء الطلب", description: "اذهب إلى صفحة النزاعات لمحادثة البائع." });
      navigate("/disputes");
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      if (msg.includes("insufficient_balance") || msg.includes("402")) {
        toast({ title: "الرصيد غير كافٍ", description: "اشحن رصيدك ثم أعد المحاولة.", variant: "destructive" });
        return;
      }
      toast({ title: "فشل الشراء", description: msg || "تعذر إنشاء عملية الدفع", variant: "destructive" });
    },
  });

  // حذف: يعتمد على username
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const uname = (telegramWebApp.user?.username || "").toLowerCase();
      const q = uname ? `?username=${encodeURIComponent(uname)}` : "";
      return await apiRequest("DELETE", `/api/listings/${id}${q}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({ title: "تم حذف الإعلان" });
      navigate("/");
    },
    onError: (e: any) => {
      toast({ title: "خطأ", description: e?.message || "تعذر الحذف", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <Card><CardContent className="p-4 text-sm text-muted-foreground">جاري التحميل…</CardContent></Card>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="p-4">
        <Card><CardContent className="p-4 text-sm text-destructive">العنصر غير موجود.</CardContent></Card>
        <div className="pt-3">
          <Button variant="secondary" size="sm" onClick={() => navigate("/")}>رجوع</Button>
        </div>
      </div>
    );
  }

  const currency = listing.currency || "TON";
  const meUname = (telegramWebApp.user?.username || "").toLowerCase();
  const sellerUname = (listing.sellerUsername || listing.username || "").toLowerCase();
  const isOwner = !!meUname && !!sellerUname && meUname === sellerUname;
  const canDelete = listing.canDelete === true || isOwner;

  return (
    <div className="p-4 space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{listing.title || "منتج"}</h1>
        {listing.isActive === false ? <Badge variant="outline">غير مفعل</Badge> : null}
      </header>

      <Card className="bg-card border border-border">
        <CardContent className="p-4 space-y-3">
          <div className="text-sm text-muted-foreground">
            البائع: @{listing.sellerUsername || listing.username || "—"}
          </div>

          {listing.platform ? (
            <div className="text-xs opacity-80">
              المنصة: {listing.platform} {listing.kind ? `· ${listing.kind}` : ""}
            </div>
          ) : null}

          {listing.description ? (
            <div className="text-sm whitespace-pre-wrap">{listing.description}</div>
          ) : null}

          <div className="text-base font-semibold">
            السعر: {fmt.format(Number(listing.price))} {currency}
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            {!isOwner && (
              <Button
                className="bg-telegram-500 hover:bg-telegram-600 text-white"
                disabled={buyMutation.isPending || listing.isActive === false}
                onClick={() => setConfirmOpen(true)}
              >
                {buyMutation.isPending ? "جارٍ المعالجة…" : "شراء الآن"}
              </Button>
            )}

            {canDelete && (
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteOpen(true)}
              >
                {deleteMutation.isPending ? "جارٍ الحذف…" : "حذف الإعلان"}
              </Button>
            )}

            <Link href="/">
              <Button variant="secondary">رجوع</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* تأكيد الشراء */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الشراء</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إنشاء طلب شراء بقيمة {fmt.format(Number(listing.price))} {currency}. بعدها تُفتح محادثة التسليم مع البائع في صفحة النزاعات.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={buyMutation.isPending}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={buyMutation.isPending}
              onClick={() => buyMutation.mutate()}
            >
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* تأكيد الحذف */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الإعلان؟</AlertDialogTitle>
            <AlertDialogDescription>سيُحذف الإعلان نهائياً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}