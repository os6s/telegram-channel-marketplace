import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit3 } from "lucide-react";
import { ListingCard } from "@/components/ListingCard";

export function ListingsTab({
  listings, isLoading, currentUsername,
}: { listings: any[]; isLoading: boolean; currentUsername?: string }) {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-pulse space-y-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i}><CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
              </div>
            </CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">My Listings</h3>
        <Button size="sm" className="bg-telegram-500 hover:bg-telegram-600" onClick={() => (window.location.href = "/sell")}>
          <Plus className="w-4 h-4 mr-1" />
          {/* الاسم الجديد */}
          List for sale
        </Button>
      </div>

      {listings.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground text-6xl mb-4">📺</div>
            <h3 className="font-medium text-foreground mb-2">No listings yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Post your first listing to start selling.</p>
            <Button className="bg-telegram-500 hover:bg-telegram-600" onClick={() => (window.location.href = "/sell")}>
              <Plus className="w-4 h-4 mr-2" />
              List for sale
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {listings.map((l) => (
            <div key={l.id} className="relative">
              <ListingCard
                listing={l}
                onViewDetails={() => {}}
                onBuyNow={() => {}}
                currentUser={{ username: currentUsername, role: "user" }}
              />
              <div className="absolute top-4 right-4">
                <Button variant="ghost" size="sm" onClick={() => { /* edit flow */ }}>
                  <Edit3 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}