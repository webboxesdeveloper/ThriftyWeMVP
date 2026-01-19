import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Crown, 
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';

const PRICING_PLANS = [
  {
    id: '30days',
    name: '1 Month',
    durationDays: 30,
    price: 9.99,
    popular: false,
  },
  {
    id: '90days',
    name: '3 Months',
    durationDays: 90,
    price: 24.99,
    popular: true,
    savings: 'Save 17%',
  },
  {
    id: '365days',
    name: '1 Year',
    durationDays: 365,
    price: 79.99,
    popular: false,
    savings: 'Save 33%',
  },
];

export default function PremiumCheckout() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string>('90days');
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal'>('stripe');

  if (!userId) {
    navigate('/login');
    return null;
  }

  const handleCheckout = async () => {
    if (!userId) return;

    const plan = PRICING_PLANS.find(p => p.id === selectedPlan);
    if (!plan) return;

    setProcessing(true);
    try {
      // In a real implementation, this would:
      // 1. Create a payment session with Stripe/PayPal
      // 2. Redirect to payment provider
      // 3. On successful payment, activate premium via webhook
      
      // For now, we'll simulate payment and activate directly
      // TODO: Replace with actual payment integration
      toast.info('Processing payment...');
      
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Activate premium subscription
      await api.activatePremium(
        userId,
        plan.durationDays,
        `payment_${Date.now()}`, // Mock payment ID
        paymentMethod,
        plan.price
      );
      
      toast.success('Premium activated successfully!');
      navigate('/premium/status');
    } catch (error: any) {
      toast.error(error?.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const selectedPlanData = PRICING_PLANS.find(p => p.id === selectedPlan);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/premium/status')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Crown className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Upgrade to Premium</h1>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pricing Plans */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">Choose Your Plan</h2>
              <p className="text-muted-foreground">
                Select the premium plan that works best for you
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PRICING_PLANS.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                const monthlyPrice = plan.price / (plan.durationDays / 30);
                
                return (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all relative overflow-hidden ${
                      isSelected
                        ? 'ring-2 ring-primary border-primary shadow-lg scale-105'
                        : 'hover:border-primary/50 hover:shadow-md'
                    } ${plan.popular ? 'border-primary/30 bg-primary/5' : ''}`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-center py-1.5 text-xs font-semibold">
                        ⭐ Most Popular
                      </div>
                    )}
                    <CardHeader className={plan.popular ? 'pt-8' : ''}>
                      <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                      <div className="mt-4 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold">€{plan.price.toFixed(2)}</span>
                          {plan.savings && (
                            <Badge variant="default" className="bg-green-600">
                              {plan.savings}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          €{monthlyPrice.toFixed(2)}/month
                        </p>
                        <CardDescription className="mt-2">
                          {plan.durationDays === 30 && 'Billed monthly'}
                          {plan.durationDays === 90 && 'Billed every 3 months'}
                          {plan.durationDays === 365 && 'Billed annually'}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isSelected && (
                        <div className="flex items-center gap-2 text-primary font-semibold bg-primary/10 py-2 px-3 rounded-lg">
                          <CheckCircle2 className="h-5 w-5" />
                          <span>Selected Plan</span>
                        </div>
                      )}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          <span>Full premium access</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          <span>Priority support</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          <span>Cancel anytime</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Payment Method Selection */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Method
                </CardTitle>
                <CardDescription>Choose how you'd like to pay securely</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant={paymentMethod === 'stripe' ? 'default' : 'outline'}
                  className={`w-full justify-between h-auto py-4 ${paymentMethod === 'stripe' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setPaymentMethod('stripe')}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-background">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Credit/Debit Card</div>
                      <div className="text-xs text-muted-foreground">Visa, Mastercard, Amex</div>
                    </div>
                  </div>
                  {paymentMethod === 'stripe' && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </Button>
                <Button
                  variant={paymentMethod === 'paypal' ? 'default' : 'outline'}
                  className={`w-full justify-between h-auto py-4 ${paymentMethod === 'paypal' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setPaymentMethod('paypal')}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-background">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">PayPal</div>
                      <div className="text-xs text-muted-foreground">Pay with your PayPal account</div>
                    </div>
                  </div>
                  {paymentMethod === 'paypal' && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </Button>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  🔒 All payments are secure and encrypted. We never store your payment details.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background shadow-lg">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {selectedPlanData && (
                  <>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Plan</span>
                        <span className="font-bold">{selectedPlanData.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="font-semibold">{selectedPlanData.durationDays} days</span>
                      </div>
                      <Separator className="my-4" />
                      <div className="flex justify-between items-center text-xl font-bold">
                        <span>Total</span>
                        <span className="text-primary text-2xl">€{selectedPlanData.price.toFixed(2)}</span>
                      </div>
                      {selectedPlanData.savings && (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                          <Sparkles className="h-4 w-4" />
                          <span className="font-semibold">{selectedPlanData.savings}!</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-4 border-t bg-muted/30 p-4 rounded-lg">
                      <p className="font-semibold text-sm mb-2">What's included:</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <span>Access to all premium features</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <span>Priority customer support</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <span>Cancel anytime, no questions asked</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <span>Instant activation</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleCheckout}
                      disabled={processing}
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg"
                      size="lg"
                    >
                      {processing ? (
                        <>
                          <Sparkles className="mr-2 h-5 w-5 animate-spin" />
                          Processing Payment...
                        </>
                      ) : (
                        <>
                          <Crown className="mr-2 h-5 w-5" />
                          Complete Purchase
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      By completing your purchase, you agree to our Terms of Service
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

