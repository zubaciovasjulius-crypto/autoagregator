import { RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/autokopers-logo.png';

interface HeaderProps {
  isAutoRefresh?: boolean;
  onToggleAutoRefresh?: () => void;
}

const Header = ({ isAutoRefresh, onToggleAutoRefresh }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img 
              src={logo} 
              alt="AutoKopers" 
              className="h-8 md:h-10 w-auto"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button 
              variant={isAutoRefresh ? 'default' : 'ghost'} 
              size="sm"
              onClick={onToggleAutoRefresh}
              className={`gap-1 text-xs md:text-sm ${isAutoRefresh ? 'bg-gradient-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <RefreshCw className={`w-4 h-4 ${isAutoRefresh ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isAutoRefresh ? 'Auto ON' : 'Auto OFF'}</span>
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 md:h-9 md:w-9">
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
