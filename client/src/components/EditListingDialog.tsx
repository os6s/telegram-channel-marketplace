// client/src/components/EditListingDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { listingSchema } from "@/pages/sell/utils/schemas"; // ✅ نستعمل نفس schema
import { useLanguage } from "@/contexts/language-context";

export function EditListingDialog({ open, onOpenChange, listing }: any) {
  const { toast } = useToast();
  const { t } = useLanguage();

  const form = useForm<any>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      title: listing?.title || "",
      description: listing?.description || "",
      price: listing?.price || "",
      currency: listing?.currency || "TON",
    },
  });

  async function onSubmit(values: any) {
    try {
      await apiRequest("PUT", `/api/listings/${listing.id}`, values);
      toast({ title: t("toast.updated") || "Listing updated ✅" });
      onOpenChange(false);
      window.location.reload();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Update failed", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("channel.edit") || "Edit Listing"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <Input placeholder="Title" {...form.register("title")} />
          <Textarea placeholder="Description" rows={3} {...form.register("description")} />
          <div className="flex gap-2">
            <Input type="number" placeholder="Price" {...form.register("price")} />
            <select {...form.register("currency")} className="border rounded px-2">
              <option value="TON">TON</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button type="submit">{t("common.save") || "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}