import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ActivityTimeline, type ActivityEvent } from "@/components/activity-timeline";
import { useLanguage } from "@/contexts/language-context";

export default function Activity() {
  const { t } = useLanguage();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/activity", "global"],
    queryFn: async () => {
      // API المتوقّع: يرجّع مصفوفة ActivityEvent
      const res = await fetch("/api/activity?scope=global&limit=50");
      if (!res.ok) throw new Error("Failed to fetch activity");
      return (await res.json()) as ActivityEvent[];
    },
  });

  return (
    <div className="min-h-screen px-4 py-6">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">
          {t("activityPage.title") || "Marketplace Activity"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("activityPage.subtitle") || "Live timeline of listings, sales and updates"}
        </p>
      </header>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive-foreground">Failed to load activity.</CardContent>
        </Card>
      ) : (
        <ActivityTimeline
          events={data || []}
          emptyText={t("activityPage.empty") || "No marketplace activity yet"}
        />
      )}
    </div>
  );
}