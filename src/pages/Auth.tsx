import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, Car } from 'lucide-react';
import { z } from 'zod';
import logo from '@/assets/autokopers-logo.png';

const authSchema = z.object({
  email: z.string().email('Neteisingas el. pašto formatas'),
  password: z.string().min(6, 'Slaptažodis turi būti bent 6 simbolių'),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'email') fieldErrors.email = err.message;
          if (err.path[0] === 'password') fieldErrors.password = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Klaida',
              description: 'Neteisingas el. paštas arba slaptažodis',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Klaida',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Sėkmingai prisijungta!',
            description: 'Sveiki sugrįžę',
          });
          navigate('/');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Klaida',
              description: 'Šis el. paštas jau užregistruotas',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Klaida',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Paskyra sukurta!',
            description: 'Dabar galite naudotis visomis funkcijomis',
          });
          navigate('/');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/20 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-6 md:p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <img src={logo} alt="AutoKopers" className="h-12 mb-3" />
            <h1 className="text-xl font-display font-bold text-foreground">AutoAgregator</h1>
            <p className="text-sm text-muted-foreground">by AUTOKOPERS</p>
          </div>

          {/* Tabs */}
          <div className="flex mb-6 bg-muted rounded-lg p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                isLogin ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Prisijungti
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                !isLogin ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Registruotis
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">El. paštas</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jusu@el.pastas.lt"
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Slaptažodis</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={errors.password ? 'border-destructive' : ''}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isLogin ? 'Prisijungti' : 'Sukurti paskyrą'}
            </Button>
          </form>

          {/* Back link */}
          <div className="mt-6 text-center">
            <a href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2">
              <Car className="w-4 h-4" />
              Grįžti į skelbimus
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
