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
    <div className="space-y-3 md:space-y-4">
      {/* Main Search Bar */}
      <div className="flex gap-2 md:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Ieškoti..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9 md:pl-12 h-10 md:h-12 bg-card border-border text-foreground placeholder:text-muted-foreground text-sm md:text-base"
          />
        </div>
        <Button
          variant={showAdvanced ? 'default' : 'outline'}
          size="default"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="h-10 md:h-12 gap-1 md:gap-2 px-3 md:px-4"
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filtrai</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 bg-primary text-primary-foreground text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Quick Filters - Horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        <Select value={filters.brand} onValueChange={(v) => updateFilter('brand', v)}>
          <SelectTrigger className="w-28 md:w-40 bg-card border-border flex-shrink-0 h-9 md:h-10 text-xs md:text-sm">
            <SelectValue placeholder="Markė" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visos</SelectItem>
            {carBrands.map((brand) => (
              <SelectItem key={brand} value={brand}>
                {brand}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.country} onValueChange={(v) => updateFilter('country', v)}>
          <SelectTrigger className="w-28 md:w-40 bg-card border-border flex-shrink-0 h-9 md:h-10 text-xs md:text-sm">
            <SelectValue placeholder="Šalis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visos</SelectItem>
            {europeanCountries.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.fuel} onValueChange={(v) => updateFilter('fuel', v)}>
          <SelectTrigger className="w-28 md:w-40 bg-card border-border flex-shrink-0 h-9 md:h-10 text-xs md:text-sm">
            <SelectValue placeholder="Kuras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi</SelectItem>
            <SelectItem value="Benzinas">Benzinas</SelectItem>
            <SelectItem value="Dyzelinas">Dyzelinas</SelectItem>
            <SelectItem value="Elektra">Elektra</SelectItem>
            <SelectItem value="Hibridas">Hibridas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="p-3 md:p-4 bg-card rounded-lg border border-border space-y-3 md:space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            <div className="space-y-1 md:space-y-2">
              <label className="text-xs md:text-sm text-muted-foreground">Kaina nuo</label>
              <Input
                type="number"
                placeholder="€"
                value={filters.minPrice}
                onChange={(e) => updateFilter('minPrice', e.target.value)}
                className="bg-secondary border-border h-9 md:h-10 text-sm"
              />
            </div>
            <div className="space-y-1 md:space-y-2">
              <label className="text-xs md:text-sm text-muted-foreground">Kaina iki</label>
              <Input
                type="number"
                placeholder="€"
                value={filters.maxPrice}
                onChange={(e) => updateFilter('maxPrice', e.target.value)}
                className="bg-secondary border-border h-9 md:h-10 text-sm"
              />
            </div>
            <div className="space-y-1 md:space-y-2">
              <label className="text-xs md:text-sm text-muted-foreground">Metai nuo</label>
              <Select value={filters.minYear} onValueChange={(v) => updateFilter('minYear', v)}>
                <SelectTrigger className="bg-secondary border-border h-9 md:h-10 text-sm">
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
            <div className="space-y-1 md:space-y-2">
              <label className="text-xs md:text-sm text-muted-foreground">Metai iki</label>
              <Select value={filters.maxYear} onValueChange={(v) => updateFilter('maxYear', v)}>
                <SelectTrigger className="bg-secondary border-border h-9 md:h-10 text-sm">
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
      <div className="flex items-center justify-between pt-1 md:pt-2">
        <p className="text-xs md:text-sm text-muted-foreground">
          Rasta: <span className="text-foreground font-semibold">{resultsCount}</span>
        </p>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground gap-1 h-7 md:h-8 text-xs md:text-sm"
          >
            <X className="w-3 h-3 md:w-4 md:h-4" />
            Išvalyti
          </Button>
        )}
      </div>
    </div>
  );
};

export default SearchFilters;
