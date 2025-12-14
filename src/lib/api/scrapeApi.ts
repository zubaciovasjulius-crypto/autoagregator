import { supabase } from '@/integrations/supabase/client';

export type ScrapeSource = 'mobile.de' | 'autoscout24' | 'autoplius' | 'kleinanzeigen' | 'marktplaats';

export interface DbCarListing {
  id: string;
  external_id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number | null;
  fuel: string | null;
  transmission: string | null;
  location: string | null;
  country: string;
  source: string;
  source_url: string;
  listing_url: string | null;
  image: string | null;
  scraped_at: string;
}

export interface ScrapeStatus {
  source: string;
  last_scraped_at: string | null;
  status: string;
  listings_count: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const scrapeApi = {
  // Get all cached listings
  async getListings(): Promise<DbCarListing[]> {
    const { data, error } = await supabase
      .from('car_listings')
      .select('*')
      .order('scraped_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching listings:', error);
      return [];
    }

    return (data || []) as DbCarListing[];
  },

  // Get scrape status for all sources
  async getStatus(): Promise<ScrapeStatus[]> {
    const { data, error } = await supabase
      .from('scrape_status')
      .select('*');

    if (error) {
      console.error('Error fetching status:', error);
      return [];
    }

    return (data || []) as ScrapeStatus[];
  },

  // Scrape a single source
  async scrapeSource(source: ScrapeSource, forceRefresh = false): Promise<{ success: boolean; data?: DbCarListing[]; cached?: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('scrape-cars', {
        body: { source, forceRefresh },
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

  // Scrape all sources sequentially with delays
  async scrapeAll(forceRefresh = false): Promise<DbCarListing[]> {
    const sources: ScrapeSource[] = ['mobile.de', 'autoscout24', 'autoplius'];
    const allListings: DbCarListing[] = [];

    for (const source of sources) {
      try {
        const result = await this.scrapeSource(source, forceRefresh);
        if (result.success && result.data) {
          allListings.push(...result.data);
        }
        // Wait 3 seconds between requests to avoid rate limiting
        await delay(3000);
      } catch (error) {
        console.error(`Error scraping ${source}:`, error);
      }
    }

    return allListings;
  },
};
