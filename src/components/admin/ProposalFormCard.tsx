import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Copy, ExternalLink, Loader2, FileText } from 'lucide-react';

interface Proposal {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  car_price: number;
  transport_price: number;
  repair_price: number;
  total_price: number;
  share_token: string;
  client_name: string | null;
  client_email: string | null;
  status: string;
  created_at: string;
}

const ProposalFormCard = () => {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    client_name: '',
    client_email: '',
    car_price: '',
    transport_price: '',
    repair_price: '',
    images: '' as string, // comma separated URLs
  });

  // For selecting from existing listings
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('proposals' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProposals((data as any[]) || []);
    } catch (error) {
      console.error('Error loading proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchListing = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('car_listings')
        .select('id, title, brand, model, year, price, image, listing_url')
        .or(`title.ilike.%${searchQuery}%,brand.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%`)
        .limit(10);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectListing = (listing: any) => {
    setForm(f => ({
      ...f,
      title: listing.title || `${listing.brand} ${listing.model} ${listing.year}`,
      car_price: String(listing.price || ''),
      images: listing.image || '',
    }));
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSubmit = async () => {
    if (!form.title) {
      toast({ title: 'Klaida', description: 'Įveskite pavadinimą', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const imagesArray = form.images
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const { error } = await supabase.from('proposals' as any).insert({
        created_by: user?.id,
        title: form.title,
        description: form.description || null,
        client_name: form.client_name || null,
        client_email: form.client_email || null,
        car_price: parseInt(form.car_price) || 0,
        transport_price: parseInt(form.transport_price) || 0,
        repair_price: parseInt(form.repair_price) || 0,
        images: imagesArray,
      } as any);

      if (error) throw error;

      toast({ title: 'Sukurta', description: 'Pasiūlymas sukurtas' });
      setForm({ title: '', description: '', client_name: '', client_email: '', car_price: '', transport_price: '', repair_price: '', images: '' });
      setShowForm(false);
      await loadProposals();
    } catch (error) {
      console.error('Error creating proposal:', error);
      toast({ title: 'Klaida', description: 'Nepavyko sukurti', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/proposal/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Nukopijuota', description: 'Nuoroda nukopijuota' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Ar tikrai norite ištrinti šį pasiūlymą?')) return;
    try {
      const { error } = await supabase.from('proposals' as any).delete().eq('id', id);
      if (error) throw error;
      setProposals(prev => prev.filter(p => p.id !== id));
      toast({ title: 'Pašalinta' });
    } catch (error) {
      toast({ title: 'Klaida', variant: 'destructive' });
    }
  };

  const totalPrice = (parseInt(form.car_price) || 0) + (parseInt(form.transport_price) || 0) + (parseInt(form.repair_price) || 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Pasiūlymai klientams
            </CardTitle>
            <CardDescription>Sukurkite pasiūlymus su kainomis ir nuotraukomis</CardDescription>
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-2" />Naujas</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Naujas pasiūlymas</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {/* Search existing listing */}
                <div>
                  <Label>Rasti skelbimą (užpildyti automatiškai)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Ieškoti pagal markę, modelį..."
                      onKeyDown={e => e.key === 'Enter' && handleSearchListing()}
                    />
                    <Button variant="outline" onClick={handleSearchListing} disabled={searching}>
                      {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ieškoti'}
                    </Button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                      {searchResults.map(l => (
                        <button
                          key={l.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between"
                          onClick={() => handleSelectListing(l)}
                        >
                          <span className="truncate">{l.title}</span>
                          <span className="text-muted-foreground ml-2">{l.price?.toLocaleString()} €</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Kliento vardas</Label>
                    <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Kliento el. paštas</Label>
                    <Input value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <Label>Pavadinimas *</Label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="BMW X5 2020 M-paketas" />
                </div>
                <div>
                  <Label>Aprašymas</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Aprašymas klientui..." rows={3} />
                </div>
                <div>
                  <Label>Nuotraukų URL (atskirti kableliais)</Label>
                  <Textarea value={form.images} onChange={e => setForm(f => ({ ...f, images: e.target.value }))} placeholder="https://... , https://..." rows={2} />
                </div>

                <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <p className="text-sm font-medium">Kainos sudėtis</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Auto kaina (€)</Label>
                      <Input type="number" value={form.car_price} onChange={e => setForm(f => ({ ...f, car_price: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Transportavimas (€)</Label>
                      <Input type="number" value={form.transport_price} onChange={e => setForm(f => ({ ...f, transport_price: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Remontas (€)</Label>
                      <Input type="number" value={form.repair_price} onChange={e => setForm(f => ({ ...f, repair_price: e.target.value }))} />
                    </div>
                  </div>
                  <div className="text-right text-lg font-bold text-primary">
                    Viso: {totalPrice.toLocaleString('lt-LT')} €
                  </div>
                </div>

                <Button onClick={handleSubmit} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Sukurti pasiūlymą
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : proposals.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nėra pasiūlymų</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pavadinimas</TableHead>
                  <TableHead>Klientas</TableHead>
                  <TableHead>Kaina</TableHead>
                  <TableHead>Būsena</TableHead>
                  <TableHead>Veiksmai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{p.title}</TableCell>
                    <TableCell>{p.client_name || '-'}</TableCell>
                    <TableCell>{p.total_price?.toLocaleString('lt-LT')} €</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'draft' ? 'secondary' : 'default'}>
                        {p.status === 'draft' ? 'Juodraštis' : 'Išsiųstas'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleCopyLink(p.share_token)} title="Kopijuoti nuorodą">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <a href={`/proposal/${p.share_token}`} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" title="Peržiūrėti">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </a>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProposalFormCard;
