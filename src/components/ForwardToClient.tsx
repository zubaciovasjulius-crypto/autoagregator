import { useState } from 'react';
import { Send, Copy, MessageCircle, Mail, Check, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { CarListing } from '@/data/mockCars';
import { cn } from '@/lib/utils';

interface ForwardToClientProps {
  car: CarListing;
}

const ForwardToClient = ({ car }: ForwardToClientProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [markup, setMarkup] = useState(500);
  const [copied, setCopied] = useState(false);

  const clientPrice = car.price + markup;

  const generateMessage = () => {
    const price = clientPrice.toLocaleString('lt-LT') + ' €';
    const mileage = car.mileage?.toLocaleString('lt-LT') + ' km';
    const year = car.year;

    return `🚗 ${car.brand} ${car.model} (${year} m.)

💰 Kaina: ${price}
📍 Rida: ${mileage}
⛽ ${car.fuel || 'Dyzelinas'}
🌍 ${car.country}

🔗 ${car.listingUrl || car.sourceUrl}`;
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !customMessage) {
      setCustomMessage(generateMessage());
    }
  };

  // Update message when markup changes
  const handleMarkupChange = (value: number) => {
    setMarkup(value);
    const price = (car.price + value).toLocaleString('lt-LT') + ' €';
    const mileage = car.mileage?.toLocaleString('lt-LT') + ' km';
    setCustomMessage(`🚗 ${car.brand} ${car.model} (${car.year} m.)

💰 Kaina: ${price}
📍 Rida: ${mileage}
⛽ ${car.fuel || 'Dyzelinas'}
🌍 ${car.country}

🔗 ${car.listingUrl || car.sourceUrl}`);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customMessage);
      setCopied(true);
      toast({ title: '✅ Nukopijuota!', description: 'Žinutė nukopijuota į iškarpinę' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Klaida', description: 'Nepavyko nukopijuoti', variant: 'destructive' });
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(customMessage);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleMessenger = () => {
    // Copy text first, then open messenger
    navigator.clipboard.writeText(customMessage).then(() => {
      toast({ 
        title: '📋 Žinutė nukopijuota!', 
        description: 'Dabar įklijuokite į Messenger pokalbį',
        duration: 5000,
      });
    });
    const url = encodeURIComponent(car.listingUrl || car.sourceUrl);
    window.open(`https://www.facebook.com/dialog/send?link=${url}&app_id=0&redirect_uri=${encodeURIComponent(window.location.href)}`, '_blank');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`${car.brand} ${car.model} (${car.year}) - ${clientPrice.toLocaleString('lt-LT')} €`);
    const body = encodeURIComponent(customMessage);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="p-2.5 rounded-full backdrop-blur bg-background/90 text-muted-foreground active:text-primary active:bg-background transition-all touch-manipulation"
          title="Siųsti klientui"
        >
          <Send className="w-5 h-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Siųsti klientui
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Car Preview */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            {car.image && (
              <img src={car.image} alt={car.title} className="w-20 h-14 object-cover rounded" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{car.brand} {car.model}</p>
              <p className="text-xs text-muted-foreground">{car.year} m. • {car.mileage?.toLocaleString('lt-LT')} km</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground line-through">{car.price.toLocaleString('lt-LT')} €</span>
                <span className="text-sm font-bold text-primary">{clientPrice.toLocaleString('lt-LT')} €</span>
              </div>
            </div>
          </div>

          {/* Markup */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Antkainis (€)</label>
            <div className="flex gap-2">
              {[0, 300, 500, 1000, 1500].map(val => (
                <button
                  key={val}
                  onClick={() => handleMarkupChange(val)}
                  className={cn(
                    "flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors",
                    markup === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  )}
                >
                  {val === 0 ? 'Be' : `+${val}`}
                </button>
              ))}
            </div>
            <Input
              type="number"
              value={markup}
              onChange={(e) => handleMarkupChange(parseInt(e.target.value) || 0)}
              placeholder="Kitas antkainis"
              className="h-9 text-sm"
              min="0"
              step="100"
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Žinutė</label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={7}
              className="resize-none text-sm"
            />
          </div>

          {/* Share Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleWhatsApp} className="gap-2 bg-[#25D366] hover:bg-[#25D366]/90 text-white">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </Button>
            <Button onClick={handleMessenger} className="gap-2 bg-[#0084FF] hover:bg-[#0084FF]/90 text-white">
              <Send className="w-4 h-4" />
              Messenger
            </Button>
            <Button onClick={handleEmail} variant="outline" className="gap-2">
              <Mail className="w-4 h-4" />
              El. paštas
            </Button>
            <Button onClick={handleCopy} variant="outline" className="gap-2">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Nukopijuota!' : 'Kopijuoti'}
            </Button>
          </div>

          {/* Open listing */}
          {car.listingUrl && (
            <a
              href={car.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Atidaryti originalų skelbimą
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ForwardToClient;
