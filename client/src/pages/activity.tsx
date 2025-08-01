import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Activity as ActivityIcon, TrendingUp, Users, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { useTelegram } from "@/hooks/use-telegram";
import { telegramWebApp } from "@/lib/telegram";
import { type Activity } from "@shared/schema";

export default function ActivityPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useLanguage();
  const { hapticFeedback } = useTelegram();
  
  // Get user info from Telegram
  const telegramUser = telegramWebApp.user;
  const userId = telegramUser?.id.toString() || 'temp-user-id';

  // Fetch user activities
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['/api/activities', userId, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('userId', userId);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/activities?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json() as Activity[];
    },
  });

  const handleBack = () => {
    hapticFeedback.selection();
    window.history.back();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'refunded': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActivityStats = () => {
    const completed = activities.filter(a => a.status === 'completed').length;
    const totalVolume = activities
      .filter(a => a.status === 'completed')
      .reduce((sum, activity) => sum + parseFloat(activity.amount), 0);
    
    return {
      completed,
      totalVolume: totalVolume.toFixed(2),
      total: activities.length
    };
  };

  const stats = getActivityStats();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="bg-primary/10 p-2 rounded-lg">
                <ActivityIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Activity</h1>
                <p className="text-xs text-muted-foreground">Your channel transaction history</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* Info Banner */}
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <ActivityIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">Activity Tracking</p>
                <p>Track all your channel purchases and sales. Monitor transaction history, volumes, and completion status in real-time.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.completed}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.totalVolume}</div>
              <div className="text-sm text-muted-foreground">TON Volume</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Activities</div>
            </CardContent>
          </Card>
        </div>

        {/* Activities List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Activities</h2>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-muted rounded-full animate-pulse"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-1/3 animate-pulse"></div>
                        <div className="h-3 bg-muted rounded w-1/4 animate-pulse"></div>
                        <div className="h-3 bg-muted rounded w-1/2 animate-pulse"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-muted-foreground text-6xl mb-4">📊</div>
                <h3 className="font-medium text-foreground mb-2">No activities found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Try adjusting your search terms' : 'Your transaction history will appear here'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <Card key={activity.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-medium text-foreground">Channel Transaction</h3>
                          <Badge className={getStatusColor(activity.status)}>
                            {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-2">
                            <span>Amount:</span>
                            <span className="font-medium text-foreground">{activity.amount} TON</span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(activity.completedAt)}</span>
                          </div>
                          
                          {activity.transactionHash && (
                            <div className="flex items-center space-x-2">
                              <span>TX Hash:</span>
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                {activity.transactionHash.slice(0, 8)}...{activity.transactionHash.slice(-8)}
                              </code>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}