import { useEffect, useState, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import { CarListing } from '@/data/mockCars';
import { scrapeApi, DbCarListing } from '@/lib/api/scrapeApi';
import { useSavedCars } from '@/hooks/useSavedCars';
import { useFoundListings } from '@/hooks/useFoundListings';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Trash2, Car, LogIn, Plus, Loader2, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import CarCard from '@/components/CarCard';

const REFRESH_INTERVAL = 90000; // 90 seconds - to avoid Firecrawl rate limits

// Notification sound
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // First beep
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.frequency.value = 880;
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0.5, audioContext.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    osc1.start(audioContext.currentTime);
    osc1.stop(audioContext.currentTime + 0.2);
    
    // Second beep (higher)
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 1100;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.5, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.3);
    }, 200);
    
    // Third beep (even higher)
    setTimeout(() => {
      const osc3 = audioContext.createOscillator();
      const gain3 = audioContext.createGain();
      osc3.connect(gain3);
      gain3.connect(audioContext.destination);
      osc3.frequency.value = 1320;
      osc3.type = 'sine';
      gain3.gain.setValueAtTime(0.5, audioContext.currentTime);
      gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      osc3.start(audioContext.currentTime);
      osc3.stop(audioContext.currentTime + 0.4);
    }, 400);
  } catch (e) {
    console.log('Audio not available');
  }
};

const Index = () => {
  const { user } = useAuth();
  const { savedCars, removeCar, saveCar, loading, fetchSavedCars } = useSavedCars();
  const { 
    foundListings, 
    fetchFoundListings, 
    addFoundListing, 
    removeFoundListing, 
    clearAllFoundListings,
    toCarListing,
    loading: foundLoading 
  } = useFoundListings();
  
  // Form
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  
  // Status
  const [isChecking, setIsChecking] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  
  // Track known listing IDs to detect new ones
  const knownListingsRef = useRef<Set<string>>(new Set());
  const isFirstCheckRef = useRef(true);

  // Load saved cars and found listings on mount
  useEffect(() => {
    fetchSavedCars();
    fetchFoundListings();
  }, [fetchSavedCars, fetchFoundListings]);

  // Initialize known listings from database
  useEffect(() => {
    if (foundListings.length > 0) {
      foundListings.forEach(listing => {
        knownListingsRef.current.add(listing.external_id);
      });
    }
  }, [foundListings]);

  // Convert DB listing to CarListing format
  const convertDbToCarListing = useCallback((db: DbCarListing): CarListing => ({
    id: db.id,
    title: db.title,
    brand: db.brand,
    model: db.model,
    year: db.year,
    price: db.price,
    mileage: db.mileage || 0,
    fuel: db.fuel || 'Dyzelinas',
    transmission: db.transmission || 'Automatinė',
    location: db.location || '',
    country: db.country,
    source: db.source,
    sourceUrl: db.source_url,
    image: db.image || null,
    listingUrl: db.listing_url || db.source_url,
  }), []);

  // Check all saved searches for new listings
  const checkForNewListings = useCallback(async (forceRefresh: boolean = false) => {
    if (!user || savedCars.length === 0) return;
    
    setIsChecking(true);
    
    try {
      let newCount = 0;
      
      for (const search of savedCars) {
        console.log(`Checking ${search.brand} ${search.model}... (refresh: ${forceRefresh})`);
        
        const result = await scrapeApi.searchCars(search.brand, search.model, forceRefresh && isFirstCheckRef.current);
        
        if (result.success && result.data) {
          for (const listing of result.data) {
            const listingId = listing.external_id || listing.id;
            
            // Skip if already known
            if (knownListingsRef.current.has(listingId)) continue;
            
            // Apply year/price filters from saved search
            if (search.min_year && listing.year < search.min_year) continue;
            if (search.max_price && listing.price > search.max_price) continue;
            
            // Add to known
            knownListingsRef.current.add(listingId);
            
            // If not first check, this is a NEW listing - save to database
            if (!isFirstCheckRef.current) {
              const carListing = convertDbToCarListing(listing);
              const saved = await addFoundListing(carListing);
              if (saved) newCount++;
            }
          }
        }
        
        // Delay between searches to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      if (newCount > 0) {
        // Play sound
        if (soundEnabled) {
          playNotificationSound();
        }
        
        // Show toast
        toast({
          title: `🚗 ${newCount} nauji skelbimai!`,
          description: 'Pridėti į sąrašą',
          duration: 10000,
        });
        
        // Refresh found listings from DB
        fetchFoundListings();
      }
      
      isFirstCheckRef.current = false;
      setLastCheck(new Date());
    } catch (error) {
      console.error('Error checking for new listings:', error);
    } finally {
      setIsChecking(false);
      setCountdown(REFRESH_INTERVAL / 1000);
    }
  }, [user, savedCars, convertDbToCarListing, soundEnabled, addFoundListing, fetchFoundListings]);

  // Initial check when user logs in and has saved searches
  useEffect(() => {
    if (user && savedCars.length > 0 && isFirstCheckRef.current) {
      checkForNewListings(true);
    }
  }, [user, savedCars, checkForNewListings]);

  // Auto-refresh interval
  useEffect(() => {
    if (!user || savedCars.length === 0) return;
    
    const interval = setInterval(() => {
      checkForNewListings();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [user, savedCars, checkForNewListings]);

  // Countdown timer
  useEffect(() => {
    if (!user || savedCars.length === 0) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? REFRESH_INTERVAL / 1000 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [user, savedCars]);

  // Add new saved search
  const handleAddSearch = async () => {
    if (!user) {
      toast({
        title: 'Prisijunkite',
        description: 'Norėdami išsaugoti paieškas, prisijunkite',
        variant: 'destructive',
      });
      return;
    }

    if (!newBrand.trim()) {
      toast({
        title: 'Užpildykite laukus',
        description: 'Įveskite bent markę',
        variant: 'destructive',
      });
      return;
    }

    const modelValue = newModel.trim() || '*'; // Use * for "all models"
    const yearValue = minYear ? parseInt(minYear) : null;
    const priceValue = maxPrice ? parseInt(maxPrice) : null;

    const success = await saveCar(
      `search-${newBrand}-${modelValue}-${Date.now()}`,
      newBrand.trim(),
      modelValue,
      modelValue === '*' ? newBrand.trim() : `${newBrand.trim()} ${modelValue}`,
      yearValue,
      priceValue
    );

    if (success) {
      setNewBrand('');
      setNewModel('');
      setMinYear('');
      setMaxPrice('');
      isFirstCheckRef.current = true;
      setTimeout(() => checkForNewListings(true), 500);
    }
  };

  // Handle delete listing
  const handleDeleteListing = async (id: string) => {
    const success = await removeFoundListing(id);
    if (success) {
      toast({
        title: 'Ištrinta',
        description: 'Skelbimas pašalintas',
      });
    }
  };

  // Get display listings
  const displayListings = foundListings.map(toCarListing);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/20 to-background py-6 md:py-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-4">
            <h1 className="text-2xl md:text-4xl font-display font-bold text-foreground mb-2">
              Naujų skelbimų stebėjimas
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Automatiškai tikrina kas {REFRESH_INTERVAL / 1000} sekundžių
            </p>
            
            {/* Status bar */}
            {user && savedCars.length > 0 && (
              <div className="flex items-center justify-center gap-4 mt-3">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  {isChecking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      Tikrinama...
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Kitas tikrinimas: {countdown}s
                    </>
                  )}
                </span>
                
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-red-500" />
                  )}
                </button>
                
                {lastCheck && (
                  <span className="text-xs text-muted-foreground">
                    Paskutinis: {lastCheck.toLocaleTimeString('lt-LT')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Saved Searches Section */}
      <section className="container mx-auto px-4 py-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Stebimos paieškos
        </h2>

        {!user ? (
          <div className="text-center py-8 bg-muted/30 rounded-xl border border-border">
            <LogIn className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-semibold text-foreground mb-2">
              Prisijunkite
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              Stebėkite automobilius ir gaukite pranešimus
            </p>
            <Link to="/auth">
              <Button size="sm">Prisijungti</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Add new search form */}
            <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  placeholder="Markė (pvz. BMW)"
                  className="flex-1"
                />
                <Input
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="Modelis (neprivaloma)"
                  className="flex-1"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="number"
                  value={minYear}
                  onChange={(e) => setMinYear(e.target.value)}
                  placeholder="Min. metai (pvz. 2015)"
                  className="flex-1"
                  min="2000"
                  max="2025"
                />
                <Input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max. kaina € (pvz. 30000)"
                  className="flex-1"
                  min="0"
                />
                <Button onClick={handleAddSearch} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Stebėti
                </Button>
              </div>
            </div>

            {/* Saved searches list */}
            {loading ? (
              <div className="text-center py-4">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              </div>
            ) : savedCars.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {savedCars.map((car) => (
                  <div
                    key={car.id}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30"
                  >
                    <Car className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-foreground">
                      {car.brand} {car.model === '*' ? '(visi)' : car.model}
                      {car.min_year && <span className="text-muted-foreground"> nuo {car.min_year}</span>}
                      {car.max_price && <span className="text-muted-foreground"> iki {car.max_price.toLocaleString('lt-LT')}€</span>}
                    </span>
                    <button
                      onClick={() => removeCar(car.external_id)}
                      className="p-1 hover:bg-destructive/20 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pridėkite paiešką aukščiau - sistema automatiškai tikrins naujus skelbimus.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Found Listings Section */}
      <section className="container mx-auto px-4 py-6 border-t border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Car className="w-5 h-5" />
            Rasti skelbimai ({displayListings.length})
          </h2>
          {displayListings.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFoundListings}>
              Išvalyti visus
            </Button>
          )}
        </div>

        {(isChecking || foundLoading) && displayListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Ieškoma naujų skelbimų...</p>
          </div>
        ) : displayListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayListings.map((car, index) => (
              <div key={car.id} className="relative group">
                <CarCard car={car} index={index} />
                <button
                  onClick={() => handleDeleteListing(car.id)}
                  className="absolute top-2 right-2 p-2 bg-destructive/90 hover:bg-destructive rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title="Ištrinti"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-xl border border-border">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {savedCars.length === 0 ? 'Pridėkite paiešką' : 'Laukiama naujų skelbimų'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {savedCars.length === 0 
                ? 'Įveskite markę ir modelį, kad pradėtumėte stebėti' 
                : 'Sistema automatiškai praneš, kai atsiras nauji skelbimai. Skelbimai saugomi 3 dienas.'}
            </p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 bg-muted/30 mt-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            AutoAgregator by AutoKopers © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
