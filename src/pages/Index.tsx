import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import SearchFilters, { Filters } from '@/components/SearchFilters';
import CarCard from '@/components/CarCard';
import SourceStats from '@/components/SourceStats';
import { useScrapeListings } from '@/hooks/useScrapeListings';
import { Car, TrendingUp, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { listings, isLoading, lastUpdated, scrapeListings, scrapeSingleSource } = useScrapeListings();
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
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

  const handleRefresh = useCallback(() => {
    if (isLoading) return;
    const options = {
      brand: filters.brand && filters.brand !== 'all' ? filters.brand : undefined,
      maxPrice: filters.maxPrice ? parseInt(filters.maxPrice) : undefined,
      minYear: filters.minYear ? parseInt(filters.minYear) : undefined,
    };
    scrapeListings(options);
  }, [filters, isLoading, scrapeListings]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (isAutoRefresh) {
      intervalRef.current = setInterval(() => {
        handleRefresh();
      }, 5000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoRefresh, handleRefresh]);

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

  return (
    <div className="min-h-screen bg-background">
      <Header 
        isAutoRefresh={isAutoRefresh} 
        onToggleAutoRefresh={() => setIsAutoRefresh(!isAutoRefresh)} 
      />

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        {/* Refresh Button - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
          <div>
            <h2 className="text-lg md:text-2xl font-display font-bold text-foreground">Skelbimai</h2>
            <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
              {lastUpdated && (
                <span>Atnaujinta: {lastUpdated.toLocaleTimeString('lt-LT')}</span>
              )}
              {isAutoRefresh && (
                <span className="text-primary animate-pulse">• Auto kas 5s</span>
              )}
            </div>
          </div>
          <Button 
            onClick={handleRefresh} 
            disabled={isLoading}
            size="sm"
            className="gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90 w-full sm:w-auto"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isLoading ? 'Ieškoma...' : 'Atnaujinti'}
          </Button>
        </div>

        {/* Stats Cards - Mobile optimized */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-8">
          <div className="bg-gradient-card rounded-lg md:rounded-xl p-3 md:p-5 border border-border/50">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Car className="w-4 h-4 md:w-6 md:h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Viso</p>
                <p className="text-lg md:text-2xl font-display font-bold text-foreground">{stats.totalListings}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-card rounded-lg md:rounded-xl p-3 md:p-5 border border-border/50">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 md:w-6 md:h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Vid. kaina</p>
                <p className="text-sm md:text-2xl font-display font-bold text-foreground">
                  {stats.avgPrice > 0 
                    ? `${Math.round(stats.avgPrice / 1000)}k€`
                    : '—'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-card rounded-lg md:rounded-xl p-3 md:p-5 border border-border/50">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Clock className="w-4 h-4 md:w-6 md:h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Šaltinių</p>
                <p className="text-lg md:text-2xl font-display font-bold text-foreground">{stats.sourcesCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Sources horizontal scroll */}
        <div className="lg:hidden mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-hide">
            {['Mobile.de', 'AutoScout24', 'Autoplius.lt', 'Kleinanzeigen', 'Marktplaats'].map((source) => (
              <button
                key={source}
                onClick={() => {
                  const sourceId = source === 'Mobile.de' ? 'mobile.de' 
                    : source === 'AutoScout24' ? 'autoscout24'
                    : source === 'Autoplius.lt' ? 'autoplius'
                    : source === 'Kleinanzeigen' ? 'kleinanzeigen'
                    : 'marktplaats';
                  scrapeSingleSource(sourceId as any);
                }}
                disabled={isLoading}
                className="flex-shrink-0 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/50 text-xs font-medium text-foreground disabled:opacity-50"
              >
                {source} ({sourceCounts[source] || 0})
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Sidebar - Desktop only */}
          <div className="hidden lg:block lg:col-span-1 space-y-6">
            <SourceStats 
              sourceCounts={sourceCounts} 
              onSourceClick={(source) => {
                const sourceId = source === 'Mobile.de' ? 'mobile.de' 
                  : source === 'AutoScout24' ? 'autoscout24'
                  : source === 'Autoplius.lt' ? 'autoplius'
                  : source === 'Kleinanzeigen' ? 'kleinanzeigen'
                  : 'marktplaats';
                scrapeSingleSource(sourceId as any);
              }}
              isLoading={isLoading}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-4 md:space-y-6">
            <SearchFilters 
              filters={filters} 
              onFilterChange={setFilters} 
              resultsCount={filteredCars.length}
            />

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8 md:py-16">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 md:w-12 md:h-12 mx-auto text-primary animate-spin mb-3 md:mb-4" />
                  <p className="text-sm md:text-base text-muted-foreground">Renkame skelbimus...</p>
                </div>
              </div>
            )}

            {/* Cars Grid - Mobile: 1 col, Tablet: 2 cols, Desktop: 3 cols */}
            {!isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                {filteredCars.map((car, index) => (
                  <CarCard key={car.id} car={car} index={index} />
                ))}
              </div>
            )}

            {!isLoading && filteredCars.length === 0 && (
              <div className="text-center py-12 md:py-16">
                <Car className="w-12 h-12 md:w-16 md:h-16 mx-auto text-muted-foreground/50 mb-3 md:mb-4" />
                <h3 className="text-base md:text-lg font-display font-semibold text-foreground mb-2">
                  Skelbimų nerasta
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Pakeiskite filtrus arba atnaujinkite
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-8 md:mt-16 py-4 md:py-8">
        <div className="container mx-auto px-4 text-center text-xs md:text-sm text-muted-foreground">
          <p>AutoAgregator by AutoKopers © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
