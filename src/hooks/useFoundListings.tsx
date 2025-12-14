import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CarListing } from '@/data/mockCars';

export interface FoundListing {
  id: string;
  user_id: string;
  listing_id: string;
  external_id: string;
  brand: string;
  model: string;
  title: string;
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
  found_at: string;
  expires_at: string;
}

export const useFoundListings = () => {
  const { user } = useAuth();
  const [foundListings, setFoundListings] = useState<FoundListing[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all found listings for current user (not expired)
  const fetchFoundListings = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('found_listings')
        .select('*')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('found_at', { ascending: false });

      if (error) {
        console.error('Error fetching found listings:', error);
        return;
      }

      setFoundListings(data || []);
    } catch (error) {
      console.error('Error fetching found listings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Add a new found listing
  const addFoundListing = useCallback(async (listing: CarListing): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('found_listings')
        .upsert({
          user_id: user.id,
          listing_id: listing.id,
          external_id: listing.id,
          brand: listing.brand,
          model: listing.model,
          title: listing.title,
          year: listing.year,
          price: listing.price,
          mileage: listing.mileage,
          fuel: listing.fuel,
          transmission: listing.transmission,
          location: listing.location,
          country: listing.country,
          source: listing.source,
          source_url: listing.sourceUrl,
          listing_url: listing.listingUrl,
          image: listing.image,
        }, {
          onConflict: 'user_id,external_id',
          ignoreDuplicates: true,
        });

      if (error) {
        console.error('Error adding found listing:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error adding found listing:', error);
      return false;
    }
  }, [user]);

  // Remove a found listing
  const removeFoundListing = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('found_listings')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error removing found listing:', error);
        return false;
      }

      setFoundListings(prev => prev.filter(l => l.id !== id));
      return true;
    } catch (error) {
      console.error('Error removing found listing:', error);
      return false;
    }
  }, [user]);

  // Clear all found listings
  const clearAllFoundListings = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('found_listings')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error clearing found listings:', error);
        return false;
      }

      setFoundListings([]);
      return true;
    } catch (error) {
      console.error('Error clearing found listings:', error);
      return false;
    }
  }, [user]);

  // Convert FoundListing to CarListing
  const toCarListing = useCallback((found: FoundListing): CarListing => ({
    id: found.id,
    title: found.title,
    brand: found.brand,
    model: found.model,
    year: found.year,
    price: found.price,
    mileage: found.mileage || 0,
    fuel: found.fuel || 'Dyzelinas',
    transmission: found.transmission || 'Automatinė',
    location: found.location || '',
    country: found.country,
    source: found.source,
    sourceUrl: found.source_url,
    image: found.image || 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&q=80',
    listingUrl: found.listing_url || found.source_url,
  }), []);

  return {
    foundListings,
    loading,
    fetchFoundListings,
    addFoundListing,
    removeFoundListing,
    clearAllFoundListings,
    toCarListing,
  };
};
