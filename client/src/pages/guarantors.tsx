import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Shield, Plus, Users } from "lucide-react";
import { GuarantorCard } from "@/components/guarantor-card";
import { useLanguage } from "@/contexts/language-context";

// Only @Os6s7 as guarantor - per user request
const mockGuarantors = [
  {
    id: "1",
    username: "Os6s7",
    displayName: "Os6s7 - Official Guarantor",
    rating: 5.0,
    completedDeals: 500,
    isVerified: true,
    description: "Official platform guarantor with verified identity and complete authority over channel transfers. Available 24/7 for secure transactions."
  }
];

export default function Guarantors() {
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useLanguage();

  // In production, this would fetch from API with admin check
  const { data: guarantors = [], isLoading } = useQuery({
    queryKey: ['/api/guarantors', searchQuery],
    queryFn: async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockGuarantors.filter(g => 
        g.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
    },
  });

  const handleStartChat = (guarantor: any) => {
    console.log('Starting chat with guarantor:', guarantor.username);
  };

  const handleBack = () => {
    window.history.back();
  };

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
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">{t('guarantors')}</h1>
                <p className="text-xs text-muted-foreground">Verified channel transfer guarantors</p>
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
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">What are Guarantors?</p>
                <p>Guarantors are verified professionals who ensure secure channel transfers between buyers and sellers. They act as trusted intermediaries for high-value transactions.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search guarantors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">{guarantors.length}</div>
              <div className="text-sm text-muted-foreground">Active Guarantors</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Shield className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">100%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </CardContent>
          </Card>
        </div>

        {/* Guarantors List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Available Guarantors</h2>
            {/* Admin-only add button would go here */}
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
          ) : guarantors.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-muted-foreground text-6xl mb-4">🛡️</div>
                <h3 className="font-medium text-foreground mb-2">No guarantors found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Try adjusting your search terms' : 'No guarantors are currently available'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {guarantors.map((guarantor) => (
                <GuarantorCard
                  key={guarantor.id}
                  guarantor={guarantor}
                  onStartChat={handleStartChat}
                />
              ))}
            </div>
          )}
        </div>

        {/* Contact Info */}
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium mb-1">Need Help?</p>
              <p>Contact our support team if you need assistance choosing a guarantor or have questions about the process.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}