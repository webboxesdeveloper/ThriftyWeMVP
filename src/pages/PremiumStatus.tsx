import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Crown, 
  Calendar, 
  XCircle, 
  CheckCircle2, 
  ArrowLeft,
  Sparkles,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function PremiumStatus() {
  const { userId, isPremium, premiumUntil, subscriptionStatus } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<{
    status: 'free' | 'premium' | 'cancelled' | 'expired';
    premium_until: string | null;
    subscription_started_at: string | null;
    subscription_cancelled_at: string | null;
    subscription_duration_days: number;
    isActive: boolean;
  } | null>(null);
  const [history, setHistory] = useState<Array<{
    subscription_id: string;
    status: string;
    started_at: string;
    expires_at: string;
    cancelled_at: string | null;
    duration_days: number;
    payment_method: string | null;
    amount_paid: number | null;
  }>>([]);

  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    loadSubscriptionData();
  }, [userId, navigate]);

  const loadSubscriptionData = async () => {
    if (!userId) return;

    try {
      const [subData, historyData] = await Promise.all([
        api.getSubscriptionStatus(userId),
        api.getSubscriptionHistory(userId),
      ]);
      
      setSubscription(subData);
      setHistory(historyData || []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load subscription data');
    }
  };

  const handleCancelSubscription = async () => {
    if (!userId || !subscription?.isActive) return;

    if (!confirm('Are you sure you want to cancel your premium subscription? You will retain access until the end of your current billing period.')) {
      return;
    }

    setLoading(true);
    try {
      await api.cancelPremium(userId);
      toast.success('Subscription cancelled successfully. You will retain access until the end of your current period.');
      await loadSubscriptionData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    navigate('/premium/checkout');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const daysRemaining = premiumUntil 
    ? Math.max(0, Math.ceil((new Date(premiumUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Crown className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Premium Status</h1>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {subscription?.isActive ? (
          <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    Premium Active
                  </CardTitle>
                  <CardDescription className="mt-2">
                    You have an active premium subscription
                  </CardDescription>
                </div>
                <Badge variant="default" className="bg-green-600">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-background/50 border">
                  <p className="text-sm text-muted-foreground mb-2">Expires</p>
                  <p className="text-xl font-bold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    {formatDate(premiumUntil?.toString() || null)}
                  </p>
                  {daysRemaining > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (daysRemaining / subscription.subscription_duration_days) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-background/50 border">
                  <p className="text-sm text-muted-foreground mb-2">Started</p>
                  <p className="text-xl font-bold">
                    {formatDate(subscription.subscription_started_at)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Duration: {subscription.subscription_duration_days} days
                  </p>
                </div>
              </div>
              <Separator />
              <Button
                variant="destructive"
                onClick={handleCancelSubscription}
                disabled={loading}
                className="w-full"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Subscription
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                Free Account
              </CardTitle>
              <CardDescription>
                Upgrade to premium to unlock all features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleUpgrade} className="w-full" size="lg">
                <Crown className="mr-2 h-5 w-5" />
                Upgrade to Premium
              </Button>
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Subscription History</CardTitle>
              <CardDescription>
                View your past subscriptions and payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {history.map((sub) => (
                  <div
                    key={sub.subscription_id}
                    className="p-4 border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            sub.status === 'active'
                              ? 'default'
                              : sub.status === 'cancelled'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                        </Badge>
                        {sub.payment_method && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            {sub.payment_method}
                          </Badge>
                        )}
                      </div>
                      {sub.amount_paid && (
                        <p className="font-semibold">€{sub.amount_paid.toFixed(2)}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div>
                        <p>Started: {formatDate(sub.started_at)}</p>
                        <p>Expires: {formatDate(sub.expires_at)}</p>
                      </div>
                      <div>
                        <p>Duration: {sub.duration_days} days</p>
                        {sub.cancelled_at && (
                          <p>Cancelled: {formatDate(sub.cancelled_at)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

