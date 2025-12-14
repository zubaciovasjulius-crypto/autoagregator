import { supabase } from '@/integrations/supabase/client';
import { CarListing } from '@/data/mockCars';

type ScrapeSource = 'mobile.de' | 'autoscout24' | 'autoplius';

interface ScrapeOptions {
  brand?: string;
  model?: string;
  maxPrice?: number;
  minYear?: number;
}

interface ScrapeResponse {
  success: boolean;
  data?: CarListing[];
  source?: string;
  error?: string;
}

export const scrapeApi = {
  async scrapeSource(source: ScrapeSource, options?: ScrapeOptions): Promise<ScrapeResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('scrape-cars', {
        body: { source, ...options },
      });

      if (error) {
        console.error('Scrape error:', error);
        return { success: false, error: error.message };
      }

      return data;
    } catch (error) {
      console.error('Scrape error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async scrapeAll(options?: ScrapeOptions): Promise<CarListing[]> {
    const sources: ScrapeSource[] = ['mobile.de', 'autoscout24', 'autoplius'];
    const allListings: CarListing[] = [];

    const results = await Promise.allSettled(
      sources.map(source => this.scrapeSource(source, options))
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success && result.value.data) {
        allListings.push(...result.value.data);
      }
    }

    return allListings;
  },
};
