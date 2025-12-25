import { useState } from 'react';
import { Link2, MessageCircle, Instagram, Facebook, Loader2, ImageIcon, X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [cleanedImageUrl, setCleanedImageUrl] = useState<string | null>(null);
  
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

🔗 ${url}

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
    setCleanedImageUrl(null);

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
        setSelectedImageIndex(0);

        toast({
          title: '✅ Rasta!',
          description: `Rasta ${data.images.length} nuotraukų`,
        });
      } else {
        toast({
          title: 'Nerasta',
          description: 'Nuotraukų nerasta šiame puslapyje',
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

  const handleRemoveWatermark = async () => {
    if (!scrapedData) return;
    
    setIsRemovingWatermark(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('remove-watermark', {
        body: { imageUrl: scrapedData.images[selectedImageIndex] },
      });

      if (error) throw error;

      if (data.success && data.cleanedImageUrl) {
        setCleanedImageUrl(data.cleanedImageUrl);
        toast({
          title: '✅ Vandens ženklas pašalintas!',
          description: 'Nuotrauka paruošta publikavimui',
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

  const handlePublish = async (platform: 'messenger' | 'fb-stories' | 'ig-stories') => {
    if (!scrapedData) return;

    setIsPublishing(platform);
    
    const imageToUse = cleanedImageUrl || scrapedData.images[selectedImageIndex];
    const message = platform === 'messenger' 
      ? (messengerMessage || generateMessengerMessage())
      : (storiesMessage || generateStoriesMessage());

    try {
      const { data, error } = await supabase.functions.invoke('publish-to-social', {
        body: {
          platform,
          message,
          imageUrl: imageToUse,
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
    setSelectedImageIndex(0);
    setCleanedImageUrl(null);
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

  const nextImage = () => {
    if (scrapedData && selectedImageIndex < scrapedData.images.length - 1) {
      setSelectedImageIndex(prev => prev + 1);
      setCleanedImageUrl(null);
    }
  };

  const prevImage = () => {
    if (selectedImageIndex > 0) {
      setSelectedImageIndex(prev => prev - 1);
      setCleanedImageUrl(null);
    }
  };

  const currentImage = cleanedImageUrl || (scrapedData?.images[selectedImageIndex] ?? '');

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Link2 className="w-4 h-4" />
          Įkelti iš nuorodos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Publikuoti iš nuorodos
          </DialogTitle>
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
              {/* Image Gallery */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Nuotrauka ({selectedImageIndex + 1}/{scrapedData.images.length})
                  {cleanedImageUrl && (
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                      ✓ Be vandens ženklo
                    </span>
                  )}
                </label>
                
                <div className="relative">
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <img
                      src={currentImage}
                      alt={`Nuotrauka ${selectedImageIndex + 1}`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                  </div>
                  
                  {scrapedData.images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        disabled={selectedImageIndex === 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background disabled:opacity-50"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={nextImage}
                        disabled={selectedImageIndex === scrapedData.images.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background disabled:opacity-50"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnail strip */}
                {scrapedData.images.length > 1 && (
                  <div className="flex gap-1 overflow-x-auto pb-2">
                    {scrapedData.images.slice(0, 10).map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedImageIndex(idx);
                          setCleanedImageUrl(null);
                        }}
                        className={`flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all ${
                          idx === selectedImageIndex 
                            ? 'border-primary ring-2 ring-primary/30' 
                            : 'border-transparent hover:border-muted-foreground/30'
                        }`}
                      >
                        <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Remove watermark button */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRemoveWatermark}
                  disabled={isRemovingWatermark || !!cleanedImageUrl}
                  className="gap-2"
                >
                  {isRemovingWatermark ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {cleanedImageUrl ? 'Vandens ženklas pašalintas' : 'Pašalinti vandens ženklą'}
                </Button>
              </div>

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
                      disabled={isPublishing !== null}
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
                      disabled={isPublishing !== null}
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
                      disabled={isPublishing !== null}
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
              <p className="text-xs mt-1">Palaikoma: leparking.fr, autoscout24, mobile.de ir kt.</p>
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
