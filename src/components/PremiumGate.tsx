import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PremiumGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  showUpgrade?: boolean;
}

/**
 * Component that gates premium content behind a premium subscription check
 * Shows fallback content or upgrade prompt if user is not premium
 */
export function PremiumGate({ children, fallback, showUpgrade = true }: PremiumGateProps) {
  const { isPremium, userId } = useAuth();
  const navigate = useNavigate();

  if (!userId) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Premium Feature</CardTitle>
          <CardDescription>
            Please log in to access premium features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/login')}>
            Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isPremium) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showUpgrade) {
      return (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Premium Feature
            </CardTitle>
            <CardDescription>
              This feature is available for premium subscribers only
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>Upgrade to premium to unlock this feature and many more</span>
            </div>
            <Button onClick={() => navigate('/premium/checkout')} className="w-full">
              <Crown className="mr-2 h-4 w-4" />
              Upgrade to Premium
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/premium/status')} 
              className="w-full"
            >
              View Subscription Status
            </Button>
          </CardContent>
        </Card>
      );
    }

    return null;
  }

  return <>{children}</>;
}

