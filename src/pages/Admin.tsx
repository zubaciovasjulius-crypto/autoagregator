import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, Trash2, ArrowLeft, Loader2, Shield, Database, Users, Check, X } from 'lucide-react';
import Header from '@/components/Header';

interface ScrapeStatus {
  id: string;
  source: string;
  status: string | null;
  last_scraped_at: string | null;
  listings_count: number | null;
  error_message: string | null;
}

interface CarListing {
  id: string;
  title: string;
  brand: string;
  model: string;
  price: number;
  source: string;
  scraped_at: string;
}

interface UserProfile {
  id: string;
  email: string | null;
  created_at: string;
  approved: boolean;
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  
  const [scrapeStatuses, setScrapeStatuses] = useState<ScrapeStatus[]>([]);
  const [listings, setListings] = useState<CarListing[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingSource, setLoadingSource] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin && user) {
      toast({
        title: 'Prieiga uždrausta',
        description: 'Jūs neturite administratoriaus teisių',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [isAdmin, adminLoading, user, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const [statusRes, listingsRes, usersRes] = await Promise.all([
        supabase.from('scrape_status').select('*').order('source'),
        supabase.from('car_listings').select('id, title, brand, model, price, source, scraped_at').order('scraped_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('id, email, created_at, approved').order('created_at', { ascending: false }),
      ]);

      if (statusRes.data) setScrapeStatuses(statusRes.data);
      if (listingsRes.data) setListings(listingsRes.data);
      if (usersRes.data) setUsers(usersRes.data);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleScrape = async (source: string) => {
    setLoadingSource(source);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-cars', {
        body: { source, forceRefresh: true },
      });

      if (error) throw error;

      toast({
        title: 'Scrapinimas baigtas',
        description: `${source}: rasta ${data?.data?.length || 0} skelbimų`,
      });

      await loadData();
    } catch (error) {
      console.error('Scrape error:', error);
      toast({
        title: 'Klaida',
        description: `Nepavyko scrapinti ${source}`,
        variant: 'destructive',
      });
    } finally {
      setLoadingSource(null);
    }
  };

  const handleDeleteListing = async (id: string) => {
    try {
      const { error } = await supabase.from('car_listings').delete().eq('id', id);
      if (error) throw error;
      
      setListings(prev => prev.filter(l => l.id !== id));
      toast({ title: 'Pašalinta', description: 'Skelbimas pašalintas' });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Klaida', description: 'Nepavyko pašalinti', variant: 'destructive' });
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Ar tikrai norite išvalyti visus skelbimus?')) return;
    
    try {
      const { error } = await supabase.from('car_listings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      
      setListings([]);
      toast({ title: 'Išvalyta', description: 'Visi skelbimai pašalinti' });
    } catch (error) {
      console.error('Clear error:', error);
      toast({ title: 'Klaida', description: 'Nepavyko išvalyti', variant: 'destructive' });
    }
  };

  const handleApproveUser = async (userId: string, approve: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approved: approve })
        .eq('id', userId);
      
      if (error) throw error;
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, approved: approve } : u));
      toast({ 
        title: approve ? 'Patvirtinta' : 'Atšaukta', 
        description: approve ? 'Vartotojas patvirtintas' : 'Patvirtinimas atšauktas' 
      });
    } catch (error) {
      console.error('Approve error:', error);
      toast({ title: 'Klaida', description: 'Nepavyko atnaujinti', variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId: string, email: string | null) => {
    if (!confirm(`Ar tikrai norite ištrinti vartotoją ${email || userId}?`)) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast({ title: 'Pašalinta', description: 'Vartotojas pašalintas' });
    } catch (error) {
      console.error('Delete user error:', error);
      toast({ title: 'Klaida', description: 'Nepavyko pašalinti vartotojo', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Baigta</Badge>;
      case 'scraping':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Vyksta</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Klaida</Badge>;
      default:
        return <Badge variant="secondary">Laukia</Badge>;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('lt-LT');
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin panelė</h1>
              <p className="text-sm text-muted-foreground">Valdyk scrapinimą ir skelbimus</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Scrape Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Šaltinių būsena
              </CardTitle>
              <CardDescription>Scrapinimo statusas ir valdymas</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Šaltinis</TableHead>
                      <TableHead>Būsena</TableHead>
                      <TableHead>Paskutinis</TableHead>
                      <TableHead>Kiekis</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scrapeStatuses.map((status) => (
                      <TableRow key={status.id}>
                        <TableCell className="font-medium">{status.source}</TableCell>
                        <TableCell>{getStatusBadge(status.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(status.last_scraped_at)}
                        </TableCell>
                        <TableCell>{status.listings_count || 0}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleScrape(status.source)}
                            disabled={loadingSource === status.source}
                          >
                            {loadingSource === status.source ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Statistika
              </CardTitle>
              <CardDescription>Bendra informacija</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{listings.length}</p>
                  <p className="text-sm text-muted-foreground">Skelbimai DB</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{scrapeStatuses.length}</p>
                  <p className="text-sm text-muted-foreground">Šaltiniai</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={loadData} variant="outline" className="flex-1">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atnaujinti
                </Button>
                <Button onClick={handleClearAll} variant="destructive" className="flex-1">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Išvalyti visus
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Registered Users Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Registruoti vartotojai ({users.length})
            </CardTitle>
            <CardDescription>Visi prisiregistravę vartotojai</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nėra registruotų vartotojų</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>El. paštas</TableHead>
                      <TableHead>Būsena</TableHead>
                      <TableHead>Registracijos data</TableHead>
                      <TableHead>Veiksmai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userItem) => (
                      <TableRow key={userItem.id}>
                        <TableCell className="font-medium">{userItem.email || '-'}</TableCell>
                        <TableCell>
                          {userItem.approved ? (
                            <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                              Patvirtintas
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                              Laukia patvirtinimo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(userItem.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {!userItem.approved ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:bg-green-500/10"
                                onClick={() => handleApproveUser(userItem.id, true)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-yellow-600 hover:bg-yellow-500/10"
                                onClick={() => handleApproveUser(userItem.id, false)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteUser(userItem.id, userItem.email)}
                            >
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

        {/* Listings Table */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Skelbimai duomenų bazėje</CardTitle>
            <CardDescription>Paskutiniai 50 skelbimų</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : listings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nėra skelbimų</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pavadinimas</TableHead>
                      <TableHead>Markė</TableHead>
                      <TableHead>Modelis</TableHead>
                      <TableHead>Kaina</TableHead>
                      <TableHead>Šaltinis</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listings.map((listing) => (
                      <TableRow key={listing.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{listing.title}</TableCell>
                        <TableCell>{listing.brand}</TableCell>
                        <TableCell>{listing.model}</TableCell>
                        <TableCell>{listing.price.toLocaleString('lt-LT')} €</TableCell>
                        <TableCell>
                          <Badge variant="outline">{listing.source}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(listing.scraped_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteListing(listing.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
