import { carSources } from '@/data/mockCars';
import { Globe } from 'lucide-react';

interface SourceStatsProps {
  sourceCounts: Record<string, number>;
}

const SourceStats = ({ sourceCounts }: SourceStatsProps) => {
  return (
    <div className="bg-gradient-card rounded-xl p-4 border border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold text-foreground">Šaltiniai</h3>
      </div>
      <div className="space-y-2">
        {carSources.map((source) => (
          <div
            key={source.name}
            className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm text-foreground">{source.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{source.country}</span>
              <span className="text-sm font-medium text-primary">
                {sourceCounts[source.name] || 0}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SourceStats;
