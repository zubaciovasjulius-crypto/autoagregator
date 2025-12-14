import { carSources } from '@/data/mockCars';
import { Globe, Loader2 } from 'lucide-react';

interface SourceStatsProps {
  sourceCounts: Record<string, number>;
  onSourceClick?: (source: string) => void;
  isLoading?: boolean;
}

const SourceStats = ({ sourceCounts, onSourceClick, isLoading }: SourceStatsProps) => {
  return (
    <div className="bg-gradient-card rounded-xl p-4 border border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold text-foreground">Šaltiniai</h3>
        {isLoading && <Loader2 className="w-4 h-4 text-primary animate-spin ml-auto" />}
      </div>
      <div className="space-y-2">
        {carSources.map((source) => (
          <button
            key={source.name}
            onClick={() => onSourceClick?.(source.name)}
            disabled={isLoading}
            className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50 hover:bg-secondary hover:border-primary/50 border border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary group-hover:animate-pulse" />
              <span className="text-sm text-foreground">{source.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{source.country}</span>
              <span className="text-sm font-medium text-primary min-w-[24px] text-right">
                {sourceCounts[source.name] || 0}
              </span>
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Paspausk šaltinį, kad atnaujintum
      </p>
    </div>
  );
};

export default SourceStats;
