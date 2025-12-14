import { CarListing } from '@/data/mockCars';
import { MapPin, Fuel, Gauge, Calendar, Zap, ExternalLink, Download, Images } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface CarCardProps {
  car: CarListing;
  index: number;
}

const CarCard = ({ car, index }: CarCardProps) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('lt-LT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatMileage = (mileage: number) => {
    return new Intl.NumberFormat('lt-LT').format(mileage) + ' km';
  };

  const downloadAllImages = async () => {
    const images = car.images || [car.image];
    
    toast({
      title: 'Parsisiunčiama...',
      description: `${images.length} nuotrauka(-os)`,
    });

    for (let i = 0; i < images.length; i++) {
      try {
        const response = await fetch(images[i]);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${car.brand}_${car.model}_${car.year}_${i + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error('Error downloading image:', error);
      }
    }

    toast({
      title: 'Parsisiųsta!',
      description: `${images.length} nuotrauka(-os) išsaugota`,
    });
  };

  const imageCount = car.images?.length || 1;

  return (
    <div 
      className="group bg-gradient-card rounded-xl overflow-hidden shadow-card border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-glow animate-slide-up"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Image */}
      <div className="relative h-40 md:h-48 overflow-hidden">
        <img
          src={car.image}
          alt={car.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
        
        {/* Source Badge */}
        <Badge 
          variant="secondary" 
          className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-foreground border-none text-xs"
        >
          {car.source}
        </Badge>

        {/* Image Count Badge */}
        {imageCount > 1 && (
          <Badge 
            variant="secondary" 
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-foreground border-none text-xs gap-1"
          >
            <Images className="w-3 h-3" />
            {imageCount}
          </Badge>
        )}

        {/* Price */}
        <div className="absolute bottom-2 right-2">
          <span className="text-xl md:text-2xl font-display font-bold text-gradient">
            {formatPrice(car.price)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 md:p-4 space-y-2 md:space-y-3">
        {/* Title */}
        <h3 className="font-display font-semibold text-sm md:text-lg text-foreground truncate group-hover:text-primary transition-colors">
          {car.title}
        </h3>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-1.5 md:gap-2 text-xs md:text-sm">
          <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground">
            <Calendar className="w-3 h-3 md:w-4 md:h-4 text-primary flex-shrink-0" />
            <span>{car.year}</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground">
            <Gauge className="w-3 h-3 md:w-4 md:h-4 text-primary flex-shrink-0" />
            <span className="truncate">{formatMileage(car.mileage)}</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground">
            <Fuel className="w-3 h-3 md:w-4 md:h-4 text-primary flex-shrink-0" />
            <span>{car.fuel}</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground">
            <Zap className="w-3 h-3 md:w-4 md:h-4 text-primary flex-shrink-0" />
            <span>{car.power} AG</span>
          </div>
        </div>

        {/* Location & Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2">
          <div className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground min-w-0">
            <MapPin className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
            <span className="truncate">{car.location}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadAllImages}
              className="h-7 md:h-8 px-2 text-primary hover:text-primary/80 hover:bg-primary/10"
              title="Parsisiųsti nuotraukas"
            >
              <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Button>
            <a 
              href={car.sourceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs md:text-sm text-primary hover:text-primary/80 transition-colors px-2 py-1"
            >
              <ExternalLink className="w-3 h-3 md:w-3.5 md:h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CarCard;
