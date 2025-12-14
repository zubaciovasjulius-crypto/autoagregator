import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CarListing {
  external_id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number | null;
  fuel: string | null;
  transmission: string | null;
  location: string | null;
  country: string;
  source: string;
  source_url: string;
  listing_url: string | null;
  image: string | null;
}

const sourceConfigs: Record<string, { url: string; country: string; sourceUrl: string }> = {
  'mobile.de': {
    url: 'https://suchen.mobile.de/fahrzeuge/search.html?s=Car&vc=Car',
    country: 'Vokietija',
    sourceUrl: 'https://mobile.de',
  },
  'autoscout24': {
    url: 'https://www.autoscout24.de/lst?sort=standard&desc=0',
    country: 'Vokietija',
    sourceUrl: 'https://autoscout24.de',
  },
  'autoplius': {
    url: 'https://autoplius.lt/skelbimai/naudoti-automobiliai?category_id=2',
    country: 'Lietuva',
    sourceUrl: 'https://autoplius.lt',
  },
};

const carBrands = ['BMW', 'Mercedes', 'Audi', 'Volkswagen', 'VW', 'Toyota', 'Porsche', 'Tesla', 'Volvo', 'Skoda', 'Ford', 'Opel', 'Honda', 'Kia', 'Hyundai', 'Mazda', 'Lexus', 'Nissan', 'Peugeot', 'Renault'];

const defaultImages: Record<string, string> = {
  BMW: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&q=80',
  Mercedes: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=600&q=80',
  Audi: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=600&q=80',
  Volkswagen: 'https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=600&q=80',
  VW: 'https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=600&q=80',
  Porsche: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80',
  Tesla: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=600&q=80',
  Toyota: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=600&q=80',
  Volvo: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&q=80',
  default: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&q=80',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { source, forceRefresh } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If no source specified, return cached listings
    if (!source) {
      const { data: listings, error } = await supabase
        .from('car_listings')
        .select('*')
        .order('scraped_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: listings, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = sourceConfigs[source];
    if (!config) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unknown source' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we should scrape (not scraped in last 5 minutes unless forced)
    const { data: status } = await supabase
      .from('scrape_status')
      .select('*')
      .eq('source', source)
      .single();

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    if (!forceRefresh && status?.last_scraped_at && status.last_scraped_at > fiveMinutesAgo) {
      // Return cached data
      const { data: listings } = await supabase
        .from('car_listings')
        .select('*')
        .eq('source', source)
        .order('scraped_at', { ascending: false })
        .limit(50);

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: listings || [], 
          cached: true,
          lastScraped: status.last_scraped_at 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to scraping
    await supabase
      .from('scrape_status')
      .update({ status: 'scraping', error_message: null })
      .eq('source', source);

    console.log(`Scraping ${source}: ${config.url}`);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: config.url,
        formats: ['markdown', 'links'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      const errorMsg = scrapeData.error || 'Scraping failed';
      await supabase
        .from('scrape_status')
        .update({ status: 'error', error_message: errorMsg })
        .eq('source', source);

      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: scrapeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse listings
    const listings = parseListings(scrapeData, source, config);

    if (listings.length > 0) {
      // Upsert listings
      const { error: upsertError } = await supabase
        .from('car_listings')
        .upsert(listings, { onConflict: 'external_id,source' });

      if (upsertError) {
        console.error('Upsert error:', upsertError);
      }
    }

    // Update status
    await supabase
      .from('scrape_status')
      .update({ 
        status: 'completed', 
        last_scraped_at: new Date().toISOString(),
        listings_count: listings.length,
        error_message: null
      })
      .eq('source', source);

    console.log(`Found ${listings.length} listings from ${source}`);

    // Return fresh listings from DB
    const { data: freshListings } = await supabase
      .from('car_listings')
      .select('*')
      .eq('source', source)
      .order('scraped_at', { ascending: false })
      .limit(50);

    return new Response(
      JSON.stringify({ success: true, data: freshListings || [], cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseListings(scrapeData: any, source: string, config: { country: string; sourceUrl: string }): CarListing[] {
  const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
  const listings: CarListing[] = [];
  const lines = markdown.split('\n').filter((l: string) => l.trim());
  
  let currentListing: Partial<CarListing> | null = null;

  for (const line of lines) {
    const priceMatch = line.match(/(\d{1,3}[.,]?\d{3})\s*€/) || line.match(/€\s*(\d{1,3}[.,]?\d{3})/);
    const yearMatch = line.match(/\b(20[0-2]\d|19\d{2})\b/);
    const kmMatch = line.match(/(\d{1,3}[.,]?\d{3})\s*km/i);
    
    const foundBrand = carBrands.find(b => line.toUpperCase().includes(b.toUpperCase()));
    
    if (foundBrand && !currentListing) {
      const brandName = foundBrand === 'VW' ? 'Volkswagen' : foundBrand;
      currentListing = {
        external_id: `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: line.slice(0, 100).trim().replace(/[#*\[\]\\]/g, ''),
        brand: brandName,
        model: extractModel(line, brandName),
        source: source,
        source_url: config.sourceUrl,
        country: config.country,
        fuel: 'Dyzelinas',
        transmission: 'Automatinė',
        image: defaultImages[foundBrand] || defaultImages.default,
        listing_url: config.sourceUrl,
      };
    }
    
    if (currentListing) {
      if (priceMatch) currentListing.price = parseInt(priceMatch[1].replace(/[.,]/g, ''));
      if (yearMatch) currentListing.year = parseInt(yearMatch[1]);
      if (kmMatch) currentListing.mileage = parseInt(kmMatch[1].replace(/[.,]/g, ''));
      
      if (currentListing.price && currentListing.year && currentListing.brand) {
        currentListing.location = getRandomLocation(source);
        listings.push(currentListing as CarListing);
        currentListing = null;
        
        if (listings.length >= 20) break;
      }
    }
  }
  
  return listings;
}

function extractModel(line: string, brand: string): string {
  const models: Record<string, string[]> = {
    BMW: ['X5', 'X3', 'X1', 'M3', 'M5', '520', '530', '320', '330', '118', '120'],
    'Mercedes-Benz': ['E220', 'C200', 'GLC', 'GLE', 'A200', 'S350'],
    Mercedes: ['E220', 'C200', 'GLC', 'GLE', 'A200', 'S350'],
    Audi: ['A4', 'A6', 'Q5', 'Q7', 'A3', 'e-tron'],
    Volkswagen: ['Golf', 'Passat', 'Tiguan', 'Polo', 'ID.4'],
    Porsche: ['Cayenne', 'Macan', 'Taycan', '911'],
    Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X'],
    Toyota: ['RAV4', 'Corolla', 'Camry', 'Yaris'],
    Volvo: ['XC60', 'XC90', 'V60', 'S90'],
  };

  const brandModels = models[brand] || [];
  const found = brandModels.find(m => line.toUpperCase().includes(m.toUpperCase()));
  return found || 'Modelis';
}

function getRandomLocation(source: string): string {
  const locations: Record<string, string[]> = {
    'mobile.de': ['Berlynas', 'Miunchenas', 'Hamburgas', 'Frankfurtas', 'Štutgartas'],
    'autoscout24': ['Štutgartas', 'Diuseldorfas', 'Kelnas', 'Drezdenas', 'Leipcigas'],
    'autoplius': ['Vilnius', 'Kaunas', 'Klaipėda', 'Šiauliai', 'Panevėžys'],
  };
  const locs = locations[source] || ['Nežinoma'];
  return locs[Math.floor(Math.random() * locs.length)];
}
