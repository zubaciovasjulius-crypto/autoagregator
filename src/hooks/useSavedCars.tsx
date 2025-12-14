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
}

// Notification sound
const playNotificationSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.3);
};

export const useSavedCars = () => {
  const { user } = useAuth();
  const [savedCars, setSavedCars] = useState<SavedCar[]>([]);
  const [loading, setLoading] = useState(false);
  const previousListingsRef = useRef<Set<string>>(new Set());

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
  const saveCar = async (externalId: string, brand: string, model: string, title: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('saved_cars')
        .insert({
          user_id: user.id,
          external_id: externalId,
          brand,
          model,
          title
        });

      if (error) throw error;
      
      await fetchSavedCars();
      toast({
        title: 'Išsaugota!',
        description: `${brand} ${model} pridėtas prie mėgstamiausių`,
      });
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast({
          title: 'Jau išsaugotas',
          description: 'Šis automobilis jau yra mėgstamiausiuose',
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
        description: 'Automobilis pašalintas iš mėgstamiausių',
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

  // Listen for new listings that match saved searches
  useEffect(() => {
    if (!user || savedCars.length === 0) return;

    const channel = supabase
      .channel('car-listings-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'car_listings'
        },
        (payload) => {
          const newListing = payload.new as any;
          
          // Check if this matches any saved car criteria
          const matchingSaved = savedCars.find(
            saved => saved.brand.toLowerCase() === newListing.brand?.toLowerCase() ||
                     saved.model.toLowerCase() === newListing.model?.toLowerCase()
          );

          if (matchingSaved && !previousListingsRef.current.has(newListing.external_id)) {
            playNotificationSound();
            toast({
              title: '🚗 Naujas skelbimas!',
              description: `Rastas ${newListing.brand} ${newListing.model} - ${newListing.price?.toLocaleString('lt-LT')} €`,
              duration: 10000,
            });
            previousListingsRef.current.add(newListing.external_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, savedCars]);

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
  };
};
