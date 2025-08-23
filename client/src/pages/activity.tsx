// client/src/pages/activity.tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityTimeline, type ActivityEvent } from "@/components/activity-timeline";
import { useLanguage } from "@/contexts/language-context";
import { apiRequest } from "@/lib/queryClient";

type ApiActivityListed = {
  kind: "listed";
  id: string;
  createdAt: string;
  title: string | null;
  username: string | null;
  price: string | number | null;
  currency: string | null;
  seller: string | null;
};

type ApiActivitySold = ApiActivityListed & {
  kind: "sold";
  buyer: string | null;
};

type ApiActivity = ApiActivityListed | ApiActivitySold;

const S = (v: unknown) => (v == null ? "" : String(v));
const has = (v: unknown) => v !== null && v !== undefined && S(v).trim() !== "";

export default function Activity() {
  const { t } = useLanguage();

  const { data, isLoading, error } = useQuery<ApiActivity[]>({
    queryKey: ["/api/market-activity", { limit: 50 }],
    queryFn: async ({ queryKey }) => {
      // لا تفكك بشكل صارم لتجنّب أخطاء "cannot convert"
      const qk = queryKey as unknown[];
      const params = (qk[1] as { limit?: number }) || {};
      const limit = Number.isFinite(params?.limit as number) ? (params!.limit as number) : 50;

      const res = (await apiRequest(
        "GET",
        `/api/market-activity?limit=${encodeURIComponent(String(limit))}`
      )) as ApiActivity[] | unknown;

      return Array.isArray(res) ? res : [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const events: ActivityEvent[] = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((item) => {
      const tag = has(item.username) ? `@${S(item.username)}` : has(item.title) ? S(item.title) : "Listing";
      const price =
        has(item.price) && has(item.currency) ? `${S(item.price)} ${S(item.currency)}` : undefined;
      const seller = has(item.seller) ? `@${S(item.seller)}` : undefined;

      if (item.kind === "sold") {
        const buyer = has((item as ApiActivitySold).buyer) ? `@${S((item as ApiActivitySold).buyer)}` : undefined;
        const subtitleParts = [seller, buyer, price].filter(Boolean) as string[];
        return {
          id: S(item.id),
          type: "SOLD",
          title: `Sold ${tag}`,
          subtitle: subtitleParts.join(" • "),
          createdAt: S(item.createdAt),
        };
      }

      const subtitleParts = [seller, price].filter(Boolean) as string[];
      return {
        id: S(item.id),
        type: "LISTED",
        title: `Listed ${tag}`,
        subtitle: subtitleParts.join(" • "),
        createdAt: S(item.createdAt),
      };
    });
  }, [data]);

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
        <div className="text-sm text-red-500">
          {(error as Error).message || "Failed to load activity"}
        </div>
      ) : (
        <ActivityTimeline
          events={events}
          emptyText={t("activityPage.empty") || "No marketplace activity yet"}
        />
      )}
    </div>
  );
}