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

// Known car brands for parsing
const CAR_BRANDS = [
  'ABARTH', 'ACURA', 'ALFA ROMEO', 'ASTON MARTIN', 'AUDI', 'BENTLEY', 'BMW', 
  'BUGATTI', 'BUICK', 'CADILLAC', 'CHEVROLET', 'CHRYSLER', 'CITROEN', 'CUPRA',
  'DACIA', 'DAEWOO', 'DAIHATSU', 'DODGE', 'DS', 'FERRARI', 'FIAT', 'FORD',
  'GENESIS', 'GMC', 'HONDA', 'HUMMER', 'HYUNDAI', 'INFINITI', 'ISUZU', 'IVECO',
  'JAGUAR', 'JEEP', 'KIA', 'KOENIGSEGG', 'LADA', 'LAMBORGHINI', 'LANCIA', 
  'LAND ROVER', 'LEXUS', 'LINCOLN', 'LOTUS', 'MASERATI', 'MAYBACH', 'MAZDA',
  'MCLAREN', 'MERCEDES', 'MERCEDES-BENZ', 'MINI', 'MITSUBISHI', 'NISSAN', 
  'OPEL', 'PAGANI', 'PEUGEOT', 'PLYMOUTH', 'POLESTAR', 'PONTIAC', 'PORSCHE',
  'RAM', 'RANGE ROVER', 'RENAULT', 'ROLLS ROYCE', 'ROLLS-ROYCE', 'SAAB', 'SEAT',
  'SKODA', 'SMART', 'SSANGYONG', 'SUBARU', 'SUZUKI', 'TESLA', 'TOYOTA', 
  'VAUXHALL', 'VOLKSWAGEN', 'VW', 'VOLVO'
];

function normalizeBrand(brand: string): string {
  const b = brand.toUpperCase().trim();
  if (b === 'VW') return 'VOLKSWAGEN';
  if (b === 'MERCEDES-BENZ' || b === 'MB') return 'MERCEDES';
  if (b === 'ROLLS-ROYCE') return 'ROLLS ROYCE';
  return b;
}

function normalizeFuel(fuel: string): string {
  const f = fuel.toLowerCase();
  if (f.includes('diesel') || f.includes('dyzel')) return 'Dyzelinas';
  if (f.includes('petrol') || f.includes('benzin')) return 'Benzinas';
  if (f.includes('hybrid')) return 'Hibridas';
  if (f.includes('electric') || f.includes('elektro') || f.includes('ev')) return 'Elektra';
  if (f.includes('lpg') || f.includes('gas')) return 'LPG';
  return 'Dyzelinas';
}

function normalizeCountry(country: string): string {
  const c = country.toUpperCase();
  if (c.includes('GERMANY') || c.includes('VOKIETIJA') || c.includes('DE')) return 'Vokietija';
  if (c.includes('BELGIUM') || c.includes('BELGIJA') || c.includes('BE')) return 'Belgija';
  if (c.includes('FRANCE') || c.includes('PRANCŪZIJA') || c.includes('FR')) return 'Prancūzija';
  if (c.includes('NETHERLANDS') || c.includes('OLANDIJA') || c.includes('NL') || c.includes('HOLLAND')) return 'Olandija';
  if (c.includes('AUSTRIA') || c.includes('AT')) return 'Austrija';
  if (c.includes('ITALY') || c.includes('IT')) return 'Italija';
  if (c.includes('SPAIN') || c.includes('ES')) return 'Ispanija';
  if (c.includes('POLAND') || c.includes('PL')) return 'Lenkija';
  if (c.includes('LITHUANIA') || c.includes('LT')) return 'Lietuva';
  if (c.includes('CZECH') || c.includes('CZ')) return 'Čekija';
  if (c.includes('SWEDEN') || c.includes('SE')) return 'Švedija';
  if (c.includes('SWITZERLAND') || c.includes('CH')) return 'Šveicarija';
  return 'Europa';
}

function parseNumber(str: string): number | null {
  if (!str) return null;
  // Remove all non-digit characters except decimal separators
  const cleaned = str.replace(/[^\d]/g, '');
  const num = parseInt(cleaned);
  return isNaN(num) ? null : num;
}

// ===== THEPARKING PARSING =====
function parseTheParkingHtml(html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const isAllModels = !model || model === '*';
  
  console.log('Parsing TheParking HTML...');
  
  // TheParking has car listings in specific format
  // Look for listing cards - they have pattern: price, details, link to detail page
  
  // Extract all listing blocks - look for price patterns followed by car info
  // Pattern: €XX,XXX or XX.XXX € followed by specs
  
  // First, find all detail page links
  const detailLinkPattern = /href=["']((?:https?:)?\/\/[^"']*theparking[^"']*\/used-cars-detail\/[^"']+)["']/gi;
  const detailLinks: string[] = [];
  let linkMatch;
  while ((linkMatch = detailLinkPattern.exec(html)) !== null) {
    let url = linkMatch[1];
    if (url.startsWith('//')) url = 'https:' + url;
    if (!detailLinks.includes(url)) detailLinks.push(url);
  }
  
  console.log(`Found ${detailLinks.length} detail links`);
  
  // Extract images - only cloud.leparking.fr which are actual car photos
  const imagePattern = /https:\/\/cloud\.leparking\.fr\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi;
  const images = html.match(imagePattern) || [];
  const uniqueImages = [...new Set(images)].filter(img => 
    !img.includes('logo') && !img.includes('icon') && !img.includes('modele.')
  );
  
  console.log(`Found ${uniqueImages.length} unique images`);
  
  // Extract car data from listing cards
  // Look for patterns: "Brand Model ... XXXX € ... XXXX km ... XXXX"
  
  // Extract prices (pattern: XX.XXX € or € XX,XXX or just numbers before €)
  const pricePattern = /(\d{1,3}[.,\s]?\d{3})\s*€|€\s*(\d{1,3}[.,\s]?\d{3})/g;
  const prices: number[] = [];
  let priceMatch;
  while ((priceMatch = pricePattern.exec(html)) !== null) {
    const priceStr = priceMatch[1] || priceMatch[2];
    const price = parseNumber(priceStr);
    if (price && price >= 1000 && price < 200000) {
      prices.push(price);
    }
  }
  
  // Extract years (4-digit years 2000-2025)
  const yearPattern = /\b(20[0-2]\d)\b/g;
  const years: number[] = [];
  let yearMatch;
  while ((yearMatch = yearPattern.exec(html)) !== null) {
    const year = parseInt(yearMatch[1]);
    if (year >= 2000 && year <= 2025) {
      years.push(year);
    }
  }
  
  // Extract mileage (XX.XXX km or XXX XXX km)
  const mileagePattern = /(\d{1,3}[.,\s]?\d{3})\s*(?:km|Km|KM)/g;
  const mileages: number[] = [];
  let mileageMatch;
  while ((mileageMatch = mileagePattern.exec(html)) !== null) {
    const km = parseNumber(mileageMatch[1]);
    if (km && km >= 1000 && km < 500000) {
      mileages.push(km);
    }
  }
  
  // Extract fuel types
  const fuelPattern = /\b(Diesel|Petrol|Benzin|Hybrid|Electric|Elektro|LPG)\b/gi;
  const fuels = html.match(fuelPattern) || [];
  
  // Extract countries (look for common patterns)
  const countryPattern = /\b(Germany|Deutschland|Belgium|Belgique|France|Netherlands|Holland|Austria|Österreich|Italy|Italia|Spain|España|Poland|Polska)\b/gi;
  const countries = html.match(countryPattern) || [];
  
  // Create listings from extracted data
  // Match data by index (imperfect but works for list pages)
  const numListings = Math.min(detailLinks.length, Math.max(prices.length, 5), 25);
  
  console.log(`Creating ${numListings} listings from extracted data`);
  
  for (let i = 0; i < numListings; i++) {
    const detailUrl = detailLinks[i];
    if (!detailUrl) continue;
    
    // Extract listing ID from URL
    const idMatch = detailUrl.match(/\/([A-Z0-9]+)\.html$/i) || 
                    detailUrl.match(/_(\d{10,})\./);
    const externalId = idMatch ? `theparking-${idMatch[1]}` : `theparking-${Date.now()}-${i}`;
    
    // Try to extract model from URL if not provided
    let extractedModel = model;
    if (isAllModels) {
      const urlMatch = detailUrl.match(/used-cars-detail\/[^\/]+\/([^\/]+)/i);
      if (urlMatch) {
        const urlParts = urlMatch[1].split('-');
        extractedModel = urlParts[0] || '';
      }
    }
    
    const listing: CarListing = {
      external_id: externalId,
      title: `${brand} ${extractedModel || model || ''} ${years[i] || 2022}`.trim(),
      brand: normalizeBrand(brand),
      model: extractedModel || model || '',
      year: years[i] || 2022,
      price: prices[i] || 0,
      mileage: mileages[i] || null,
      fuel: fuels[i] ? normalizeFuel(fuels[i]) : 'Dyzelinas',
      transmission: 'Automatinė',
      location: null,
      country: countries[i] ? normalizeCountry(countries[i]) : 'Europa',
      source: 'TheParking',
      source_url: 'https://theparking.eu',
      listing_url: detailUrl,
      image: uniqueImages[i] || null,
    };
    
    // Only add if we have a valid price
    if (listing.price > 0) {
      listings.push(listing);
    }
  }
  
  console.log(`Created ${listings.length} valid TheParking listings`);
  return listings;
}

// ===== SCHADEAUTOS PARSING =====
function parseSchadeautosHtml(html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const isAllModels = !model || model === '*';
  
  console.log('Parsing Schadeautos HTML...');
  
  // Schadeautos has listings in card format
  // Look for /en/car/ID links
  const detailLinkPattern = /href=["'](\/en\/car\/\d+)["']/gi;
  const detailLinks: string[] = [];
  let linkMatch;
  while ((linkMatch = detailLinkPattern.exec(html)) !== null) {
    const url = `https://www.schadeautos.nl${linkMatch[1]}`;
    if (!detailLinks.includes(url)) detailLinks.push(url);
  }
  
  console.log(`Found ${detailLinks.length} detail links`);
  
  // Extract images from schadeautos CDN
  const imagePattern = /https:\/\/www\.schadeautos\.nl\/cache\/picture\/\d+\/\d+\/[a-f0-9]+(?:~v\d+)?\.jpg/gi;
  const images = html.match(imagePattern) || [];
  
  // Get largest versions of images
  const imageMap = new Map<string, string>();
  for (const img of images) {
    const hashMatch = img.match(/\/(\d+)\/([a-f0-9]+)/);
    if (hashMatch) {
      const hash = hashMatch[2];
      const size = parseInt(hashMatch[1]) || 0;
      const existing = imageMap.get(hash);
      if (!existing || size > 400) {
        // Convert to 1200 size for best quality
        imageMap.set(hash, img.replace(/\/\d+\/([a-f0-9]+)/, '/1200/$1'));
      }
    }
  }
  const uniqueImages = [...imageMap.values()];
  
  console.log(`Found ${uniqueImages.length} unique images`);
  
  // Extract prices (€ XX.XXX format)
  const pricePattern = /€\s*(\d{1,3}[.,]?\d{3})|(\d{1,3}[.,]\d{3})\s*€/g;
  const prices: number[] = [];
  let priceMatch;
  while ((priceMatch = pricePattern.exec(html)) !== null) {
    const priceStr = priceMatch[1] || priceMatch[2];
    const price = parseNumber(priceStr);
    if (price && price >= 500 && price < 100000) {
      prices.push(price);
    }
  }
  
  // Extract years
  const yearPattern = /\b(20[0-2]\d)\b/g;
  const years: number[] = [];
  let yearMatch;
  while ((yearMatch = yearPattern.exec(html)) !== null) {
    const year = parseInt(yearMatch[1]);
    if (year >= 2000 && year <= 2025) {
      years.push(year);
    }
  }
  
  // Extract mileage
  const mileagePattern = /(\d{1,3}[.,]?\d{3})\s*km/gi;
  const mileages: number[] = [];
  let mileageMatch;
  while ((mileageMatch = mileagePattern.exec(html)) !== null) {
    const km = parseNumber(mileageMatch[1]);
    if (km && km >= 1000 && km < 500000) {
      mileages.push(km);
    }
  }
  
  // Extract fuel types
  const fuelPattern = /\b(Diesel|Petrol|Benzine|Hybrid|Electric|LPG)\b/gi;
  const fuels = html.match(fuelPattern) || [];
  
  // Create listings
  const numListings = Math.min(detailLinks.length, 25);
  
  console.log(`Creating ${numListings} listings`);
  
  for (let i = 0; i < numListings; i++) {
    const detailUrl = detailLinks[i];
    if (!detailUrl) continue;
    
    const idMatch = detailUrl.match(/\/car\/(\d+)/);
    const externalId = idMatch ? `schadeautos-${idMatch[1]}` : `schadeautos-${Date.now()}-${i}`;
    
    const listing: CarListing = {
      external_id: externalId,
      title: `${brand} ${model || ''} ${years[i] || 2022}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: years[i] || 2022,
      price: prices[i] || 0,
      mileage: mileages[i] || null,
      fuel: fuels[i] ? normalizeFuel(fuels[i]) : 'Dyzelinas',
      transmission: 'Automatinė',
      location: 'Olandija',
      country: 'Olandija',
      source: 'Schadeautos',
      source_url: 'https://schadeautos.nl',
      listing_url: detailUrl,
      image: uniqueImages[i] || null,
    };
    
    if (listing.price > 0) {
      listings.push(listing);
    }
  }
  
  console.log(`Created ${listings.length} valid Schadeautos listings`);
  return listings;
}

// ===== MAIN SCRAPING FUNCTIONS =====
async function scrapeWithFirecrawl(firecrawlKey: string, url: string): Promise<string> {
  try {
    console.log(`Scraping with Firecrawl: ${url}`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html', 'rawHtml'],
        onlyMainContent: false,
        waitFor: 5000,
        timeout: 30000,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Firecrawl error:', error);
      return '';
    }
    
    const data = await response.json();
    const html = data.data?.rawHtml || data.data?.html || data.rawHtml || data.html || '';
    
    // Check for blocking
    if (html.includes('Zugriff verweigert') || 
        html.includes('Access Denied') || 
        html.includes('captcha') ||
        html.includes('blocked')) {
      console.log('Firecrawl request was blocked');
      return '';
    }
    
    console.log(`Firecrawl got ${html.length} bytes`);
    return html;
  } catch (error) {
    console.error('Firecrawl error:', error);
    return '';
  }
}

async function scrapeTheParking(firecrawlKey: string, brand: string, model: string, isAllModels: boolean): Promise<CarListing[]> {
  const searchUrl = isAllModels 
    ? `https://www.theparking.eu/used-cars/${brand.toLowerCase()}.html`
    : `https://www.theparking.eu/used-cars/${brand.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, '-')}.html`;
  
  console.log(`Scraping TheParking: ${searchUrl}`);
  
  const html = await scrapeWithFirecrawl(firecrawlKey, searchUrl);
  if (!html || html.length < 1000) {
    console.log('TheParking: No valid HTML received');
    return [];
  }
  
  return parseTheParkingHtml(html, brand, isAllModels ? '' : model);
}

async function scrapeSchadeautos(firecrawlKey: string, brand: string, model: string, isAllModels: boolean): Promise<CarListing[]> {
  const searchUrl = isAllModels 
    ? `https://www.schadeautos.nl/en/cars?make=${brand.toLowerCase()}`
    : `https://www.schadeautos.nl/en/cars?make=${brand.toLowerCase()}&model=${model.toLowerCase()}`;
  
  console.log(`Scraping Schadeautos: ${searchUrl}`);
  
  const html = await scrapeWithFirecrawl(firecrawlKey, searchUrl);
  if (!html || html.length < 1000) {
    console.log('Schadeautos: No valid HTML received');
    return [];
  }
  
  // Check if redirected to home page (blocking)
  if (html.includes('<body class="home') || 
      (html.includes('Buy Damaged Cars') && !html.includes('/en/car/'))) {
    console.log('Schadeautos: Redirected to home page (blocked)');
    return [];
  }
  
  return parseSchadeautosHtml(html, brand, isAllModels ? '' : model);
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand, model, forceRefresh } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY_1') || Deno.env.get('FIRECRAWL_API_KEY');
    
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
      console.error('Firecrawl API key not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAllModels = !model || model === '*';
    const allListings: CarListing[] = [];

    console.log(`\n===== SCRAPING ${brand} ${isAllModels ? '(all models)' : model} =====\n`);

    // Scrape sources with delay between them
    const theParkingListings = await scrapeTheParking(firecrawlKey, brand, model, isAllModels);
    allListings.push(...theParkingListings);
    console.log(`TheParking: ${theParkingListings.length} listings`);

    // Delay between sources to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1500));

    const schadeautosListings = await scrapeSchadeautos(firecrawlKey, brand, model, isAllModels);
    allListings.push(...schadeautosListings);
    console.log(`Schadeautos: ${schadeautosListings.length} listings`);

    console.log(`\n===== TOTAL: ${allListings.length} listings =====\n`);

    // Save to database
    if (allListings.length > 0) {
      const { error: upsertError } = await supabase
        .from('car_listings')
        .upsert(allListings, { onConflict: 'external_id,source' });

      if (upsertError) {
        console.error('Database upsert error:', upsertError);
      } else {
        console.log(`Saved ${allListings.length} listings to database`);
      }
    }

    // Return fresh listings from DB
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
      JSON.stringify({ 
        success: true, 
        data: freshListings || [], 
        cached: false, 
        count: allListings.length,
        sources: {
          theparking: theParkingListings.length,
          schadeautos: schadeautosListings.length,
        }
      }),
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
