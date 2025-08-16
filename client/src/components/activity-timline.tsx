import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, PlusCircle, Pencil, ShoppingCart, Eye } from "lucide-react";

export type ActivityEvent = {
  id: string;
  type: "LISTED" | "SOLD" | "UPDATED" | "VIEW" | "OTHER";
  title: string;          // مثال: "Listed @mychannel"
  subtitle?: string;      // مثال: "by @seller • 1200 TON"
  amount?: string;        // اختياري
  listingId?: string;     // اختياري
  listingTitle?: string;  // اختياري
  createdAt: string;      // ISO
};

function Icon({ type }: { type: ActivityEvent["type"] }) {
  switch (type) {
    case "LISTED":  return <PlusCircle className="w-4 h-4" />;
    case "SOLD":    return <ShoppingCart className="w-4 h-4" />;
    case "UPDATED": return <Pencil className="w-4 h-4" />;
    case "VIEW":    return <Eye className="w-4 h-4" />;
    default:        return <Clock className="w-4 h-4" />;
  }
}

function TypeBadge({ type }: { type: ActivityEvent["type"] }) {
  const map: Record<ActivityEvent["type"], { label: string; cls: string }> = {
    LISTED:  { label: "Listed",  cls: "bg-blue-600 text-white" },
    SOLD:    { label: "Sold",    cls: "bg-green-600 text-white" },
    UPDATED: { label: "Updated", cls: "bg-amber-600 text-white" },
    VIEW:    { label: "View",    cls: "bg-cyan-600 text-white" },
    OTHER:   { label: "Other",   cls: "bg-muted text-foreground" },
  };
  return <Badge className={cn("rounded-full px-2 py-0.5 h-6", map[type].cls)}>{map[type].label}</Badge>;
}

export function ActivityTimeline({
  events,
  emptyText = "No activity yet",
}: {
  events: ActivityEvent[];
  emptyText?: string;
}) {
  if (!events?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground text-6xl mb-4">📭</div>
          <h3 className="font-medium text-foreground mb-2">{emptyText}</h3>
          <p className="text-sm text-muted-foreground">Try again later.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((ev) => (
        <Card key={ev.id} className="border-border">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <TypeBadge type={ev.type} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Icon type={ev.type} />
                  <div className="font-medium text-foreground">{ev.title}</div>
                </div>
                {ev.subtitle && (
                  <div className="text-sm text-muted-foreground mt-1">{ev.subtitle}</div>
                )}
                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {new Date(ev.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}