import logo from '@/assets/autokopers-logo.png';

const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center h-14 md:h-16">
          <div className="flex items-center gap-3">
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
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
