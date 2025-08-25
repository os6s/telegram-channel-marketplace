// client/src/pages/activity.tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityTimeline, type ActivityEvent } from "@/components/activity-timeline";
import { useLanguage } from "@/contexts/language-context";
import { apiRequest } from "@/lib/queryClient";

type ApiActivity = {
  id: string;
  kind: "listed" | "sold";
  createdAt: string;
  title: string | null;
  username: string | null;
  price: string | number | null;
  currency: string | null;
  seller: string | null;
  buyer?: string | null;
};

const S = (v: unknown) => (v == null ? "" : String(v).trim());
const has = (v: unknown) => v !== null && v !== undefined && S(v) !== "";

export default function Activity() {
  const { t } = useLanguage();

  const { data, isLoading, error } = useQuery<ApiActivity[]>({
    queryKey: ["/api/market-activity"],
    queryFn: async () => {
      const res = (await apiRequest("GET", `/api/market-activity?limit=50`)) as ApiActivity[] | unknown;
      return Array.isArray(res) ? res : [];
    },
    refetchOnWindowFocus: true,
    refetchInterval: 10_000, // 🔄 auto-refresh every 10s
    retry: false,
  });

  const events: ActivityEvent[] = useMemo(() => {
    if (!Array.isArray(data)) return [];

    return data.map((item) => {
      const tag =
        has(item.username) ? `@${S(item.username)}` : has(item.title) ? S(item.title) : "Listing";
      const price =
        has(item.price) && has(item.currency) ? `${S(item.price)} ${S(item.currency)}` : "—";
      const seller = has(item.seller) ? `@${S(item.seller)}` : t("activityPage.unknownSeller") || "Unknown seller";

      const created = new Date(item.createdAt).toLocaleString();

      if (item.kind === "sold") {
        const buyer = has(item.buyer) ? `@${S(item.buyer)}` : t("activityPage.unknownBuyer") || "Unknown buyer";
        const subtitleParts = [seller, buyer, price].filter(Boolean) as string[];

        return {
          id: S(item.id),
          type: "SOLD",
          title: t("activityPage.soldTitle", { tag }) || `Sold ${tag}`,
          subtitle: subtitleParts.join(" • "),
          createdAt: created,
        };
      }

      const subtitleParts = [seller, price].filter(Boolean) as string[];
      return {
        id: S(item.id),
        type: "LISTED",
        title: t("activityPage.listedTitle", { tag }) || `Listed ${tag}`,
        subtitle: subtitleParts.join(" • "),
        createdAt: created,
      };
    });
  }, [data, t]);

  const errMsg =
    (error as any)?.message || (error as any)?.error || t("activityPage.loadFailed") || "Failed to load activity";

  return (
    <div className="min-h-screen px-4 py-6">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">
          {t("activityPage.title") || "Marketplace Activity"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("activityPage.subtitle") || "Live timeline of listings and sales"}
        </p>
      </header>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-500">{errMsg}</div>
      ) : (
        <ActivityTimeline
          events={events}
          emptyText={t("activityPage.empty") || "No marketplace activity yet"}
        />
      )}
    </div>
  );
}