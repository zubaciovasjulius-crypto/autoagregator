import { useEffect } from 'react';
import Header from '@/components/Header';
import { carSources } from '@/data/mockCars';
import { useSavedCars } from '@/hooks/useSavedCars';
import { useAuth } from '@/hooks/useAuth';
import { Bell, ExternalLink, Trash2, Car, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Index = () => {
  const { user } = useAuth();
  const { savedCars, removeCar, loading, fetchSavedCars } = useSavedCars();

  useEffect(() => {
    fetchSavedCars();
  }, [fetchSavedCars]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/20 to-background py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-4xl font-display font-bold text-foreground mb-2">
              Automobilių paieška Europoje
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {carSources.length} šaltiniai iš visos Europos
            </p>
          </div>
        </div>
      </section>

      {/* Source Links */}
      <section className="container mx-auto px-4 py-8">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" />
          Automobilių šaltiniai
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {carSources.map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-card hover:bg-primary/10 border border-border transition-all hover:shadow-lg group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                {source.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {source.name}
                </h3>
                <p className="text-xs text-muted-foreground">{source.country}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          ))}
        </div>
      </section>

      {/* Saved Searches Section */}
      <section className="container mx-auto px-4 py-8 border-t border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Išsaugotos paieškos
        </h2>

        {!user ? (
          <div className="text-center py-12 bg-muted/30 rounded-xl border border-border">
            <LogIn className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Prisijunkite, kad matytumėte išsaugotas paieškas
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              Išsaugokite automobilius ir gaukite pranešimus apie naujus skelbimus
            </p>
            <Link to="/auth">
              <Button>Prisijungti</Button>
            </Link>
          </div>
        ) : loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : savedCars.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedCars.map((car) => (
              <div
                key={car.id}
                className="flex items-center justify-between p-4 rounded-xl bg-card border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Car className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{car.brand} {car.model}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{car.title}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCar(car.external_id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-xl border border-border">
            <Car className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nėra išsaugotų paieškų
            </h3>
            <p className="text-muted-foreground text-sm">
              Išsaugokite automobilius iš šaltinių, kad gautumėte pranešimus
            </p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            AutoAgregator by AutoKopers © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
