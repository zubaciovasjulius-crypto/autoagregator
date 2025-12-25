import { useState } from 'react';
import { Link2, Facebook, Instagram, Loader2, ImageIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ScrapedData {
  images: string[];
  title?: string;
  url: string;
}

const UrlShareDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState<'facebook' | 'instagram' | null>(null);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [customMessage, setCustomMessage] = useState('');

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
        
        // Generate default message
        const defaultMessage = `🚗 Naujas skelbimas!\n\n🔗 ${url}\n\n#autokopers #automobiliai`;
        setCustomMessage(defaultMessage);

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

  const handlePublish = async (platform: 'facebook' | 'instagram') => {
    if (!scrapedData) return;

    setIsPublishing(platform);

    try {
      const { data, error } = await supabase.functions.invoke('publish-to-social', {
        body: {
          platform,
          message: customMessage,
          imageUrl: scrapedData.images[selectedImageIndex],
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

      // Reset after successful publish
      handleReset();
    } catch (error) {
      console.error('Publish error:', error);
      toast({
        title: 'Klaida',
        description: 'Nepavyko publikuoti į socialinę mediją',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(null);
    }
  };

  const handleReset = () => {
    setUrl('');
    setScrapedData(null);
    setSelectedImageIndex(0);
    setCustomMessage('');
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
    }
  };

  const prevImage = () => {
    if (selectedImageIndex > 0) {
      setSelectedImageIndex(prev => prev - 1);
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Gauti'
                )}
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
                  Pasirinkite nuotrauką ({selectedImageIndex + 1}/{scrapedData.images.length})
                </label>
                
                <div className="relative">
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <img
                      src={scrapedData.images[selectedImageIndex]}
                      alt={`Nuotrauka ${selectedImageIndex + 1}`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                  </div>
                  
                  {/* Navigation arrows */}
                  {scrapedData.images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        disabled={selectedImageIndex === 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={nextImage}
                        disabled={selectedImageIndex === scrapedData.images.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
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
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all ${
                          idx === selectedImageIndex 
                            ? 'border-primary ring-2 ring-primary/30' 
                            : 'border-transparent hover:border-muted-foreground/30'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                          }}
                        />
                      </button>
                    ))}
                    {scrapedData.images.length > 10 && (
                      <div className="flex-shrink-0 w-16 h-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        +{scrapedData.images.length - 10}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Custom Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Žinutė</label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Įrašykite savo žinutę..."
                  rows={5}
                  className="resize-none"
                />
              </div>

              {/* Platform Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handlePublish('facebook')}
                  disabled={isPublishing !== null}
                  className="flex items-center gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90"
                >
                  {isPublishing === 'facebook' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Facebook className="w-4 h-4" />
                  )}
                  Facebook
                </Button>
                <Button
                  onClick={() => handlePublish('instagram')}
                  disabled={isPublishing !== null}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90"
                >
                  {isPublishing === 'instagram' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Instagram className="w-4 h-4" />
                  )}
                  Instagram
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Pasirinkta nuotrauka bus publikuota kartu su žinute.
              </p>
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

          {/* Loading state */}
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
