import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertChannelSchema, type InsertChannel } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { EnhancedWalletConnect } from "@/components/enhanced-wallet-connect";
import { ArrowLeft, Upload, Check, AlertCircle, Users, DollarSign, Shield, Bot } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const categories = [
  { value: 'business', label: 'Business' },
  { value: 'crypto', label: 'Crypto & Finance' },
  { value: 'news', label: 'News & Media' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'education', label: 'Education' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'technology', label: 'Technology' },
];

export default function EnhancedSellChannel() {
  const [step, setStep] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();

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
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: InsertChannel) => {
      // For development/testing with mock data
      console.log('Creating channel listing:', data);
      
      // Create channel with mock seller ID for development
      const channelData = {
        ...data,
        sellerId: 'mock-user-id',
      };

      return apiRequest('POST', '/api/channels', channelData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Success!",
        description: "Your channel has been listed successfully.",
      });
      setStep(4); // Success step
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to list channel. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertChannel) => {
    if (step === 3) {
      createChannelMutation.mutate(data);
    } else {
      setStep(step + 1);
    }
  };

  const nextStep = () => {
    form.trigger().then((isValid) => {
      if (isValid) {
        setStep(step + 1);
      } else {
        // Show form errors if validation fails
        console.log('Form validation errors:', form.formState.errors);
        toast({
          title: "Form Error",
          description: "Please check all required fields are filled correctly.",
          variant: "destructive",
        });
      }
    });
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  return (
    <div className={`min-h-screen bg-background ${language === 'ar' ? 'font-arabic' : ''}`}>
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <div className="bg-primary/10 p-2 rounded-lg">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">{t('sellChannelTitle')}</h1>
            </div>
            <EnhancedWalletConnect />
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="px-4 py-4 bg-card border-b border-border">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= num 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {step > num ? <Check className="w-4 h-4" /> : num}
              </div>
              {num < 4 && (
                <div className={`w-12 h-0.5 mx-2 ${
                  step > num ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center mt-2">
          <p className="text-sm text-muted-foreground">
            {step === 1 && 'Basic Information'}
            {step === 2 && 'Channel Details'}
            {step === 3 && 'Verification & Pricing'}
            {step === 4 && 'Complete!'}
          </p>
        </div>
      </div>

      <div className="px-4 py-6">
        <div className="max-w-md mx-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Step 1: Basic Information */}
              {step === 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Channel Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('channelName')}</FormLabel>
                          <FormControl>
                            <Input placeholder="My Awesome Channel" {...field} />
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
                          <FormLabel>{t('channelUsername')}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">@</span>
                              <Input placeholder="myawesomechannel" className="pl-8" {...field} />
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
                          <FormLabel>{t('category')}</FormLabel>
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
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Channel Details */}
              {step === 2 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Channel Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('description')}</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe your channel, target audience, content type, and what makes it valuable..."
                              className="min-h-[120px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subscribers"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('subscriberCount')}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                              <Input 
                                type="number" 
                                placeholder="10000" 
                                className="pl-10"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Verification & Pricing */}
              {step === 3 && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Pricing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('price')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  placeholder="100.00" 
                                  className="pl-10"
                                  {...field}
                                />
                                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                                  TON
                                </span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Channel Verification
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Alert className="mb-4">
                        <Bot className="h-4 w-4" />
                        <AlertDescription>
                          Channel verification will be done automatically after listing. Make sure you have admin access to add our verification bot.
                        </AlertDescription>
                      </Alert>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="engagement"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Engagement Rate (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  step="0.01"
                                  placeholder="5.25"
                                  {...field}
                                />
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
                              <FormLabel>Growth Rate (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  step="0.01"
                                  placeholder="2.5"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step 4: Success */}
              {step === 4 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Channel Listed Successfully!</h3>
                    <p className="text-muted-foreground mb-6">
                      Your channel is now live on the marketplace. Buyers can discover and purchase it through secure escrow.
                    </p>
                    <div className="space-y-3">
                      <Button onClick={() => window.location.href = '/'} className="w-full">
                        View Marketplace
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setStep(1);
                        form.reset();
                      }} className="w-full">
                        List Another Channel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Navigation Buttons */}
              {step < 4 && (
                <div className="flex justify-between pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={prevStep}
                    disabled={step === 1}
                  >
                    {t('back')}
                  </Button>
                  
                  <Button 
                    type={step === 3 ? "submit" : "button"}
                    onClick={step === 3 ? undefined : (e) => {
                      e.preventDefault();
                      nextStep();
                    }}
                    disabled={createChannelMutation.isPending}
                    className="ml-auto"
                  >
                    {createChannelMutation.isPending 
                      ? "Creating..." 
                      : step === 3 
                        ? t('listChannel')
                        : "Next"
                    }
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}