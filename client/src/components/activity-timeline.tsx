// client/src/components/activity-timeline.tsx
import { CalendarClock, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import React from "react";

type ActivityItem = {
  id: string;
  createdAt: string | number | Date; // ISO or Date
  action: "buy" | "sell" | "list" | "update" | "cancel" | "transfer";
  amount?: number;
  currency?: string; // e.g. "TON" | "USDT"
  serviceTitle?: string; // ← نص الخدمة يظهر يساراً (مثال: "Twitter Username" أو "Instagram Account")
  note?: string; // optional extra text
};

export function ActivityTimeline({ items = [] as ActivityItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <Row key={it.id} item={it} />
      ))}
    </div>
  );
}

function Row({ item }: { item: ActivityItem }) {
  const date = new Date(item.createdAt);
  const dt =
    isNaN(date.getTime())
      ? String(item.createdAt)
      : `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  const icon =
    item.action === "buy" ? (
      <ArrowDownLeft className="w-4 h-4" />
    ) : item.action === "sell" ? (
      <ArrowUpRight className="w-4 h-4" />
    ) : (
      <CalendarClock className="w-4 h-4" />
    );

  return (
    <div className="rounded-md border border-border bg-card px-3 py-3">
      {/* العنوان + التاريخ */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-foreground">
            {icon}
            <span className="text-sm font-medium capitalize">{item.action}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{dt}</div>
        </div>

        {/* ← نص الخدمة على الجهة اليسار (بدون أيقونات) */}
        <div className="ml-3 flex-1 text-right">
          <div className="text-sm font-medium text-foreground truncate">
            {item.serviceTitle || ""}
          </div>
          {/* المبلغ يبقى بخط منفصل عاليمين */}
          {typeof item.amount === "number" && item.currency && (
            <div className="mt-0.5 text-sm text-foreground">
              {item.amount} {item.currency}
            </div>
          )}
        </div>
      </div>

      {/* ملاحظة اختيارية */}
      {item.note && (
        <div className="mt-2 text-xs text-muted-foreground line-clamp-2">{item.note}</div>
      )}
    </div>
  );
}

export default ActivityTimeline;