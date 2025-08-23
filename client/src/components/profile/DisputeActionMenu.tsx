// client/src/components/profile/DisputeActionMenu.tsx
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, MessageSquare, Eye } from "lucide-react";

export function DisputeActionMenu({
  onOpenChat,
  onViewDetails,
}: {
  onOpenChat: () => void;
  onViewDetails: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onOpenChat}>
          <MessageSquare className="h-4 w-4 mr-2" /> Open chat
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onViewDetails}>
          <Eye className="h-4 w-4 mr-2" /> View details
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}