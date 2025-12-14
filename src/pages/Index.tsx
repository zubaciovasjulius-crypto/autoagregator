import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import CarCard from '@/components/CarCard';
import { mockCars, carSources } from '@/data/mockCars';
import { Search, Car, MapPin, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const Index = () => {
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [priceRange, setPriceRange] = useState('all');

  const brands = useMemo(() => {
    const uniqueBrands = [...new Set(mockCars.map(car => car.brand))];
    return uniqueBrands.sort();
  }, []);

  const countries = useMemo(() => {
    const uniqueCountries = [...new Set(mockCars.map(car => car.country))];
    return uniqueCountries.sort();
  }, []);

  const filteredCars = useMemo(() => {
    return mockCars.filter((car) => {
      const matchesSearch = search === '' || 
        car.title.toLowerCase().includes(search.toLowerCase()) ||
        car.brand.toLowerCase().includes(search.toLowerCase()) ||
        car.model.toLowerCase().includes(search.toLowerCase());

      const matchesBrand = selectedBrand === 'all' || car.brand === selectedBrand;
      const matchesCountry = selectedCountry === 'all' || car.country === selectedCountry;
      
      let matchesPrice = true;
      if (priceRange === 'under10k') matchesPrice = car.price < 10000;
      else if (priceRange === '10k-20k') matchesPrice = car.price >= 10000 && car.price < 20000;
      else if (priceRange === '20k-50k') matchesPrice = car.price >= 20000 && car.price < 50000;
      else if (priceRange === 'over50k') matchesPrice = car.price >= 50000;

      return matchesSearch && matchesBrand && matchesCountry && matchesPrice;
    });
  }, [search, selectedBrand, selectedCountry, priceRange]);

  const stats = {
    totalCars: mockCars.length,
    totalSources: carSources.length,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/20 to-background py-8 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6 md:mb-8">
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-2 md:mb-3">
              Automobilių paieška Europoje
            </h1>
            <p className="text-sm md:text-lg text-muted-foreground">
              {stats.totalCars.toLocaleString()} skelbimai iš {stats.totalSources} šaltinių
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row gap-2 md:gap-3 bg-card p-3 md:p-4 rounded-xl shadow-lg border border-border">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ieškoti markės, modelio..."
                  className="pl-10 h-10 md:h-12 text-sm md:text-base"
                />
              </div>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="w-full md:w-40 h-10 md:h-12">
                  <SelectValue placeholder="Markė" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visos markės</SelectItem>
                  {brands.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="w-full md:w-40 h-10 md:h-12">
                  <SelectValue placeholder="Šalis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visos šalys</SelectItem>
                  {countries.map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Source Pills */}
      <section className="border-b border-border bg-muted/30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {carSources.map((source) => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-card hover:bg-primary/10 border border-border text-xs md:text-sm font-medium text-foreground transition-colors"
              >
                {source.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Filter Row */}
      <section className="container mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <span className="text-sm text-muted-foreground">
            {filteredCars.length} rezultatai
          </span>
          <Select value={priceRange} onValueChange={setPriceRange}>
            <SelectTrigger className="w-32 md:w-40 h-8 md:h-9 text-xs md:text-sm">
              <SelectValue placeholder="Kaina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bet kokia kaina</SelectItem>
              <SelectItem value="under10k">Iki 10 000 €</SelectItem>
              <SelectItem value="10k-20k">10 000 - 20 000 €</SelectItem>
              <SelectItem value="20k-50k">20 000 - 50 000 €</SelectItem>
              <SelectItem value="over50k">Virš 50 000 €</SelectItem>
            </SelectContent>
          </Select>
          {(selectedBrand !== 'all' || selectedCountry !== 'all' || priceRange !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSelectedBrand('all');
                setSelectedCountry('all');
                setPriceRange('all');
                setSearch('');
              }}
              className="text-xs text-muted-foreground"
            >
              Išvalyti filtrus
            </Button>
          )}
        </div>
      </section>

      {/* Cars Grid */}
      <main className="container mx-auto px-4 pb-8">
        {filteredCars.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCars.map((car, index) => (
              <CarCard key={car.id} car={car} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Car className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Skelbimų nerasta</h3>
            <p className="text-muted-foreground text-sm">Pabandykite pakeisti paieškos filtrus</p>
          </div>
        )}
      </main>

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
