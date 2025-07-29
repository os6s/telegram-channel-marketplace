import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Shield, Star, Users } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

interface Guarantor {
  id: string;
  username: string;
  displayName: string;
  rating: number;
  completedDeals: number;
  isVerified: boolean;
  avatarUrl?: string;
  description: string;
}

interface GuarantorCardProps {
  guarantor: Guarantor;
  onStartChat: (guarantor: Guarantor) => void;
}

export function GuarantorCard({ guarantor, onStartChat }: GuarantorCardProps) {
  const { t } = useLanguage();

  const handleStartChat = () => {
    // Open Telegram chat with the guarantor
    const telegramUrl = `https://t.me/${guarantor.username}`;
    window.open(telegramUrl, '_blank');
    onStartChat(guarantor);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <Avatar className="w-12 h-12">
            <AvatarImage src={guarantor.avatarUrl} />
            <AvatarFallback className="bg-blue-500 text-white">
              {guarantor.displayName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-semibold text-foreground truncate">
                {guarantor.displayName}
              </h3>
              {guarantor.isVerified && (
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-1">@{guarantor.username}</p>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {guarantor.description}
            </p>
            
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">{guarantor.rating}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {guarantor.completedDeals} deals completed
                </span>
              </div>
            </div>
            
            <Button 
              onClick={handleStartChat}
              size="sm" 
              className="w-full bg-telegram-500 hover:bg-telegram-600"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Start Chat
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}