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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand, model, forceRefresh } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If no brand specified, return cached listings
    if (!brand) {
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

    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAllModels = !model || model === '*';
    const allListings: CarListing[] = [];

    // ===== SOURCE 1: TheParking.eu =====
    const theParkingListings = await scrapeTheParking(firecrawlKey, brand, model, isAllModels);
    allListings.push(...theParkingListings);

    // ===== SOURCE 2: Schadeautos.nl =====
    const schadeautosListings = await scrapeSchadeautos(firecrawlKey, brand, model, isAllModels);
    allListings.push(...schadeautosListings);

    console.log(`Total found: ${allListings.length} listings (TheParking: ${theParkingListings.length}, Schadeautos: ${schadeautosListings.length})`);

    if (allListings.length > 0) {
      // Upsert listings
      const { error: upsertError } = await supabase
        .from('car_listings')
        .upsert(allListings, { onConflict: 'external_id,source' });

      if (upsertError) {
        console.error('Upsert error:', upsertError);
      }
    }

    // Return fresh listings from DB for this brand/model
    let query = supabase
      .from('car_listings')
      .select('*')
      .ilike('brand', `%${brand}%`);
    
    if (!isAllModels) {
      query = query.ilike('model', `%${model}%`);
    }
    
    const { data: freshListings } = await query
      .order('scraped_at', { ascending: false })
      .limit(50);

    return new Response(
      JSON.stringify({ success: true, data: freshListings || [], cached: false, count: allListings.length }),
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

async function scrapeTheParking(firecrawlKey: string, brand: string, model: string, isAllModels: boolean): Promise<CarListing[]> {
  try {
    const searchUrl = isAllModels 
      ? `https://www.theparking.eu/used-cars/${brand.toLowerCase()}.html`
      : `https://www.theparking.eu/used-cars/${brand.toLowerCase()}-${model.toLowerCase()}.html`;
    
    console.log(`Scraping TheParking for ${brand} ${isAllModels ? '(all models)' : model}: ${searchUrl}`);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['markdown', 'links', 'html'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error('TheParking scrape error:', scrapeData.error);
      return [];
    }

    return parseTheParkingListings(scrapeData, brand, isAllModels ? '' : model);
  } catch (error) {
    console.error('TheParking error:', error);
    return [];
  }
}

async function scrapeSchadeautos(firecrawlKey: string, brand: string, model: string, isAllModels: boolean): Promise<CarListing[]> {
  try {
    // Schadeautos.nl URL format: /en/cars?make=bmw or /en/cars?make=bmw&model=x5
    const searchUrl = isAllModels 
      ? `https://www.schadeautos.nl/en/cars?make=${brand.toLowerCase()}`
      : `https://www.schadeautos.nl/en/cars?make=${brand.toLowerCase()}&model=${model.toLowerCase()}`;
    
    console.log(`Scraping Schadeautos for ${brand} ${isAllModels ? '(all models)' : model}: ${searchUrl}`);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['markdown', 'links', 'html'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error('Schadeautos scrape error:', scrapeData.error);
      return [];
    }

    return parseSchadeautosListings(scrapeData, brand, isAllModels ? '' : model);
  } catch (error) {
    console.error('Schadeautos error:', error);
    return [];
  }
}

function parseTheParkingListings(scrapeData: any, brand: string, model: string): CarListing[] {
  const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
  const html = scrapeData.data?.html || scrapeData.html || '';
  const links = scrapeData.data?.links || scrapeData.links || [];
  
  const listings: CarListing[] = [];
  
  // Find all detail page links
  const detailLinks: string[] = links.filter((link: string) => 
    link.includes('/used-cars-detail/') || 
    link.includes('theparking.eu/used-cars-detail')
  );
  
  console.log(`TheParking: Found ${detailLinks.length} detail links`);
  
  // Extract images from HTML
  const imageRegex = /https:\/\/(?:cloud\.leparking\.fr|scalethumb\.leparking\.fr)[^"'\s)]+\.(?:jpg|jpeg|png|webp)/gi;
  const imageMatches = html.match(imageRegex) || [];
  const allImages: string[] = [...new Set(imageMatches)] as string[];
  
  // Parse price, year, mileage patterns from markdown
  const pricePattern = /(\d{1,3}[,.]?\d{3})\s*€/g;
  const yearPattern = /\b(20[0-2]\d|201\d|200\d)\b/g;
  const kmPattern = /(\d{1,3}[,.]?\d{3})\s*[Kk]m/g;
  const fuelPattern = /(Diesel|Petrol|Hybrid|Electric|Benzinas|Dyzelinas|Benzin|Elektro)/gi;
  
  const prices: number[] = [];
  let priceMatch;
  while ((priceMatch = pricePattern.exec(markdown)) !== null) {
    const price = parseInt(priceMatch[1].replace(/[,.]/g, ''));
    if (price > 500 && price < 500000) {
      prices.push(price);
    }
  }
  
  const years: number[] = [];
  let yearMatch;
  while ((yearMatch = yearPattern.exec(markdown)) !== null) {
    const year = parseInt(yearMatch[1]);
    if (year >= 2000 && year <= 2025) {
      years.push(year);
    }
  }
  
  const mileages: number[] = [];
  let kmMatch;
  while ((kmMatch = kmPattern.exec(markdown)) !== null) {
    mileages.push(parseInt(kmMatch[1].replace(/[,.]/g, '')));
  }
  
  const fuels: string[] = [];
  let fuelMatch;
  while ((fuelMatch = fuelPattern.exec(markdown)) !== null) {
    fuels.push(fuelMatch[1]);
  }
  
  const countryPattern = /\b(GERMANY|BELGIUM|FRANCE|NETHERLANDS|AUSTRIA|ITALY|SPAIN|POLAND|LITHUANIA|CZECH|VOKIETIJA|BELGIJA|PRANCŪZIJA|OLANDIJA)\b/gi;
  const countries: string[] = [];
  let countryMatch;
  while ((countryMatch = countryPattern.exec(markdown)) !== null) {
    countries.push(countryMatch[1].toUpperCase());
  }
  
  const numListings = Math.min(detailLinks.length, prices.length, 20);
  
  for (let i = 0; i < numListings; i++) {
    const detailUrl = detailLinks[i];
    const price = prices[i];
    const year = years[i] || 2020;
    const mileage = mileages[i] || null;
    const fuel = fuels[i] || 'Diesel';
    const country = countries[i] || 'Europa';
    const image = allImages[i] || null;
    
    const idMatch = detailUrl.match(/\/([A-Z0-9]+)\.html$/i);
    const externalId = idMatch ? `theparking-${idMatch[1]}` : `theparking-${Date.now()}-${i}`;
    
    listings.push({
      external_id: externalId,
      title: `${brand} ${model} ${year}`,
      brand: brand,
      model: model,
      year: year,
      price: price,
      mileage: mileage,
      fuel: normalizeFuel(fuel),
      transmission: 'Automatinė',
      location: null,
      country: normalizeCountry(country),
      source: 'TheParking',
      source_url: 'https://theparking.eu',
      listing_url: detailUrl.startsWith('http') ? detailUrl : `https://www.theparking.eu${detailUrl}`,
      image: image,
    });
  }
  
  return listings;
}

function parseSchadeautosListings(scrapeData: any, brand: string, model: string): CarListing[] {
  const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
  const html = scrapeData.data?.html || scrapeData.html || '';
  const links = scrapeData.data?.links || scrapeData.links || [];
  
  const listings: CarListing[] = [];
  
  // Find car detail links - Schadeautos uses /en/car/ID format
  const detailLinks: string[] = links.filter((link: string) => 
    link.includes('/en/car/') || link.includes('schadeautos.nl/en/car/')
  );
  
  console.log(`Schadeautos: Found ${detailLinks.length} detail links`);
  
  // Extract images
  const imageRegex = /https:\/\/[^"'\s)]+schadeautos[^"'\s)]*\.(?:jpg|jpeg|png|webp)/gi;
  const cdnImageRegex = /https:\/\/[^"'\s)]+(?:cdn|img|images)[^"'\s)]*\.(?:jpg|jpeg|png|webp)/gi;
  const imageMatches = [...(html.match(imageRegex) || []), ...(html.match(cdnImageRegex) || [])];
  const allImages: string[] = [...new Set(imageMatches)] as string[];
  
  // Parse prices (€ format)
  const pricePattern = /€\s*(\d{1,3}[.,]?\d{0,3}[.,]?\d{0,3})/g;
  const altPricePattern = /(\d{1,3}[.,]\d{3})\s*€/g;
  
  const prices: number[] = [];
  let priceMatch;
  while ((priceMatch = pricePattern.exec(markdown)) !== null) {
    const price = parseInt(priceMatch[1].replace(/[,.]/g, ''));
    if (price > 500 && price < 500000) {
      prices.push(price);
    }
  }
  while ((priceMatch = altPricePattern.exec(markdown)) !== null) {
    const price = parseInt(priceMatch[1].replace(/[,.]/g, ''));
    if (price > 500 && price < 500000 && !prices.includes(price)) {
      prices.push(price);
    }
  }
  
  // Parse years
  const yearPattern = /\b(20[0-2]\d|201\d|200\d)\b/g;
  const years: number[] = [];
  let yearMatch;
  while ((yearMatch = yearPattern.exec(markdown)) !== null) {
    const year = parseInt(yearMatch[1]);
    if (year >= 2000 && year <= 2025) {
      years.push(year);
    }
  }
  
  // Parse mileage (km)
  const kmPattern = /(\d{1,3}[.,]?\d{3})\s*km/gi;
  const mileages: number[] = [];
  let kmMatch;
  while ((kmMatch = kmPattern.exec(markdown)) !== null) {
    mileages.push(parseInt(kmMatch[1].replace(/[,.]/g, '')));
  }
  
  // Parse fuel types
  const fuelPattern = /(Diesel|Petrol|Benzine|Hybrid|Electric|LPG)/gi;
  const fuels: string[] = [];
  let fuelMatch;
  while ((fuelMatch = fuelPattern.exec(markdown)) !== null) {
    fuels.push(fuelMatch[1]);
  }
  
  const numListings = Math.min(detailLinks.length, Math.max(prices.length, 1), 20);
  
  for (let i = 0; i < numListings; i++) {
    const detailUrl = detailLinks[i];
    const price = prices[i] || 0;
    const year = years[i] || 2020;
    const mileage = mileages[i] || null;
    const fuel = fuels[i] || 'Diesel';
    const image = allImages[i] || null;
    
    // Extract ID from URL
    const idMatch = detailUrl.match(/\/car\/(\d+)/i);
    const externalId = idMatch ? `schadeautos-${idMatch[1]}` : `schadeautos-${Date.now()}-${i}`;
    
    if (price > 0) {
      listings.push({
        external_id: externalId,
        title: `${brand} ${model || ''} ${year}`.trim(),
        brand: brand,
        model: model || '',
        year: year,
        price: price,
        mileage: mileage,
        fuel: normalizeFuel(fuel),
        transmission: 'Automatinė',
        location: 'Olandija',
        country: 'Olandija',
        source: 'Schadeautos',
        source_url: 'https://schadeautos.nl',
        listing_url: detailUrl.startsWith('http') ? detailUrl : `https://www.schadeautos.nl${detailUrl}`,
        image: image,
      });
    }
  }
  
  return listings;
}

function normalizeFuel(fuel: string): string {
  const f = fuel.toLowerCase();
  if (f.includes('diesel') || f.includes('dyzel')) return 'Dyzelinas';
  if (f.includes('petrol') || f.includes('benzin')) return 'Benzinas';
  if (f.includes('hybrid')) return 'Hibridas';
  if (f.includes('electric') || f.includes('elektro')) return 'Elektra';
  if (f.includes('lpg')) return 'LPG';
  return 'Dyzelinas';
}

function normalizeCountry(country: string): string {
  const c = country.toUpperCase();
  if (c.includes('GERMANY') || c.includes('VOKIETIJA')) return 'Vokietija';
  if (c.includes('BELGIUM') || c.includes('BELGIJA')) return 'Belgija';
  if (c.includes('FRANCE') || c.includes('PRANCŪZIJA')) return 'Prancūzija';
  if (c.includes('NETHERLANDS') || c.includes('OLANDIJA')) return 'Olandija';
  if (c.includes('AUSTRIA')) return 'Austrija';
  if (c.includes('ITALY')) return 'Italija';
  if (c.includes('SPAIN')) return 'Ispanija';
  if (c.includes('POLAND')) return 'Lenkija';
  if (c.includes('LITHUANIA')) return 'Lietuva';
  if (c.includes('CZECH')) return 'Čekija';
  return 'Europa';
}
