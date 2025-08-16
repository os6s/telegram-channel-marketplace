import { ActivityTimeline, type ActivityEvent } from "@/components/activity-timeline";
import { useLanguage } from "@/contexts/language-context";

export default function Activity() {
  const { t } = useLanguage();

  // بيانات وهمية
  const data: ActivityEvent[] = [
    {
      id: "1",
      type: "LISTED",
      title: "Listed @coolchannel",
      subtitle: "by @seller123 • 120 TON",
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      type: "SOLD",
      title: "Sold @bignews",
      subtitle: "to @buyer • 250 TON",
      createdAt: new Date().toISOString(),
    },
    {
      id: "3",
      type: "UPDATED",
      title: "Updated @funnyclips",
      subtitle: "price changed to 99 TON",
      createdAt: new Date().toISOString(),
    },
  ];

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

      <ActivityTimeline
        events={data}
        emptyText={t("activityPage.empty") || "No marketplace activity yet"}
      />
    </div>
  );
}