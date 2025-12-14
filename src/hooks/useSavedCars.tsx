import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface SavedCar {
  id: string;
  external_id: string;
  brand: string;
  model: string;
  title: string;
  min_year?: number | null;
  max_price?: number | null;
}

// Notification sound
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Two-tone beep for notification
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
    
    // Second beep
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 1100;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.4, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.2);
    }, 150);
  } catch (e) {
    console.log('Audio not available');
  }
};

export const useSavedCars = () => {
  const { user } = useAuth();
  const [savedCars, setSavedCars] = useState<SavedCar[]>([]);
  const [loading, setLoading] = useState(false);
  const knownListingsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  // Fetch saved cars
  const fetchSavedCars = useCallback(async () => {
    if (!user) {
      setSavedCars([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_cars')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setSavedCars(data || []);
    } catch (error) {
      console.error('Error fetching saved cars:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Save a car
  const saveCar = async (
    externalId: string, 
    brand: string, 
    model: string, 
    title: string,
    minYear?: number | null,
    maxPrice?: number | null
  ) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('saved_cars')
        .insert({
          user_id: user.id,
          external_id: externalId,
          brand,
          model,
          title,
          min_year: minYear || null,
          max_price: maxPrice || null,
        });

      if (error) throw error;
      
      await fetchSavedCars();
      
      let description = `Stebimi: ${brand} ${model === '*' ? '(visi modeliai)' : model}`;
      if (minYear) description += `, nuo ${minYear} m.`;
      if (maxPrice) description += `, iki ${maxPrice.toLocaleString('lt-LT')} €`;
      
      toast({
        title: '💾 Išsaugota!',
        description,
      });
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast({
          title: 'Jau išsaugotas',
          description: 'Ši paieška jau yra sąraše',
        });
      } else {
        console.error('Error saving car:', error);
        toast({
          title: 'Klaida',
          description: 'Nepavyko išsaugoti',
          variant: 'destructive',
        });
      }
      return false;
    }
  };

  // Remove a saved car
  const removeCar = async (externalId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('saved_cars')
        .delete()
        .eq('user_id', user.id)
        .eq('external_id', externalId);

      if (error) throw error;
      
      await fetchSavedCars();
      toast({
        title: 'Pašalinta',
        description: 'Pranešimai apie šį modelį išjungti',
      });
      return true;
    } catch (error) {
      console.error('Error removing car:', error);
      return false;
    }
  };

  // Check if car is saved
  const isCarSaved = (externalId: string) => {
    return savedCars.some(car => car.external_id === externalId);
  };

  // Check new listings against saved searches
  const checkNewListings = useCallback((newListings: any[]) => {
    if (!user || savedCars.length === 0 || !initialLoadDoneRef.current) return;

    for (const listing of newListings) {
      const listingId = listing.id || listing.external_id;
      
      // Skip if we already know this listing
      if (knownListingsRef.current.has(listingId)) continue;

      // Check if matches any saved search
      const matchingSaved = savedCars.find(saved => 
        saved.brand.toLowerCase() === listing.brand?.toLowerCase() ||
        saved.model.toLowerCase() === listing.model?.toLowerCase()
      );

      if (matchingSaved) {
        playNotificationSound();
        toast({
          title: '🚗 Naujas skelbimas!',
          description: `Rastas ${listing.brand} ${listing.model} - ${listing.price?.toLocaleString('lt-LT')} €`,
          duration: 15000,
        });
      }

      knownListingsRef.current.add(listingId);
    }
  }, [user, savedCars]);

  // Mark initial listings as known
  const initializeKnownListings = useCallback((listings: any[]) => {
    listings.forEach(listing => {
      knownListingsRef.current.add(listing.id || listing.external_id);
    });
    initialLoadDoneRef.current = true;
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSavedCars();
  }, [fetchSavedCars]);

  return {
    savedCars,
    loading,
    saveCar,
    removeCar,
    isCarSaved,
    fetchSavedCars,
    checkNewListings,
    initializeKnownListings,
  };
};
