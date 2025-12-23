import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';
import { api } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [plz, setPlz] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSignUp) {
        // Validate email format
        if (!email || !email.includes('@')) {
          toast.error('Please enter a valid email address.');
          setIsLoading(false);
          return;
        }

        // Check if email already exists
        const emailExists = await api.checkEmailExists(email);
        if (emailExists) {
          toast.error('This email address is already registered. Please sign in instead or use a different email address.');
          setIsLoading(false);
          return;
        }

        // Check if username already exists (if provided)
        if (username && username.trim()) {
          const usernameExists = await api.checkUsernameExists(username.trim());
          if (usernameExists) {
            toast.error('This username is already taken. Please choose a different username.');
            setIsLoading(false);
            return;
          }
        }

        try {
          await signUp(email, password, username.trim() || undefined, plz.trim() || undefined);
          toast.success('Account created successfully! If your account requires confirmation, please verify your email before signing in.');
          setIsSignUp(false);
          setEmail('');
          setPassword('');
          setUsername('');
          setPlz('');
          return;
        } catch (signupError: any) {
          const errorMsg = signupError.message?.toLowerCase() || '';
          
          if (errorMsg.includes('username') && (errorMsg.includes('unique') || errorMsg.includes('duplicate'))) {
            toast.error('This username is already taken. Please choose a different username.');
            setIsLoading(false);
            return;
          }
          
          throw signupError;
        }
      }

      await signIn(email, password);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        toast.success('Signed in');
        navigate('/');
        return;
      }
      
      // Get the role from user_roles table
      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);
      
      if (roleError) {
        toast.success('Signed in');
        navigate('/');
        return;
      }
      
      const isAdmin = roles?.some((r: any) => r.role === 'admin') || false;
      
      
      if (isAdmin) {
        toast.success('Welcome back, admin!');
        navigate('/admin/dashboard');
      } else {
        toast.success('Signed in');
        navigate('/');
      }
    } catch (error: any) {
      // Error messages are already user-friendly from useAuth
      toast.error(error.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">{isSignUp ? 'Sign Up' : 'Sign In'}</CardTitle>
          <CardDescription className="text-center">
            {isSignUp ? 'Create an account to access MealDeal features' : 'Sign in to access MealDeal features'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" type="text" placeholder="Your name" value={username} onChange={(e) => setUsername(e.target.value)} disabled={isLoading} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="plz">PLZ</Label>
                <Input id="plz" type="text" value={plz} onChange={(e) => setPlz(e.target.value)} disabled={isLoading} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>

            <div className="text-center mt-2">
              <button type="button" className="text-sm text-primary underline" onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp ? 'Have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
