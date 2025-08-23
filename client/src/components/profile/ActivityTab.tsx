import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { ActivityTimeline } from "@/components/activity-timeline";

export function ActivityTab({
  events, emptyText,
}: { events: any[]; emptyText: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          My Activity
        </div>
        {(!events || events.length === 0) ? (
          <div className="text-sm text-muted-foreground">{emptyText}</div>
        ) : (
          <ActivityTimeline events={events} emptyText={emptyText} />
        )}
      </CardContent>
    </Card>
  );
}