import { CarListing } from '@/data/mockCars';
import { MapPin, Fuel, Gauge, Calendar, Zap, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

  return (
    <div 
      className="group bg-gradient-card rounded-xl overflow-hidden shadow-card border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-glow animate-slide-up"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={car.image}
          alt={car.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
        
        {/* Source Badge */}
        <Badge 
          variant="secondary" 
          className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm text-foreground border-none"
        >
          {car.source}
        </Badge>

        {/* Price */}
        <div className="absolute bottom-3 right-3">
          <span className="text-2xl font-display font-bold text-gradient">
            {formatPrice(car.price)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-display font-semibold text-lg text-foreground truncate group-hover:text-primary transition-colors">
          {car.title}
        </h3>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{car.year}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Gauge className="w-4 h-4 text-primary" />
            <span>{formatMileage(car.mileage)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Fuel className="w-4 h-4 text-primary" />
            <span>{car.fuel}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="w-4 h-4 text-primary" />
            <span>{car.power} AG</span>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{car.location}, {car.country}</span>
          </div>
          <a 
            href={car.sourceUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <span>Žiūrėti</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default CarCard;
