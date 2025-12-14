import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, Heart, User } from 'lucide-react';
import logo from '@/assets/autokopers-logo.png';

const Header = () => {
  const { user, signOut, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 md:h-16">
          <Link to="/" className="flex items-center gap-3">
            <img 
              src={logo} 
              alt="AutoKopers" 
              className="h-8 md:h-10 w-auto"
            />
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg md:text-xl text-foreground leading-tight">
                AutoAgregator
              </span>
              <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider -mt-0.5">
                by AUTOKOPERS
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {loading ? null : user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span className="max-w-[150px] truncate">{user.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Atsijungti</span>
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button variant="default" size="sm" className="gap-2">
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Prisijungti</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
