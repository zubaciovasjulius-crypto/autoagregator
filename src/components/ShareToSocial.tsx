import { useState } from 'react';
import { Facebook, Instagram, Share2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CarListing } from '@/data/mockCars';

interface ShareToSocialProps {
  car: CarListing;
}

const ShareToSocial = ({ car }: ShareToSocialProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState<'facebook' | 'instagram' | null>(null);
  const [customMessage, setCustomMessage] = useState('');

  const generateDefaultMessage = () => {
    const price = car.price.toLocaleString('lt-LT') + ' €';
    const mileage = car.mileage.toLocaleString('lt-LT') + ' km';
    
    return `🚗 ${car.brand} ${car.model} (${car.year})

💰 Kaina: ${price}
📍 Rida: ${mileage}
⛽ Kuras: ${car.fuel}
📌 Šalis: ${car.country}

🔗 Daugiau informacijos: ${car.listingUrl}

#autokopers #${car.brand.toLowerCase()} #${car.model.toLowerCase().replace(/\s+/g, '')} #automobiliai`;
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !customMessage) {
      setCustomMessage(generateDefaultMessage());
    }
  };

  const handlePublish = async (platform: 'facebook' | 'instagram') => {
    setIsPublishing(platform);

    try {
      const { data, error } = await supabase.functions.invoke('publish-to-social', {
        body: {
          platform,
          message: customMessage || generateDefaultMessage(),
          imageUrl: car.image,
          linkUrl: car.listingUrl,
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

      setIsOpen(false);
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

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="p-2.5 rounded-full backdrop-blur bg-background/90 text-muted-foreground active:text-primary active:bg-background transition-all touch-manipulation"
          title="Dalintis socialinėse medijose"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Dalintis skelbimu
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Car Preview */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            {car.image && (
              <img 
                src={car.image} 
                alt={car.title}
                className="w-16 h-12 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{car.brand} {car.model}</p>
              <p className="text-xs text-muted-foreground">{car.year} • {car.price.toLocaleString('lt-LT')} €</p>
            </div>
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Žinutė</label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Įrašykite savo žinutę..."
              rows={6}
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

          {/* Note */}
          <p className="text-xs text-muted-foreground text-center">
            Instagram reikalauja nuotraukos. Facebook gali publikuoti su nuoroda arba nuotrauka.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareToSocial;
