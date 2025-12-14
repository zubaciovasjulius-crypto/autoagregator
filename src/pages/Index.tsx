import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import SearchFilters, { Filters } from '@/components/SearchFilters';
import CarCard from '@/components/CarCard';
import SourceStats from '@/components/SourceStats';
import { useScrapeListings } from '@/hooks/useScrapeListings';
import { Car, TrendingUp, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { listings, isLoading, lastUpdated, scrapeListings, scrapeSingleSource } = useScrapeListings();
  
  const [filters, setFilters] = useState<Filters>({
    search: '',
    brand: '',
    country: '',
    source: '',
    minPrice: '',
    maxPrice: '',
    minYear: '',
    maxYear: '',
    fuel: '',
  });

  const filteredCars = useMemo(() => {
    return listings.filter((car) => {
      const matchesSearch = filters.search === '' || 
        car.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        car.brand.toLowerCase().includes(filters.search.toLowerCase()) ||
        car.model.toLowerCase().includes(filters.search.toLowerCase());

      const matchesBrand = !filters.brand || filters.brand === 'all' || car.brand === filters.brand;
      const matchesCountry = !filters.country || filters.country === 'all' || car.country === filters.country;
      const matchesSource = !filters.source || filters.source === 'all' || car.source === filters.source;
      const matchesFuel = !filters.fuel || filters.fuel === 'all' || car.fuel === filters.fuel;

      const matchesMinPrice = !filters.minPrice || car.price >= parseInt(filters.minPrice);
      const matchesMaxPrice = !filters.maxPrice || car.price <= parseInt(filters.maxPrice);
      const matchesMinYear = !filters.minYear || car.year >= parseInt(filters.minYear);
      const matchesMaxYear = !filters.maxYear || car.year <= parseInt(filters.maxYear);

      return matchesSearch && matchesBrand && matchesCountry && matchesSource && 
             matchesFuel && matchesMinPrice && matchesMaxPrice && matchesMinYear && matchesMaxYear;
    });
  }, [filters, listings]);

  const sourceCounts = useMemo(() => {
    return listings.reduce((acc, car) => {
      acc[car.source] = (acc[car.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [listings]);

  const stats = useMemo(() => ({
    totalListings: listings.length,
    avgPrice: listings.length > 0 
      ? Math.round(listings.reduce((sum, car) => sum + car.price, 0) / listings.length)
      : 0,
    sourcesCount: Object.keys(sourceCounts).length,
  }), [listings, sourceCounts]);

  const handleRefresh = () => {
    const options = {
      brand: filters.brand && filters.brand !== 'all' ? filters.brand : undefined,
      maxPrice: filters.maxPrice ? parseInt(filters.maxPrice) : undefined,
      minYear: filters.minYear ? parseInt(filters.minYear) : undefined,
    };
    scrapeListings(options);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Refresh Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Automobilių skelbimai</h2>
            {lastUpdated && (
              <p className="text-sm text-muted-foreground">
                Atnaujinta: {lastUpdated.toLocaleTimeString('lt-LT')}
              </p>
            )}
          </div>
          <Button 
            onClick={handleRefresh} 
            disabled={isLoading}
            className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isLoading ? 'Ieškoma...' : 'Atnaujinti skelbimus'}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-card rounded-xl p-5 border border-border/50 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Car className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Viso skelbimų</p>
                <p className="text-2xl font-display font-bold text-foreground">{stats.totalListings}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-card rounded-xl p-5 border border-border/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vidutinė kaina</p>
                <p className="text-2xl font-display font-bold text-foreground">
                  {stats.avgPrice > 0 
                    ? new Intl.NumberFormat('lt-LT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(stats.avgPrice)
                    : '—'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-card rounded-xl p-5 border border-border/50 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Šaltinių</p>
                <p className="text-2xl font-display font-bold text-foreground">{stats.sourcesCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <SourceStats 
              sourceCounts={sourceCounts} 
              onSourceClick={(source) => {
                if (source === 'Mobile.de') scrapeSingleSource('mobile.de');
                else if (source === 'AutoScout24') scrapeSingleSource('autoscout24');
                else if (source === 'Autoplius.lt') scrapeSingleSource('autoplius');
              }}
              isLoading={isLoading}
            />
            
            {/* Info Card */}
            <div className="bg-gradient-card rounded-xl p-4 border border-primary/30">
              <h4 className="font-display font-semibold text-foreground mb-2">Kaip naudoti?</h4>
              <p className="text-sm text-muted-foreground">
                Paspausk "Atnaujinti skelbimus" arba šaltinio pavadinimą, kad surinktum naujausius skelbimus iš Europos portalų.
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            <SearchFilters 
              filters={filters} 
              onFilterChange={setFilters} 
              resultsCount={filteredCars.length}
            />

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
                  <p className="text-muted-foreground">Renkame skelbimus iš portalų...</p>
                </div>
              </div>
            )}

            {/* Cars Grid */}
            {!isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCars.map((car, index) => (
                  <CarCard key={car.id} car={car} index={index} />
                ))}
              </div>
            )}

            {!isLoading && filteredCars.length === 0 && (
              <div className="text-center py-16">
                <Car className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                  Skelbimų nerasta
                </h3>
                <p className="text-muted-foreground">
                  Pabandykite pakeisti paieškos kriterijus arba atnaujinti skelbimus
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>AutoAgregator © {new Date().getFullYear()} • Asmeninis automobilių skelbimų agregatorius</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
