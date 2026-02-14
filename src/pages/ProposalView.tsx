import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Car, Truck, Wrench, Calculator } from 'lucide-react';
import autoKopersLogo from '@/assets/autokopers-logo.png';

interface Proposal {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  car_price: number;
  transport_price: number;
  repair_price: number;
  total_price: number;
  client_name: string | null;
  created_at: string;
}

const ProposalView = () => {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (token) loadProposal(token);
  }, [token]);

  const loadProposal = async (shareToken: string) => {
    try {
      const { data, error } = await supabase
        .from('proposals' as any)
        .select('*')
        .eq('share_token', shareToken)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setNotFound(true);
      } else {
        setProposal(data as any);
      }
    } catch (error) {
      console.error('Error loading proposal:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !proposal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Pasiūlymas nerastas</h1>
          <p className="text-muted-foreground">Ši nuoroda nebegalioja arba neegzistuoja.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={autoKopersLogo} alt="AutoKopers" className="h-10" />
          <div>
            <h1 className="text-lg font-bold">Pasiūlymas</h1>
            {proposal.client_name && (
              <p className="text-sm text-muted-foreground">Klientui: {proposal.client_name}</p>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold mb-6">{proposal.title}</h2>

        {/* Images */}
        {proposal.images && proposal.images.length > 0 && (
          <div className="mb-8">
            <div className="rounded-xl overflow-hidden border bg-card">
              <img
                src={proposal.images[activeImage]}
                alt={proposal.title}
                className="w-full h-64 md:h-96 object-cover"
              />
            </div>
            {proposal.images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                {proposal.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                      i === activeImage ? 'border-primary ring-2 ring-primary/30' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {proposal.description && (
          <div className="mb-8 p-4 rounded-xl bg-card border">
            <p className="text-foreground whitespace-pre-wrap">{proposal.description}</p>
          </div>
        )}

        {/* Price Breakdown */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Kainos sudėtis
            </h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Car className="w-4 h-4" />
                Automobilio kaina
              </span>
              <span className="font-medium">{proposal.car_price.toLocaleString('lt-LT')} €</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Truck className="w-4 h-4" />
                Transportavimas
              </span>
              <span className="font-medium">{proposal.transport_price.toLocaleString('lt-LT')} €</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Wrench className="w-4 h-4" />
                Remontas
              </span>
              <span className="font-medium">{proposal.repair_price.toLocaleString('lt-LT')} €</span>
            </div>
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Viso</span>
                <span className="text-2xl font-bold text-primary">
                  {proposal.total_price.toLocaleString('lt-LT')} €
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Pasiūlymas sugeneruotas {new Date(proposal.created_at).toLocaleDateString('lt-LT')}</p>
          <p className="mt-1">© AutoKopers</p>
        </div>
      </main>
    </div>
  );
};

export default ProposalView;
