import { supabase } from '@/integrations/supabase/client';

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

  // Search for specific brand/model - use cache by default
  async searchCars(brand: string, model: string, forceRefresh: boolean = false): Promise<{ success: boolean; data?: DbCarListing[]; error?: string; count?: number }> {
    try {
      const { data, error } = await supabase.functions.invoke('scrape-cars', {
        body: { brand, model, forceRefresh },
      });

      if (error) {
        console.error('Search error:', error);
        return { success: false, error: error.message };
      }

      return data;
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Get listings for specific brand/model from cache
  async getListingsForSearch(brand: string, model: string): Promise<DbCarListing[]> {
    const { data, error } = await supabase
      .from('car_listings')
      .select('*')
      .ilike('brand', `%${brand}%`)
      .ilike('model', `%${model}%`)
      .order('price', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Error fetching listings:', error);
      return [];
    }

    return (data || []) as DbCarListing[];
  },

  // Save image to storage and update listing
  async saveListingImage(imageUrl: string, listingId: string, externalId: string): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
    try {
      console.log(`Saving image for listing ${listingId}...`);
      
      const { data, error } = await supabase.functions.invoke('save-listing-image', {
        body: { imageUrl, listingId, externalId },
      });

      if (error) {
        console.error('Save image error:', error);
        return { success: false, error: error.message };
      }

      return data;
    } catch (error) {
      console.error('Save image error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};
