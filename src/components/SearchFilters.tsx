import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { carBrands, europeanCountries, carSources } from '@/data/mockCars';
import { Badge } from '@/components/ui/badge';

export interface Filters {
  search: string;
  brand: string;
  country: string;
  source: string;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  fuel: string;
}

interface SearchFiltersProps {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
  resultsCount: number;
}

const SearchFilters = ({ filters, onFilterChange, resultsCount }: SearchFiltersProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = (key: keyof Filters, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
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
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-4">
      {/* Main Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Ieškoti pagal pavadinimą, markę, modelį..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-12 h-12 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Button
          variant={showAdvanced ? 'default' : 'outline'}
          size="lg"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="h-12 gap-2"
        >
          <Filter className="w-4 h-4" />
          Filtrai
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 bg-primary text-primary-foreground">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filters.brand} onValueChange={(v) => updateFilter('brand', v)}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Markė" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visos markės</SelectItem>
            {carBrands.map((brand) => (
              <SelectItem key={brand} value={brand}>
                {brand}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.country} onValueChange={(v) => updateFilter('country', v)}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Šalis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visos šalys</SelectItem>
            {europeanCountries.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.source} onValueChange={(v) => updateFilter('source', v)}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Šaltinis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi šaltiniai</SelectItem>
            {carSources.map((source) => (
              <SelectItem key={source.name} value={source.name}>
                {source.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.fuel} onValueChange={(v) => updateFilter('fuel', v)}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Kuras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi tipai</SelectItem>
            <SelectItem value="Benzinas">Benzinas</SelectItem>
            <SelectItem value="Dyzelinas">Dyzelinas</SelectItem>
            <SelectItem value="Elektra">Elektra</SelectItem>
            <SelectItem value="Hibridas">Hibridas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="p-4 bg-card rounded-lg border border-border space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Kaina nuo</label>
              <Input
                type="number"
                placeholder="€"
                value={filters.minPrice}
                onChange={(e) => updateFilter('minPrice', e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Kaina iki</label>
              <Input
                type="number"
                placeholder="€"
                value={filters.maxPrice}
                onChange={(e) => updateFilter('maxPrice', e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Metai nuo</label>
              <Select value={filters.minYear} onValueChange={(v) => updateFilter('minYear', v)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Metai" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Metai iki</label>
              <Select value={filters.maxYear} onValueChange={(v) => updateFilter('maxYear', v)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Metai" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Results Count & Clear */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">
          Rasta: <span className="text-foreground font-semibold">{resultsCount}</span> skelbimų
        </p>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground gap-1"
          >
            <X className="w-4 h-4" />
            Išvalyti filtrus
          </Button>
        )}
      </div>
    </div>
  );
};

export default SearchFilters;
