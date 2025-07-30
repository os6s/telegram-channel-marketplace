import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { insertChannelSchema, type InsertChannel } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { telegramWebApp } from "@/lib/telegram";

const categories = [
  { value: 'Cryptocurrency', label: '🪙 Cryptocurrency' },
  { value: 'NFT Collection', label: '🎁 NFT Collection' },
  { value: 'Technology', label: '💻 Technology' },
  { value: 'Gaming', label: '🎮 Gaming' },
  { value: 'Entertainment', label: '🎬 Entertainment' },
  { value: 'Education', label: '🎓 Education' },
  { value: 'Business', label: '💼 Business' },
  { value: 'News', label: '📰 News' },
];

export default function SellChannel() {
  const [step, setStep] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertChannel>({
    resolver: zodResolver(insertChannelSchema),
    defaultValues: {
      name: "",
      username: "",
      description: "",
      category: "",
      subscribers: 0,
      engagement: "0",
      growth: "0",
      price: "0",
      avatarUrl: "",
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: InsertChannel & { sellerId: string }) => {
      const response = await apiRequest('POST', '/api/channels', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Channel Listed Successfully",
        description: "Your channel has been added to the marketplace",
      });
      setStep(3);
    },
    onError: (error) => {
      toast({
        title: "Failed to List Channel",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: InsertChannel) => {
    if (!telegramWebApp.user) {
      toast({
        title: "Authentication Required",
        description: "Please open this app through Telegram to list channels",
        variant: "destructive",
      });
      return;
    }

    // Create or get user first
    const telegramId = telegramWebApp.user.id.toString();
    try {
      let userId = telegramId;
      
      // Try to get existing user
      const userResponse = await fetch(`/api/users?telegramId=${telegramId}`);
      if (!userResponse.ok) {
        // Create user if doesn't exist
        const createUserResponse = await apiRequest('POST', '/api/users', {
          telegramId: telegramId,
          username: telegramWebApp.user.username,
          firstName: telegramWebApp.user.first_name,
          lastName: telegramWebApp.user.last_name,
        });
        
        if (!createUserResponse.ok) {
          throw new Error('Failed to create user account');
        }
        
        const newUser = await createUserResponse.json();
        userId = newUser.id;
      } else {
        const existingUser = await userResponse.json();
        userId = existingUser.id;
      }

      // Now create the channel with the proper user ID
      createChannelMutation.mutate({
        ...data,
        sellerId: userId,
      });
    } catch (error) {
      console.error('Error creating channel:', error);
      toast({
        title: "Failed to List Channel",
        description: error instanceof Error ? error.message : "Authentication error occurred",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      // Navigate back to marketplace
      window.history.back();
    }
  };

  if (step === 3) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Channel Listed!</h2>
            <p className="text-gray-600 mb-6">
              Your channel has been successfully added to the marketplace. Buyers can now discover and purchase it.
            </p>
            <div className="space-y-2">
              <Button 
                className="w-full bg-telegram-500 hover:bg-telegram-600"
                onClick={() => window.history.back()}
              >
                Back to Marketplace
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setStep(1);
                  form.reset();
                }}
              >
                List Another Channel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Sell Your Channel</h1>
              <p className="text-xs text-gray-500">Step {step} of 2</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white px-4 pb-4">
        <div className="flex items-center space-x-2">
          <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-telegram-500' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-telegram-500' : 'bg-gray-200'}`} />
        </div>
      </div>

      <div className="px-4 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Channel Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Channel Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Crypto Bulls" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Channel Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">@</span>
                            <Input className="pl-8" placeholder="cryptobulls_official" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.value} value={category.value}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe your channel, its content, and what makes it valuable..."
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="avatarUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avatar URL (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full bg-telegram-500 hover:bg-telegram-600"
                    disabled={!form.formState.isValid}
                  >
                    Next: Channel Metrics
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Channel Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="subscribers"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subscriber Count</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="47200"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="engagement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Engagement Rate (%)</FormLabel>
                            <FormControl>
                              <Input placeholder="8.4" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="growth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Growth (%)</FormLabel>
                            <FormControl>
                              <Input placeholder="12.3" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Pricing</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price (TON)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input placeholder="2500" {...field} />
                              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                                TON
                              </span>
                            </div>
                          </FormControl>
                          <FormMessage />
                          {field.value && (
                            <p className="text-sm text-gray-500">
                              ≈ ${(parseFloat(field.value) * 5.1).toLocaleString()} USD
                            </p>
                          )}
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-orange-800 mb-1">Verification Required</p>
                        <p className="text-orange-700">
                          After listing, you'll need to provide a bot token to verify ownership of your channel.
                          This ensures secure transfers through our automated escrow system.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex space-x-3">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit"
                    className="flex-1 bg-telegram-500 hover:bg-telegram-600"
                    disabled={createChannelMutation.isPending}
                  >
                    {createChannelMutation.isPending ? "Creating..." : "List Channel"}
                  </Button>
                </div>
              </div>
            )}

          </form>
        </Form>
      </div>
    </div>
  );
}
