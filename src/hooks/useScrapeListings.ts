import { useState, useCallback } from 'react';
import { CarListing, mockCars } from '@/data/mockCars';
import { scrapeApi } from '@/lib/api/scrapeApi';
import { toast } from '@/hooks/use-toast';

interface UseScrapeListingsOptions {
  brand?: string;
  model?: string;
  maxPrice?: number;
  minYear?: number;
}

export function useScrapeListings() {
  const [listings, setListings] = useState<CarListing[]>(mockCars);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrapeListings = useCallback(async (options?: UseScrapeListingsOptions) => {
    setIsLoading(true);
    setError(null);

    try {
      toast({
        title: 'Ieškoma skelbimų...',
        description: 'Renkame duomenis iš Europos automobilių portalų',
      });

      const scrapedListings = await scrapeApi.scrapeAll(options);

      if (scrapedListings.length > 0) {
        setListings(scrapedListings);
        setLastUpdated(new Date());
        toast({
          title: 'Skelbimai atnaujinti!',
          description: `Rasta ${scrapedListings.length} skelbimų`,
        });
      } else {
        // Keep mock data if no results
        toast({
          title: 'Skelbimų nerasta',
          description: 'Rodomi demonstraciniai duomenys',
          variant: 'destructive',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Įvyko klaida';
      setError(errorMessage);
      toast({
        title: 'Klaida',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const scrapeSingleSource = useCallback(async (
    source: 'mobile.de' | 'autoscout24' | 'autoplius',
    options?: UseScrapeListingsOptions
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      toast({
        title: `Ieškoma ${source}...`,
        description: 'Renkame duomenis',
      });

      const result = await scrapeApi.scrapeSource(source, options);

      if (result.success && result.data && result.data.length > 0) {
        setListings(prev => {
          // Remove old listings from this source and add new ones
          const filtered = prev.filter(l => l.source !== source);
          return [...result.data!, ...filtered];
        });
        setLastUpdated(new Date());
        toast({
          title: 'Atnaujinta!',
          description: `Rasta ${result.data.length} skelbimų iš ${source}`,
        });
      } else {
        toast({
          title: 'Skelbimų nerasta',
          description: result.error || 'Bandykite vėliau',
          variant: 'destructive',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Įvyko klaida';
      setError(errorMessage);
      toast({
        title: 'Klaida',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    listings,
    isLoading,
    lastUpdated,
    error,
    scrapeListings,
    scrapeSingleSource,
    setListings,
  };
}
