import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import SearchFilters, { Filters } from '@/components/SearchFilters';
import CarCard from '@/components/CarCard';
import SourceStats from '@/components/SourceStats';
import { mockCars } from '@/data/mockCars';
import { Car, TrendingUp, Clock } from 'lucide-react';

const Index = () => {
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
    return mockCars.filter((car) => {
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
  }, [filters]);

  const sourceCounts = useMemo(() => {
    return mockCars.reduce((acc, car) => {
      acc[car.source] = (acc[car.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, []);

  const stats = useMemo(() => ({
    totalListings: mockCars.length,
    avgPrice: Math.round(mockCars.reduce((sum, car) => sum + car.price, 0) / mockCars.length),
    newToday: mockCars.filter(car => car.addedDate === '2024-01-10').length,
  }), []);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
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
                  {new Intl.NumberFormat('lt-LT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(stats.avgPrice)}
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
                <p className="text-sm text-muted-foreground">Nauji šiandien</p>
                <p className="text-2xl font-display font-bold text-foreground">{stats.newToday}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <SourceStats sourceCounts={sourceCounts} />
            
            {/* Info Card */}
            <div className="bg-gradient-card rounded-xl p-4 border border-primary/30 animate-pulse-glow">
              <h4 className="font-display font-semibold text-foreground mb-2">Automatinis atnaujinimas</h4>
              <p className="text-sm text-muted-foreground">
                Skelbimai atnaujinami automatiškai iš populiariausių Europos automobilių portalų.
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

            {/* Cars Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCars.map((car, index) => (
                <CarCard key={car.id} car={car} index={index} />
              ))}
            </div>

            {filteredCars.length === 0 && (
              <div className="text-center py-16">
                <Car className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                  Skelbimų nerasta
                </h3>
                <p className="text-muted-foreground">
                  Pabandykite pakeisti paieškos kriterijus
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
