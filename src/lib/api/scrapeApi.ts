import { supabase } from '@/integrations/supabase/client';
import { CarListing } from '@/data/mockCars';

export type ScrapeSource = 'mobile.de' | 'autoscout24' | 'autoplius' | 'kleinanzeigen' | 'marktplaats';

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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

  // Sequential scraping with delays to avoid rate limits
  async scrapeAll(options?: ScrapeOptions): Promise<CarListing[]> {
    const sources: ScrapeSource[] = ['mobile.de', 'autoscout24', 'autoplius'];
    const allListings: CarListing[] = [];

    for (const source of sources) {
      try {
        const result = await this.scrapeSource(source, options);
        if (result.success && result.data) {
          allListings.push(...result.data);
        }
        // Wait 2 seconds between requests to avoid rate limiting
        await delay(2000);
      } catch (error) {
        console.error(`Error scraping ${source}:`, error);
      }
    }

    return allListings;
  },
};
