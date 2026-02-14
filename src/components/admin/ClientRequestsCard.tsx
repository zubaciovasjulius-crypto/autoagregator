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
import { Plus, Trash2, Search, Eye, Loader2, Users } from 'lucide-react';

interface ClientRequest {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  brand: string;
  model: string;
  min_year: number | null;
  max_year: number | null;
  min_price: number | null;
  max_price: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  match_count?: number;
  unseen_count?: number;
}

interface MatchedListing {
  id: string;
  listing_id: string;
  seen: boolean;
  created_at: string;
  listing?: {
    id: string;
    title: string;
    brand: string;
    model: string;
    year: number;
    price: number;
    image: string | null;
    listing_url: string | null;
    source: string;
    mileage: number | null;
  };
}

const ClientRequestsCard = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ClientRequest | null>(null);
  const [matches, setMatches] = useState<MatchedListing[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [checkingMatches, setCheckingMatches] = useState<string | null>(null);

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    brand: '',
    model: '',
    min_year: '',
    max_year: '',
    min_price: '',
    max_price: '',
    notes: '',
  });

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_requests' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Load match counts
      const requestsWithCounts = await Promise.all(
        ((data as any[]) || []).map(async (req: any) => {
          const { count } = await supabase
            .from('client_request_matches' as any)
            .select('*', { count: 'exact', head: true })
            .eq('request_id', req.id);
          
          const { count: unseenCount } = await supabase
            .from('client_request_matches' as any)
            .select('*', { count: 'exact', head: true })
            .eq('request_id', req.id)
            .eq('seen', false);

          return { ...req, match_count: count || 0, unseen_count: unseenCount || 0 };
        })
      );

      setRequests(requestsWithCounts);
    } catch (error) {
      console.error('Error loading client requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.client_name || !form.brand || !form.model) {
      toast({ title: 'Klaida', description: 'Užpildykite kliento vardą, markę ir modelį', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('client_requests' as any).insert({
        created_by: user?.id,
        client_name: form.client_name,
        client_email: form.client_email || null,
        client_phone: form.client_phone || null,
        brand: form.brand,
        model: form.model,
        min_year: form.min_year ? parseInt(form.min_year) : null,
        max_year: form.max_year ? parseInt(form.max_year) : null,
        min_price: form.min_price ? parseInt(form.min_price) : null,
        max_price: form.max_price ? parseInt(form.max_price) : null,
        notes: form.notes || null,
      } as any);

      if (error) throw error;

      toast({ title: 'Sukurta', description: 'Kliento paieška pridėta' });
      setForm({ client_name: '', client_email: '', client_phone: '', brand: '', model: '', min_year: '', max_year: '', min_price: '', max_price: '', notes: '' });
      setShowForm(false);
      await loadRequests();
    } catch (error) {
      console.error('Error creating request:', error);
      toast({ title: 'Klaida', description: 'Nepavyko sukurti', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCheckMatches = async (request: ClientRequest) => {
    setCheckingMatches(request.id);
    try {
      // Find matching listings
      let query = supabase
        .from('car_listings')
        .select('id, title, brand, model, year, price, image, listing_url, source, mileage')
        .ilike('brand', `%${request.brand}%`)
        .ilike('model', `%${request.model}%`);

      if (request.min_year) query = query.gte('year', request.min_year);
      if (request.max_year) query = query.lte('year', request.max_year);
      if (request.min_price) query = query.gte('price', request.min_price);
      if (request.max_price) query = query.lte('price', request.max_price);

      const { data: listings, error } = await query;
      if (error) throw error;

      if (!listings || listings.length === 0) {
        toast({ title: 'Rezultatai', description: 'Nerasta atitinkančių skelbimų' });
        setCheckingMatches(null);
        return;
      }

      // Get existing matches to avoid duplicates
      const { data: existingMatches } = await supabase
        .from('client_request_matches' as any)
        .select('listing_id')
        .eq('request_id', request.id);

      const existingIds = new Set((existingMatches as any[] || []).map((m: any) => m.listing_id));
      const newListings = listings.filter(l => !existingIds.has(l.id));

      if (newListings.length > 0) {
        const { error: insertError } = await supabase
          .from('client_request_matches' as any)
          .insert(newListings.map(l => ({
            request_id: request.id,
            listing_id: l.id,
          })) as any);

        if (insertError) throw insertError;
      }

      toast({ 
        title: 'Patikrinta', 
        description: `Rasta ${listings.length} skelbimų (${newListings.length} naujų)` 
      });
      await loadRequests();
    } catch (error) {
      console.error('Error checking matches:', error);
      toast({ title: 'Klaida', description: 'Nepavyko patikrinti', variant: 'destructive' });
    } finally {
      setCheckingMatches(null);
    }
  };

  const handleViewMatches = async (request: ClientRequest) => {
    setSelectedRequest(request);
    setLoadingMatches(true);
    try {
      const { data, error } = await supabase
        .from('client_request_matches' as any)
        .select('*')
        .eq('request_id', request.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Load listing details for each match
      const matchesWithListings = await Promise.all(
        ((data as any[]) || []).map(async (match: any) => {
          const { data: listing } = await supabase
            .from('car_listings')
            .select('id, title, brand, model, year, price, image, listing_url, source, mileage')
            .eq('id', match.listing_id)
            .maybeSingle();
          return { ...match, listing };
        })
      );

      setMatches(matchesWithListings.filter(m => m.listing));

      // Mark all as seen
      await supabase
        .from('client_request_matches' as any)
        .update({ seen: true } as any)
        .eq('request_id', request.id)
        .eq('seen', false);

    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Ar tikrai norite ištrinti šią kliento paiešką?')) return;
    try {
      const { error } = await supabase.from('client_requests' as any).delete().eq('id', id);
      if (error) throw error;
      setRequests(prev => prev.filter(r => r.id !== id));
      toast({ title: 'Pašalinta' });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Klaida', variant: 'destructive' });
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleString('lt-LT');

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Klientų paieškos
              </CardTitle>
              <CardDescription>Ką klientai ieško - automatinis atitikimas su skelbimais</CardDescription>
            </div>
            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-2" />Pridėti</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nauja kliento paieška</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Kliento vardas *</Label>
                    <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Jonas Jonaitis" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>El. paštas</Label>
                      <Input value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} placeholder="jonas@mail.lt" />
                    </div>
                    <div>
                      <Label>Telefonas</Label>
                      <Input value={form.client_phone} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} placeholder="+370..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Markė *</Label>
                      <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="BMW" />
                    </div>
                    <div>
                      <Label>Modelis *</Label>
                      <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="X5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Metai nuo</Label>
                      <Input type="number" value={form.min_year} onChange={e => setForm(f => ({ ...f, min_year: e.target.value }))} placeholder="2018" />
                    </div>
                    <div>
                      <Label>Metai iki</Label>
                      <Input type="number" value={form.max_year} onChange={e => setForm(f => ({ ...f, max_year: e.target.value }))} placeholder="2024" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Kaina nuo (€)</Label>
                      <Input type="number" value={form.min_price} onChange={e => setForm(f => ({ ...f, min_price: e.target.value }))} placeholder="5000" />
                    </div>
                    <div>
                      <Label>Kaina iki (€)</Label>
                      <Input type="number" value={form.max_price} onChange={e => setForm(f => ({ ...f, max_price: e.target.value }))} placeholder="25000" />
                    </div>
                  </div>
                  <div>
                    <Label>Pastabos</Label>
                    <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Papildoma info..." />
                  </div>
                  <Button onClick={handleSubmit} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Pridėti paiešką
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nėra kliento paieškų</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Klientas</TableHead>
                    <TableHead>Ieško</TableHead>
                    <TableHead>Filtrai</TableHead>
                    <TableHead>Atitikimai</TableHead>
                    <TableHead>Veiksmai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{req.client_name}</p>
                          {req.client_phone && <p className="text-xs text-muted-foreground">{req.client_phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{req.brand} {req.model}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {req.min_year || req.max_year ? <div>{req.min_year || '?'}-{req.max_year || '?'} m.</div> : null}
                        {req.min_price || req.max_price ? <div>{req.min_price || '?'}-{req.max_price || '?'} €</div> : null}
                      </TableCell>
                      <TableCell>
                        {(req.unseen_count || 0) > 0 ? (
                          <Badge className="bg-red-500/20 text-red-600 border-red-500/30">
                            {req.unseen_count} nauji / {req.match_count}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{req.match_count || 0}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCheckMatches(req)}
                            disabled={checkingMatches === req.id}
                            title="Tikrinti atitikimus"
                          >
                            {checkingMatches === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          </Button>
                          {(req.match_count || 0) > 0 && (
                            <Button size="sm" variant="outline" onClick={() => handleViewMatches(req)} title="Peržiūrėti">
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(req.id)}>
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

      {/* Matches Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Atitikimai: {selectedRequest?.client_name} — {selectedRequest?.brand} {selectedRequest?.model}
            </DialogTitle>
          </DialogHeader>
          {loadingMatches ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : matches.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nėra atitikimų</p>
          ) : (
            <div className="space-y-3">
              {matches.map(match => match.listing && (
                <div key={match.id} className="flex gap-3 p-3 rounded-lg border bg-card">
                  {match.listing.image && (
                    <img src={match.listing.image} alt="" className="w-24 h-18 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{match.listing.title}</p>
                    <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                      <span>{match.listing.year} m.</span>
                      <span>{match.listing.price.toLocaleString('lt-LT')} €</span>
                      {match.listing.mileage && <span>{match.listing.mileage.toLocaleString()} km</span>}
                      <Badge variant="outline" className="text-xs">{match.listing.source}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {match.listing.listing_url && (
                      <a href={match.listing.listing_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline">Atidaryti</Button>
                      </a>
                    )}
                    {!match.seen && <Badge className="bg-red-500/20 text-red-600 text-xs">Naujas</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientRequestsCard;
