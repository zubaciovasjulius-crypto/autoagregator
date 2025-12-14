import { CarListing } from '@/data/mockCars';
import { MapPin, Fuel, Gauge, Calendar, ExternalLink, Heart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSavedCars } from '@/hooks/useSavedCars';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CarCardProps {
  car: CarListing;
  index: number;
}

const CarCard = ({ car, index }: CarCardProps) => {
  const { user } = useAuth();
  const { isCarSaved, saveCar, removeCar } = useSavedCars();
  
  const isSaved = isCarSaved(car.id);

  const formatPrice = (price: number) => {
    return price.toLocaleString('lt-LT') + ' €';
  };

  const formatMileage = (mileage: number) => {
    return mileage.toLocaleString('lt-LT') + ' km';
  };

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast({
        title: 'Prisijunkite',
        description: 'Norėdami išsaugoti skelbimus, prisijunkite',
        variant: 'destructive',
      });
      return;
    }

    if (isSaved) {
      await removeCar(car.id);
    } else {
      await saveCar(car.id, car.brand, car.model, car.title);
    }
  };

  return (
    <article 
      className="group bg-card rounded-xl overflow-hidden border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-200"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {car.image ? (
          <img
            src={car.image}
            alt={car.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <span className="text-3xl font-bold text-muted-foreground/30">{car.brand}</span>
          </div>
        )}
        {/* Source Badge */}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-1 bg-background/90 backdrop-blur rounded-md text-xs font-medium text-foreground">
            {car.source}
          </span>
        </div>
        {/* Save Button */}
        <button
          onClick={handleSaveToggle}
          className={cn(
            "absolute top-2 right-2 p-2 rounded-full backdrop-blur transition-all",
            isSaved 
              ? "bg-primary text-primary-foreground" 
              : "bg-background/90 text-muted-foreground hover:text-primary hover:bg-background"
          )}
        >
          <Heart className={cn("w-4 h-4", isSaved && "fill-current")} />
        </button>
        {/* Price Badge */}
        <div className="absolute bottom-2 right-2">
          <span className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-bold shadow-lg">
            {formatPrice(car.price)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 md:p-4">
        {/* Title */}
        <h3 className="font-semibold text-sm md:text-base text-foreground line-clamp-1 mb-2 group-hover:text-primary transition-colors">
          {car.brand} {car.model}
        </h3>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary/70" />
            <span>{car.year} m.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-primary/70" />
            <span>{formatMileage(car.mileage)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Fuel className="w-3.5 h-3.5 text-primary/70" />
            <span>{car.fuel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary/70" />
            <span>{car.country}</span>
          </div>
        </div>

        {/* CTA Button */}
        <a
          href={car.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Žiūrėti skelbimą
        </a>
      </div>
    </article>
  );
};

export default CarCard;
