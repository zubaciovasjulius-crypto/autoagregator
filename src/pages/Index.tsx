import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { carSources } from '@/data/mockCars';
import { useSavedCars } from '@/hooks/useSavedCars';
import { useAuth } from '@/hooks/useAuth';
import { Bell, ExternalLink, Trash2, Car, LogIn, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

const Index = () => {
  const { user } = useAuth();
  const { savedCars, removeCar, saveCar, loading, fetchSavedCars } = useSavedCars();
  
  // New search form
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');

  useEffect(() => {
    fetchSavedCars();
  }, [fetchSavedCars]);

  // Add new saved search
  const handleAddSearch = async () => {
    if (!user) {
      toast({
        title: 'Prisijunkite',
        description: 'Norėdami išsaugoti paieškas, prisijunkite',
        variant: 'destructive',
      });
      return;
    }

    if (!newBrand.trim() || !newModel.trim()) {
      toast({
        title: 'Užpildykite laukus',
        description: 'Įveskite markę ir modelį',
        variant: 'destructive',
      });
      return;
    }

    const success = await saveCar(
      `search-${newBrand}-${newModel}-${Date.now()}`,
      newBrand.trim(),
      newModel.trim(),
      `${newBrand.trim()} ${newModel.trim()}`
    );

    if (success) {
      setNewBrand('');
      setNewModel('');
    }
  };

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
              Ieškokite automobilių {carSources.length} Europos portaluose
            </p>
          </div>
        </div>
      </section>

      {/* Saved Searches Section */}
      <section className="container mx-auto px-4 py-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Išsaugotos paieškos
        </h2>

        {!user ? (
          <div className="text-center py-8 bg-muted/30 rounded-xl border border-border">
            <LogIn className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-semibold text-foreground mb-2">
              Prisijunkite
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              Išsaugokite paieškas ir gaukite pranešimus
            </p>
            <Link to="/auth">
              <Button size="sm">Prisijungti</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Add new search form */}
            <div className="flex flex-col sm:flex-row gap-2 p-4 bg-muted/30 rounded-xl border border-border">
              <Input
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="Markė (pvz. BMW)"
                className="flex-1"
              />
              <Input
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="Modelis (pvz. X5)"
                className="flex-1"
              />
              <Button onClick={handleAddSearch} className="gap-2">
                <Plus className="w-4 h-4" />
                Pridėti
              </Button>
            </div>

            {/* Saved searches list */}
            {loading ? (
              <div className="text-center py-4">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              </div>
            ) : savedCars.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {savedCars.map((car) => (
                  <div
                    key={car.id}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30"
                  >
                    <Car className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-foreground">
                      {car.brand} {car.model}
                    </span>
                    <button
                      onClick={() => removeCar(car.external_id)}
                      className="p-1 hover:bg-destructive/20 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nėra išsaugotų paieškų. Pridėkite markę ir modelį aukščiau.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Source Links */}
      <section className="container mx-auto px-4 py-6 border-t border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" />
          Automobilių portalai
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {carSources.map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 rounded-xl bg-card hover:bg-primary/10 border border-border transition-all hover:shadow-lg group"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {source.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {source.name}
                </h3>
                <p className="text-sm text-muted-foreground">{source.country}</p>
              </div>
              <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 bg-muted/30 mt-8">
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
