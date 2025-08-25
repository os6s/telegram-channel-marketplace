// client/src/components/EditListingDialog.tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Listing } from "@shared/schema";

interface EditListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: Listing;
  onUpdated?: (updated: Listing) => void; // ✅ Callback لتحديث الواجهة مباشرة
}

export function EditListingDialog({ open, onOpenChange, listing, onUpdated }: EditListingDialogProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState(listing.title || "");
  const [description, setDescription] = useState(listing.description || "");
  const [price, setPrice] = useState(listing.price || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    try {
      setSaving(true);
      const updated = await apiRequest("PATCH", `/api/listings/${listing.id}`, {
        title: title.trim(),
        description: description.trim(),
        price: price.trim(),
      });

      toast({ title: "✅ Saved", description: "Listing updated successfully" });
      if (onUpdated) onUpdated(updated as Listing); // ✅ تحديث state بالواجهة
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "❌ Error",
        description: e?.message || "Failed to update listing",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Listing</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Listing title"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Listing description"
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Price</label>
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.0"
              type="number"
              min="0"
              step="0.01"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-500 text-white">
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}