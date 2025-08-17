// client/src/pages/admin.tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminControls, type EscrowPayment } from "@/components/admin-controls";
import { useTelegram } from "@/hooks/use-telegram";

type Channel = {
  id: string;
  name: string;
  username: string;
  price: string;
  sellerId: string;
};

function useAdminGate() {
  const { webAppData } = useTelegram();
  const isAdmin = webAppData?.user?.username === "Os6s7";
  return { isAdmin, user: webAppData?.user };
}

// TODO: استبدل هذه الفetches الحقيقية لاحقاً
async function fetchPending(): Promise<
  { payment: EscrowPayment; channel: Channel }[]
> {
  // Mock
  await new Promise(r => setTimeout(r, 250));
  return [
    {
      payment: {
        id: "pay_123",
        amount: 120,
        currency: "USDT",
        status: "held",
        buyerId: "1001",
        sellerId: "2001",
        listingId: "ch_1",
      },
      channel: { id: "ch_1", name: "Crypto Alpha", username: "crypto_alpha", price: "120", sellerId: "2001" },
    },
    {
      payment: {
        id: "pay_124",
        amount: 85,
        currency: "TON",
        status: "disputed",
        buyerId: "1002",
        sellerId: "2002",
        listingId: "ch_2",
      },
      channel: { id: "ch_2", name: "Tech Daily", username: "tech_daily", price: "85", sellerId: "2002" },
    },
  ];
}

async function fetchRecent(): Promise<
  { payment: EscrowPayment; channel: Channel }[]
> {
  await new Promise(r => setTimeout(r, 200));
  return [
    {
      payment: {
        id: "pay_099",
        amount: 230,
        currency: "USDT",
        status: "released",
        buyerId: "1999",
        sellerId: "2999",
        listingId: "ch_9",
      },
      channel: { id: "ch_9", name: "News Hub", username: "news_hub", price: "230", sellerId: "2999" },
    },
    {
      payment: {
        id: "pay_098",
        amount: 60,
        currency: "TON",
        status: "refunded",
        buyerId: "1888",
        sellerId: "2888",
        listingId: "ch_8",
      },
      channel: { id: "ch_8", name: "Gaming Pro", username: "gaming_pro", price: "60", sellerId: "2888" },
    },
  ];
}

export default function AdminPage() {
  const { isAdmin, user } = useAdminGate();

  const { data: pending = [], isLoading: loadingPending } = useQuery({
    queryKey: ["/api/admin/pending"],
    queryFn: fetchPending,
  });

  const { data: recent = [], isLoading: loadingRecent } = useQuery({
    queryKey: ["/api/admin/recent"],
    queryFn: fetchRecent,
  });

  const counts = useMemo(() => {
    const held = pending.filter(x => x.payment.status === "held").length;
    const disputed = [...pending, ...recent].filter(x => x.payment.status === "disputed").length;
    return { held, disputed, total: pending.length + recent.length };
  }, [pending, recent]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-sm w-full">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This section is restricted to admins.
            </p>
            <div className="text-xs text-muted-foreground">
              Signed in as: <strong>@{user?.username || "unknown"}</strong>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 space-y-6">
      <header className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Admin</h1>
            <p className="text-xs text-muted-foreground">
              Escrow & listings moderation
            </p>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-amber-500">Held: {counts.held}</Badge>
            <Badge className="bg-red-600">Disputed: {counts.disputed}</Badge>
            <Badge variant="secondary">Total: {counts.total}</Badge>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Pending actions</h2>

        {loadingPending ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Loading…</CardContent></Card>
        ) : pending.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No pending items</CardContent></Card>
        ) : (
          pending.map(({ payment, channel }) => (
            <AdminControls
              key={payment.id}
              channel={channel as any}
              currentUser={{ username: "Os6s7" }}
              payment={payment}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Recent</h2>

        {loadingRecent ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Loading…</CardContent></Card>
        ) : recent.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No recent records</CardContent></Card>
        ) : (
          recent.map(({ payment, channel }) => (
            <AdminControls
              key={payment.id}
              channel={channel as any}
              currentUser={{ username: "Os6s7" }}
              payment={payment}
            />
          ))
        )}
      </section>

      <div className="h-16" />
    </div>
  );
}