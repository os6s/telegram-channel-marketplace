import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Shield, Crown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { type Channel } from "@shared/schema";

interface AdminControlsProps {
  channel: Channel;
  currentUser?: { username?: string };
}

export function AdminControls({ channel, currentUser }: AdminControlsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if current user is @Os6s7 (admin)
  const isAdmin = currentUser?.username === "Os6s7";

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      setIsDeleting(true);
      
      // Simulate API call for channel deletion
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In production, this would be:
      // const response = await fetch(`/api/channels/${channelId}`, { method: 'DELETE' });
      // if (!response.ok) throw new Error('Failed to delete channel');
      
      console.log(`Admin @Os6s7 deleted channel: ${channelId}`);
      return channelId;
    },
    onSuccess: (deletedChannelId) => {
      // Update local cache to remove deleted channel
      queryClient.setQueryData(['/api/channels'], (oldData: Channel[] | undefined) => {
        return oldData?.filter(ch => ch.id !== deletedChannelId) || [];
      });
      
      // Invalidate and refetch channels
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      
      toast({
        title: "Channel Deleted",
        description: `Channel "${channel.name}" has been permanently removed by admin @Os6s7.`,
      });
      
      setIsDeleting(false);
    },
    onError: (error) => {
      console.error('Failed to delete channel:', error);
      toast({
        title: "Deletion Failed",
        description: "Failed to delete the channel. Please try again.",
        variant: "destructive",
      });
      setIsDeleting(false);
    },
  });

  if (!isAdmin) {
    return null; // Hide admin controls from non-admin users
  }

  return (
    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
          <Crown className="h-4 w-4" />
          Admin Controls
          <Badge variant="destructive" className="text-xs">
            @Os6s7 Only
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
          <div>
            <p className="font-medium text-sm">Channel: {channel.name}</p>
            <p className="text-xs text-muted-foreground">@{channel.username}</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm" 
                disabled={isDeleting}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-3 w-3" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Channel Listing</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to permanently delete "{channel.name}"? This action cannot be undone and will remove the channel from the marketplace.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteChannelMutation.mutate(channel.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        
        <div className="text-xs text-muted-foreground bg-background/30 p-2 rounded">
          <Shield className="h-3 w-3 inline mr-1" />
          Admin privilege: Full channel management access
        </div>
      </CardContent>
    </Card>
  );
}