import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function ActivityDialog({
  open, onOpenChange, activityId,
}: { open: boolean; onOpenChange: (v: boolean) => void; activityId: string | null; }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[96vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-0 shadow-lg">
          {activityId && (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <div className="text-sm font-semibold">Activity · #{activityId}</div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4 text-sm">
                {/* details here if needed */}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}