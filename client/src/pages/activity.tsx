// client/src/pages/activity.tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityTimeline, type ActivityEvent } from "@/components/activity-timeline";
import { useLanguage } from "@/contexts/language-context";
import { apiRequest } from "@/lib/queryClient";

type ApiActivity =
  | {
      kind: "listed";
      id: string;
      createdAt: string;
      title: string | null;
      username: string | null;
      price: string | number | null;
      currency: string | null;
      seller: string | null;
    }
  | {
      kind: "sold";
      id: string;
      createdAt: string;
      title: string | null;
      username: string | null;
      price: string | number | null;
      currency: string | null;
      seller: string | null;
      buyer: string | null;
    };

export default function Activity() {
  const { t } = useLanguage();

  const { data, isLoading, error } = useQuery<ApiActivity[]>({
    queryKey: ["/api/market-activity", { limit: 50 }],
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey as [string, { limit?: number }];
      const limit = params?.limit ?? 50;
      const res = (await apiRequest("GET", `/api/market-activity?limit=${limit}`)) as ApiActivity[];
      return Array.isArray(res) ? res : [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const events: ActivityEvent[] = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((item) => {
      const tag = item.username ? `@${item.username}` : item.title ?? "Listing";
      const price =
        item.price != null && item.currency ? `${String(item.price)} ${item.currency}` : undefined;

      if (item.kind === "sold") {
        const subtitleParts = [
          item.seller ? `by @${item.seller}` : undefined,
          (item as any).buyer ? `to @${(item as any).buyer}` : undefined,
          price,
        ].filter(Boolean);
        return {
          id: item.id,
          type: "SOLD",
          title: `Sold ${tag}`,
          subtitle: subtitleParts.join(" • "),
          createdAt: item.createdAt,
        };
      }

      const subtitleParts = [item.seller ? `by @${item.seller}` : undefined, price].filter(Boolean);
      return {
        id: item.id,
        type: "LISTED",
        title: `Listed ${tag}`,
        subtitle: subtitleParts.join(" • "),
        createdAt: item.createdAt,
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