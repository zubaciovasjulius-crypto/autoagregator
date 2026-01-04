import { useState } from 'react';
import { Link2, MessageCircle, Instagram, Facebook, Loader2, ImageIcon, X, ChevronLeft, ChevronRight, Sparkles, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ScrapedData {
  images: string[];
  url: string;
}

interface ListingDetails {
  brand: string;
  model: string;
  year: string;
  mileage: string;
  price: string;
}

const UrlShareDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [isRemovingWatermark, setIsRemovingWatermark] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [cleanedImages, setCleanedImages] = useState<Map<number, string>>(new Map());
  
  // Listing details for message generation
  const [details, setDetails] = useState<ListingDetails>({
    brand: '',
    model: '',
    year: '',
    mileage: '',
    price: '',
  });
  
  // Custom messages for different platforms
  const [messengerMessage, setMessengerMessage] = useState('');
  const [storiesMessage, setStoriesMessage] = useState('');

  const generateMessengerMessage = () => {
    const priceNum = parseInt(details.price.replace(/[^\d]/g, '')) || 0;
    const markupPrice = priceNum + 500;
    
    return `${details.brand} ${details.model}
${details.year} m.
${details.mileage} km
${markupPrice.toLocaleString('lt-LT')} €`;
  };

  const generateStoriesMessage = () => {
    return `🚗 ${details.brand} ${details.model}

📅 Metai: ${details.year}
📍 Rida: ${details.mileage} km
💰 Kaina: ${details.price} €
⛽ Daugiau info žinutėse!

#autokopers #${details.brand.toLowerCase()} #${details.model.toLowerCase().replace(/\s+/g, '')} #automobiliai #parduodama`;
  };

  const handleScrape = async () => {
    if (!url.trim()) {
      toast({
        title: 'Klaida',
        description: 'Įveskite skelbimo nuorodą',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setScrapedData(null);
    setCleanedImages(new Map());
    setSelectedImages(new Set());

    try {
      const { data, error } = await supabase.functions.invoke('download-listing-images', {
        body: { listingUrl: url },
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: 'Klaida',
          description: data.error || 'Nepavyko gauti nuotraukų',
          variant: 'destructive',
        });
        return;
      }

      if (data.images && data.images.length > 0) {
        setScrapedData({
          images: data.images,
          url: url,
        });

        // Auto-fill details from scraped data (support both formats)
        const detailsSource = data.details || data;
        setDetails({
          brand: detailsSource.brand || '',
          model: detailsSource.model || '',
          year: detailsSource.year?.toString() || '',
          mileage: detailsSource.mileage?.toString() || '',
          price: detailsSource.price?.toString() || '',
        });

        // Select first image by default
        setSelectedImages(new Set([0]));

        // Show warning if portal blocked
        if (data.warning) {
          toast({
            title: '⚠️ Įspėjimas',
            description: data.warning,
            variant: 'destructive',
          });
        } else {
          toast({
            title: '✅ Rasta!',
            description: `Rasta ${data.images.length} nuotraukų`,
          });
        }
      } else {
        toast({
          title: 'Nerasta',
          description: data.warning || 'Nuotraukų nerasta šiame puslapyje',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Scrape error:', error);
      toast({
        title: 'Klaida',
        description: 'Nepavyko nuskaityti puslapio',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleImageSelection = (index: number) => {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedImages(newSelection);
  };

  const handleRemoveWatermark = async (imageIndex: number) => {
    if (!scrapedData) return;
    
    setIsRemovingWatermark(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('remove-watermark', {
        body: { imageUrl: scrapedData.images[imageIndex] },
      });

      if (error) throw error;

      if (data.success && data.cleanedImageUrl) {
        const newCleanedImages = new Map(cleanedImages);
        newCleanedImages.set(imageIndex, data.cleanedImageUrl);
        setCleanedImages(newCleanedImages);
        
        toast({
          title: '✅ Vandens ženklas pašalintas!',
          description: data.message || 'Nuotrauka paruošta',
        });
      } else {
        toast({
          title: 'Nepavyko',
          description: data.error || 'Nepavyko pašalinti vandens ženklo',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Watermark removal error:', error);
      toast({
        title: 'Klaida',
        description: 'Nepavyko pašalinti vandens ženklo',
        variant: 'destructive',
      });
    } finally {
      setIsRemovingWatermark(false);
    }
  };

  const handleRemoveAllWatermarks = async () => {
    if (!scrapedData || selectedImages.size === 0) return;
    
    setIsRemovingWatermark(true);
    let successCount = 0;
    
    for (const index of selectedImages) {
      if (cleanedImages.has(index)) continue; // Skip already cleaned
      
      try {
        const { data, error } = await supabase.functions.invoke('remove-watermark', {
          body: { imageUrl: scrapedData.images[index] },
        });

        if (!error && data.success && data.cleanedImageUrl) {
          const newCleanedImages = new Map(cleanedImages);
          newCleanedImages.set(index, data.cleanedImageUrl);
          setCleanedImages(newCleanedImages);
          successCount++;
        }
      } catch (e) {
        console.error('Watermark removal error for image', index, e);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setIsRemovingWatermark(false);
    
    if (successCount > 0) {
      toast({
        title: '✅ Vandens ženklai pašalinti!',
        description: `Apdorota ${successCount} nuotraukų`,
      });
    }
  };

  const handlePublish = async (platform: 'messenger' | 'fb-stories' | 'ig-stories') => {
    if (!scrapedData || selectedImages.size === 0) {
      toast({
        title: 'Klaida',
        description: 'Pasirinkite bent vieną nuotrauką',
        variant: 'destructive',
      });
      return;
    }

    setIsPublishing(platform);
    
    // Get selected image URLs (use cleaned version if available)
    const imageUrls = Array.from(selectedImages).map(index => 
      cleanedImages.get(index) || scrapedData.images[index]
    );
    
    const message = platform === 'messenger' 
      ? (messengerMessage || generateMessengerMessage())
      : (storiesMessage || generateStoriesMessage());

    try {
      const { data, error } = await supabase.functions.invoke('publish-to-social', {
        body: {
          platform,
          message,
          imageUrl: imageUrls[0], // Primary image
          imageUrls, // All selected images
          linkUrl: scrapedData.url,
        },
      });

      if (error) throw error;

      if (data.needsSetup) {
        toast({
          title: '⚙️ Reikia konfigūracijos',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      if (!data.success) {
        toast({
          title: 'Klaida',
          description: data.error || 'Nepavyko publikuoti',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: '✅ Publikuota!',
        description: data.message,
      });

      handleReset();
    } catch (error) {
      console.error('Publish error:', error);
      toast({
        title: 'Klaida',
        description: 'Nepavyko publikuoti',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: '📋 Nukopijuota!',
        description: 'Tekstas nukopijuotas į iškarpinę',
      });
    } catch (error) {
      toast({
        title: 'Klaida',
        description: 'Nepavyko nukopijuoti',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setUrl('');
    setScrapedData(null);
    setSelectedImages(new Set());
    setCleanedImages(new Map());
    setDetails({ brand: '', model: '', year: '', mileage: '', price: '' });
    setMessengerMessage('');
    setStoriesMessage('');
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      handleReset();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Link2 className="w-4 h-4" />
          Įkelti iš nuorodos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="url-share-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Publikuoti iš nuorodos
          </DialogTitle>
          <DialogDescription id="url-share-description">
            Įklijuokite skelbimo nuorodą, pasirinkite nuotraukas ir publikuokite
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* URL Input */}
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Įklijuokite skelbimo nuorodą..."
              disabled={isLoading || !!scrapedData}
            />
            {!scrapedData ? (
              <Button onClick={handleScrape} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gauti'}
              </Button>
            ) : (
              <Button variant="outline" onClick={handleReset}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Scraped Content */}
          {scrapedData && (
            <>
              {/* Listing Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Input
                  value={details.brand}
                  onChange={(e) => setDetails(d => ({ ...d, brand: e.target.value }))}
                  placeholder="Markė"
                />
                <Input
                  value={details.model}
                  onChange={(e) => setDetails(d => ({ ...d, model: e.target.value }))}
                  placeholder="Modelis"
                />
                <Input
                  value={details.year}
                  onChange={(e) => setDetails(d => ({ ...d, year: e.target.value }))}
                  placeholder="Metai"
                />
                <Input
                  value={details.mileage}
                  onChange={(e) => setDetails(d => ({ ...d, mileage: e.target.value }))}
                  placeholder="Rida (km)"
                />
                <Input
                  value={details.price}
                  onChange={(e) => setDetails(d => ({ ...d, price: e.target.value }))}
                  placeholder="Kaina (€)"
                />
              </div>

              {/* Image Gallery */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Nuotraukos ({selectedImages.size} pasirinkta iš {scrapedData.images.length})
                  </label>
                  <div className="flex gap-2">
                    {selectedImages.size > 0 && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            // Remove selected images from scrapedData
                            const newImages = scrapedData.images.filter((_, idx) => !selectedImages.has(idx));
                            setScrapedData({ ...scrapedData, images: newImages });
                            // Clear selection and cleaned images for removed indices
                            setSelectedImages(new Set());
                            setCleanedImages(new Map());
                            toast({
                              title: '🗑️ Pašalinta',
                              description: `Pašalinta ${selectedImages.size} nuotraukų`,
                            });
                          }}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                          Pašalinti ({selectedImages.size})
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleRemoveAllWatermarks}
                          disabled={isRemovingWatermark}
                          className="gap-2"
                        >
                          {isRemovingWatermark ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          Valyti ženklus
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Select/Deselect all buttons */}
                <div className="flex gap-2 text-xs">
                  <button 
                    onClick={() => setSelectedImages(new Set(scrapedData.images.map((_, idx) => idx)))}
                    className="text-primary hover:underline"
                  >
                    Pasirinkti visas
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button 
                    onClick={() => setSelectedImages(new Set())}
                    className="text-muted-foreground hover:underline"
                  >
                    Atšaukti pasirinkimą
                  </button>
                </div>
                
                {/* Image grid - show all images */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
                  {scrapedData.images.map((img, idx) => {
                    const isSelected = selectedImages.has(idx);
                    const isCleaned = cleanedImages.has(idx);
                    const displayUrl = cleanedImages.get(idx) || img;
                    
                    return (
                      <div key={idx} className="relative group">
                        <button
                          onClick={() => toggleImageSelection(idx)}
                          className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all w-full ${
                            isSelected 
                              ? 'border-primary ring-2 ring-primary/30' 
                              : 'border-transparent hover:border-muted-foreground/30'
                          }`}
                        >
                          <img
                            src={displayUrl}
                            alt={`Nuotrauka ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                          
                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-primary-foreground" />
                            </div>
                          )}
                          
                          {/* Cleaned indicator */}
                          {isCleaned && (
                            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-green-500 rounded text-[10px] text-white font-medium">
                              ✓ Clean
                            </div>
                          )}
                          
                          {/* Index number */}
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">
                            {idx + 1}
                          </div>
                        </button>
                        
                        {/* Remove single image button (visible on hover) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newImages = [...scrapedData.images];
                            newImages.splice(idx, 1);
                            setScrapedData({ ...scrapedData, images: newImages });
                            
                            // Update selected images (shift indices)
                            const newSelected = new Set<number>();
                            selectedImages.forEach(i => {
                              if (i < idx) newSelected.add(i);
                              else if (i > idx) newSelected.add(i - 1);
                            });
                            setSelectedImages(newSelected);
                            
                            // Update cleaned images (shift indices)
                            const newCleaned = new Map<number, string>();
                            cleanedImages.forEach((url, i) => {
                              if (i < idx) newCleaned.set(i, url);
                              else if (i > idx) newCleaned.set(i - 1, url);
                            });
                            setCleanedImages(newCleaned);
                          }}
                          className="absolute top-1 left-1 w-5 h-5 bg-destructive/80 hover:bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Pašalinti nuotrauką"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tabs for different sharing options */}
              <Tabs defaultValue="messenger" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="messenger" className="gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Messenger
                  </TabsTrigger>
                  <TabsTrigger value="stories" className="gap-2">
                    <Instagram className="w-4 h-4" />
                    Stories
                  </TabsTrigger>
                </TabsList>

                {/* Messenger Tab */}
                <TabsContent value="messenger" className="space-y-3 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Paprasta žinutė Messenger grupei (kaina +500€)
                  </p>
                  <Textarea
                    value={messengerMessage || generateMessengerMessage()}
                    onChange={(e) => setMessengerMessage(e.target.value)}
                    rows={5}
                    className="font-mono text-sm"
                  />
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 gap-2"
                      onClick={() => copyToClipboard(messengerMessage || generateMessengerMessage())}
                    >
                      📋 Kopijuoti tekstą
                    </Button>
                    <Button
                      onClick={() => handlePublish('messenger')}
                      disabled={isPublishing !== null || selectedImages.size === 0}
                      className="flex-1 gap-2 bg-[#0084FF] hover:bg-[#0084FF]/90"
                    >
                      {isPublishing === 'messenger' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MessageCircle className="w-4 h-4" />
                      )}
                      Siųsti į Messenger
                    </Button>
                  </div>
                </TabsContent>

                {/* Stories Tab */}
                <TabsContent value="stories" className="space-y-3 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Pilna žinutė su daugiau detalių (FB arba Instagram Stories)
                  </p>
                  <Textarea
                    value={storiesMessage || generateStoriesMessage()}
                    onChange={(e) => setStoriesMessage(e.target.value)}
                    rows={8}
                    className="resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => handlePublish('fb-stories')}
                      disabled={isPublishing !== null || selectedImages.size === 0}
                      className="gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90"
                    >
                      {isPublishing === 'fb-stories' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Facebook className="w-4 h-4" />
                      )}
                      FB Stories
                    </Button>
                    <Button
                      onClick={() => handlePublish('ig-stories')}
                      disabled={isPublishing !== null || selectedImages.size === 0}
                      className="gap-2 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90"
                    >
                      {isPublishing === 'ig-stories' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Instagram className="w-4 h-4" />
                      )}
                      IG Stories
                    </Button>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => copyToClipboard(storiesMessage || generateStoriesMessage())}
                  >
                    📋 Kopijuoti tekstą
                  </Button>
                </TabsContent>
              </Tabs>
            </>
          )}

          {/* Empty state */}
          {!scrapedData && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Įklijuokite skelbimo nuorodą iš bet kurio portalo</p>
              <p className="text-xs mt-1">Palaikoma: autoplius.lt, theparking.eu, schadeautos.nl, mobile.de, autoscout24, otomoto.pl ir kt.</p>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Nuskaitome puslapį...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UrlShareDialog;
