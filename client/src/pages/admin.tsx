import { AdminControls, type EscrowPayment } from "@/components/admin-controls";
import { useQuery } from "@tanstack/react-query";

export default function AdminPage() {
  // اجلب القنوات + دفعات الضمان (API حقيقية لاحقًا)
  const { data: channels = [] } = useQuery({ queryKey: ["/api/channels"] });
  const { data: payments = [] } = useQuery({ queryKey: ["/api/payments"] });

  // افترض أن عندك currentUser من تيليجرام:
  const currentUser = { username: window.Telegram?.WebApp?.initDataUnsafe?.user?.username };

  return (
    <div className="p-4 space-y-4">
      {channels.map((ch: any) => {
        const payment: EscrowPayment | undefined =
          payments.find((p: any) => p.listingId === ch.id);
        return (
          <AdminControls
            key={ch.id}
            channel={ch}
            currentUser={currentUser}
            payment={payment}
          />
        );
      })}
    </div>
  );
}