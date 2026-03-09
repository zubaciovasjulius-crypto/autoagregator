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

// ===== NORMALIZATION =====
function normalizeBrand(brand: string): string {
  const b = brand.toUpperCase().trim();
  if (b === 'VW') return 'VOLKSWAGEN';
  if (b.includes('MERCEDES')) return 'MERCEDES';
  if (b === 'ROLLS-ROYCE') return 'ROLLS ROYCE';
  return b;
}

function normalizeFuel(fuel: string): string {
  if (!fuel) return 'Dyzelinas';
  const f = fuel.toLowerCase();
  if (f.includes('diesel') || f.includes('dyzel')) return 'Dyzelinas';
  if (f.includes('petrol') || f.includes('benzin') || f.includes('gasoline') || f.includes('essence')) return 'Benzinas';
  if (f.includes('hybrid') || f.includes('plug')) return 'Hibridas';
  if (f.includes('electric') || f.includes('elektr') || f.includes('ev')) return 'Elektra';
  if (f.includes('lpg') || f.includes('gpl')) return 'LPG';
  return fuel;
}

// ===== FIRECRAWL =====
async function scrapeMarkdown(firecrawlKey: string, url: string): Promise<{ markdown: string; html: string }> {
  try {
    console.log(`Scraping: ${url}`);
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'rawHtml'],
        onlyMainContent: true,
        waitFor: 5000,
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Firecrawl ${response.status}: ${err.substring(0, 300)}`);
      return { markdown: '', html: '' };
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.rawHtml || data.data?.html || '';

    if (markdown.toLowerCase().includes('access denied') || markdown.toLowerCase().includes('captcha')) {
      console.log('Blocked');
      return { markdown: '', html: '' };
    }

    console.log(`Got ${markdown.length} md chars`);
    return { markdown, html };
  } catch (error) {
    console.error('Scrape error:', error);
    return { markdown: '', html: '' };
  }
}

// ===== AUTOSCOUT24 PARSER =====
// AutoScout24 markdown has a very clear repeating pattern per listing:
// **Title**
// Add to list
// ![](image_url)
// count
// € price
// MM/YYYY
// XXX,XXX km
// Fuel
// XX kW (XX hp)
// DealerCC-ZIPCODE City
function parseAutoScout24(markdown: string, _html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];

  // Split by listing titles: bold text containing car brand/info
  // Pattern: each listing starts with "**SomeTitleText**"
  const listingBlocks: string[] = [];
  const lines = markdown.split('\n');
  let currentBlock = '';
  
  for (const line of lines) {
    if (line.startsWith('**') && line.includes('**') && line.length > 10) {
      // Check if this looks like a car title (not navigation/filter text)
      const titleContent = line.replace(/\*\*/g, '').trim();
      if (titleContent.length > 15 && 
          !titleContent.includes('Show more') &&
          !titleContent.includes('Filter') &&
          !titleContent.includes('Sort')) {
        if (currentBlock.length > 50) {
          listingBlocks.push(currentBlock);
        }
        currentBlock = line + '\n';
        continue;
      }
    }
    currentBlock += line + '\n';
  }
  if (currentBlock.length > 50) listingBlocks.push(currentBlock);

  console.log(`AS24: found ${listingBlocks.length} potential blocks`);

  for (let i = 0; i < listingBlocks.length && listings.length < 25; i++) {
    const block = listingBlocks[i];

    // Title
    const titleMatch = block.match(/\*\*([^*]+)\*\*/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    // Price: € XX,XXX (ignore "From XX € p.m." financing prices)
    const priceMatch = block.match(/^€\s*([\d.,]+)\s*$/m) || block.match(/\n€\s*([\d.,]+)\s*\n/);
    if (!priceMatch) continue;
    const priceStr = priceMatch[1].replace(/,/g, '');
    const price = parseInt(priceStr.replace(/\./g, ''));
    if (!price || price < 500 || price > 500000) continue;

    // Image
    const imgMatch = block.match(/!\[.*?\]\((https:\/\/prod\.pictures\.autoscout24\.net\/listing-images\/[^\s)]+)\)/);
    let image = imgMatch ? imgMatch[1].replace(/\/\d+x\d+\.webp$/, '/720x540.webp') : null;

    // Registration date -> year (MM/YYYY)
    const regMatch = block.match(/\n(\d{2})\/(\d{4})\n/);
    const year = regMatch ? parseInt(regMatch[2]) : null;

    // Mileage (XXX,XXX km) - make sure it's on its own line
    const kmMatch = block.match(/\n([\d.,]+)\s*km\n/);
    let mileage: number | null = null;
    if (kmMatch) {
      const kmStr = kmMatch[1].replace(/,/g, '').replace(/\./g, '');
      mileage = parseInt(kmStr);
      if (mileage < 100 || mileage > 999999) mileage = null;
    }

    // Fuel type on its own line
    const fuelMatch = block.match(/\n(Diesel|Gasoline|Petrol|Hybrid|Electric|LPG|CNG|Plug-in Hybrid)\n/i);
    const fuel = fuelMatch ? normalizeFuel(fuelMatch[1]) : null;

    // Country from dealer location (CC-ZIPCODE City)
    const locMatch = block.match(/([A-Z]{2})-(\d{4,5})\s+(.+)/);
    let country = 'Europa';
    let location: string | null = null;
    if (locMatch) {
      const cc = locMatch[1];
      const city = locMatch[3].trim().split('\n')[0];
      location = `${city}, ${cc}`;
      const map: Record<string, string> = {
        'DE': 'Vokietija', 'AT': 'Austrija', 'BE': 'Belgija', 'FR': 'Prancūzija',
        'NL': 'Olandija', 'IT': 'Italija', 'ES': 'Ispanija', 'PL': 'Lenkija',
        'CH': 'Šveicarija', 'CZ': 'Čekija', 'SE': 'Švedija', 'DK': 'Danija',
        'LU': 'Liuksemburgas',
      };
      country = map[cc] || 'Europa';
    }

    // Generate unique ID from title + price
    const hash = `${title}-${price}-${year || 0}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
    const externalId = `as24-${hash}`;

    listings.push({
      external_id: externalId,
      title: title.substring(0, 200),
      brand: normalizeBrand(brand),
      model: model || '',
      year: year || new Date().getFullYear(),
      price,
      mileage,
      fuel,
      transmission: null,
      location,
      country,
      source: 'AutoScout24',
      source_url: 'https://autoscout24.com',
      listing_url: null, // AS24 doesn't expose clean URLs in markdown easily
      image,
    });
  }

  console.log(`AutoScout24: ${listings.length} listings parsed`);
  return listings;
}

// ===== MARKTPLAATS PARSER =====
// Marktplaats markdown listings typically have: title, price, year, mileage, fuel on separate lines
function parseMarktplaats(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];

  // Extract detail links from HTML
  const linkPattern = /href=["'](https?:\/\/www\.marktplaats\.nl\/v\/auto-s\/[^"']+)["']/gi;
  const links: string[] = [];
  let m;
  while ((m = linkPattern.exec(html)) !== null) {
    const url = m[1].split('?')[0]; // clean URL
    if (!links.includes(url)) links.push(url);
  }

  // Extract images from HTML
  const imgPattern = /src=["'](https?:\/\/[^"']*\.(?:jpg|jpeg|webp|png)[^"']*)["'][^>]*alt=["'][^"']*(?:auto|car|bmw|audi|volkswagen|mercedes)/gi;
  const images: string[] = [];
  while ((m = imgPattern.exec(html)) !== null) {
    if (!images.includes(m[1])) images.push(m[1]);
  }

  // Better approach: parse markdown blocks between listing titles
  // Marktplaats listings in markdown: title line, then details
  const listingBlocks: string[] = [];
  const lines = markdown.split('\n');
  let currentBlock = '';

  for (const line of lines) {
    // Detect listing title: contains brand name and has linked text or is bold
    const isTitleLine = (line.includes(brand.toUpperCase()) || line.includes(brand)) &&
      (line.includes('[') || line.startsWith('**') || line.startsWith('#'));
    
    if (isTitleLine && line.length > 15) {
      if (currentBlock.length > 20) listingBlocks.push(currentBlock);
      currentBlock = line + '\n';
    } else {
      currentBlock += line + '\n';
    }
  }
  if (currentBlock.length > 20) listingBlocks.push(currentBlock);

  // If markdown block approach doesn't work, fall back to link-based
  if (listingBlocks.length < 3 && links.length > 0) {
    // Use HTML links to identify listings, extract data from their context
    for (let i = 0; i < links.length && listings.length < 25; i++) {
      const url = links[i];
      const idMatch = url.match(/m(\d{7,})/);
      if (!idMatch) continue;

      listings.push({
        external_id: `marktplaats-${idMatch[1]}`,
        title: `${brand} ${model || ''}`.trim(),
        brand: normalizeBrand(brand),
        model: model || '',
        year: new Date().getFullYear(),
        price: 0, // Will be filled if we can extract
        mileage: null,
        fuel: null,
        transmission: null,
        location: null,
        country: 'Olandija',
        source: 'Marktplaats',
        source_url: 'https://marktplaats.nl',
        listing_url: url,
        image: images[i] || null,
      });
    }
    // Remove those with price 0
    return listings.filter(l => l.listing_url !== null);
  }

  console.log(`Marktplaats: ${listings.length} listings (link-based)`);
  return listings;
}

// ===== OTOMOTO PARSER =====
function parseOtomoto(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  let m;

  // Otomoto detail links
  const linkPattern = /href=["'](https?:\/\/www\.otomoto\.pl\/osobowe\/oferta\/[^"']+)["']/gi;
  const links: string[] = [];
  while ((m = linkPattern.exec(html)) !== null) {
    const url = m[1].split('#')[0];
    if (!links.includes(url)) links.push(url);
  }

  // Otomoto images
  const imgPattern = /src=["'](https?:\/\/ireland\.apollo\.olxcdn\.com\/[^"']+\.(?:jpg|jpeg|webp))["']/gi;
  const images: string[] = [];
  while ((m = imgPattern.exec(html)) !== null) {
    if (!images.includes(m[1])) images.push(m[1]);
  }

  // Parse markdown line by line looking for listing blocks
  // Otomoto markdown: title with price, then specs
  const lines = markdown.split('\n').map(l => l.trim()).filter(l => l);
  
  for (let i = 0; i < lines.length && listings.length < 25; i++) {
    const line = lines[i];
    
    // Look for lines with PLN or EUR price that could be listing prices
    const plnMatch = line.match(/([\d\s]+)\s*PLN/) || line.match(/([\d\s]+)\s*zł/);
    const eurMatch = line.match(/€\s*([\d\s.,]+)/) || line.match(/([\d\s.,]+)\s*€/) || line.match(/([\d\s]+)\s*EUR/);
    
    let price = 0;
    if (eurMatch) {
      price = parseInt(eurMatch[1].replace(/[\s.,]/g, ''));
    } else if (plnMatch) {
      price = Math.round(parseInt(plnMatch[1].replace(/\s/g, '')) / 4.3);
    }
    
    if (price < 1000 || price > 300000) continue;

    // Look around for year, mileage, fuel
    const context = lines.slice(Math.max(0, i - 5), i + 5).join(' ');
    
    const yearMatch = context.match(/\b(20[0-2]\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;
    
    const kmMatch = context.match(/([\d\s]+)\s*km/);
    let mileage: number | null = null;
    if (kmMatch) {
      mileage = parseInt(kmMatch[1].replace(/\s/g, ''));
      if (mileage < 100 || mileage > 999999) mileage = null;
    }
    
    const fuelMatch = context.match(/\b(Diesel|Benzyna|Hybrid|Elektryczny|LPG|CNG)\b/i);

    const linkIdx = listings.length;
    const url = links[linkIdx];
    const idMatch = url?.match(/-ID([a-zA-Z0-9]+)/) || url?.match(/oferta\/([^/?]+)/);
    const externalId = idMatch ? `otomoto-${idMatch[1].slice(0, 20)}` : `otomoto-${Date.now()}-${listings.length}`;

    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${year || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: year || new Date().getFullYear(),
      price,
      mileage,
      fuel: fuelMatch ? normalizeFuel(fuelMatch[1]) : null,
      transmission: null,
      location: null,
      country: 'Lenkija',
      source: 'Otomoto',
      source_url: 'https://otomoto.pl',
      listing_url: url || null,
      image: images[linkIdx] || null,
    });
  }

  console.log(`Otomoto: ${listings.length} listings`);
  return listings;
}

// ===== SCHADEAUTOS PARSER =====
function parseSchadeautos(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  let m;

  const linkPattern = /href=["'](\/en\/car\/\d+)["']/gi;
  const links: string[] = [];
  while ((m = linkPattern.exec(html)) !== null) {
    const url = `https://www.schadeautos.nl${m[1]}`;
    if (!links.includes(url)) links.push(url);
  }

  const imgPattern = /src=["'](https:\/\/www\.schadeautos\.nl\/cache\/picture\/[^"']+\.jpg)["']/gi;
  const images: string[] = [];
  while ((m = imgPattern.exec(html)) !== null) {
    // Get larger version
    const img = m[1].replace(/\/\d+\/([a-f0-9]+)/, '/1200/$1');
    if (!images.includes(img)) images.push(img);
  }

  // Parse markdown for structured data per listing
  const priceBlocks: { price: number; year: number | null; mileage: number | null; fuel: string | null }[] = [];
  const lines = markdown.split('\n').map(l => l.trim()).filter(l => l);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const priceMatch = line.match(/€\s*([\d.,]+)/) || line.match(/([\d.,]+)\s*€/);
    if (!priceMatch) continue;
    
    const priceStr = priceMatch[1].replace(/\./g, '').replace(',', '');
    const price = parseInt(priceStr);
    if (!price || price < 200 || price > 100000) continue;

    // Search context lines around this price
    const context = lines.slice(Math.max(0, i - 3), i + 3).join(' ');
    const yearMatch = context.match(/\b(20[0-2]\d|199\d)\b/);
    const kmMatch = context.match(/([\d.,]+)\s*km/i);
    const fuelMatch = context.match(/\b(Diesel|Benzine|Petrol|Hybrid|Electric|LPG)\b/i);
    
    let mileage: number | null = null;
    if (kmMatch) {
      mileage = parseInt(kmMatch[1].replace(/[.,]/g, ''));
      if (mileage < 100 || mileage > 999999) mileage = null;
    }

    priceBlocks.push({
      price,
      year: yearMatch ? parseInt(yearMatch[1]) : null,
      mileage,
      fuel: fuelMatch ? fuelMatch[1] : null,
    });
  }

  const count = Math.min(links.length, priceBlocks.length, 25);
  for (let i = 0; i < count; i++) {
    const idMatch = links[i].match(/\/car\/(\d+)/);
    const externalId = idMatch ? `schadeautos-${idMatch[1]}` : `schadeautos-${Date.now()}-${i}`;
    const pb = priceBlocks[i];

    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${pb.year || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: pb.year || new Date().getFullYear(),
      price: pb.price,
      mileage: pb.mileage,
      fuel: pb.fuel ? normalizeFuel(pb.fuel) : null,
      transmission: null,
      location: 'Olandija',
      country: 'Olandija',
      source: 'Schadeautos',
      source_url: 'https://schadeautos.nl',
      listing_url: links[i],
      image: images[i] || null,
    });
  }

  console.log(`Schadeautos: ${listings.length} listings`);
  return listings;
}

// ===== SOURCE CONFIGS =====
interface SourceConfig {
  name: string;
  buildUrl: (brand: string, model: string, isAll: boolean) => string;
  parser: (md: string, html: string, brand: string, model: string) => CarListing[];
}

const SOURCES: SourceConfig[] = [
  {
    name: 'AutoScout24',
    buildUrl: (brand, model, isAll) => {
      const b = brand.toLowerCase().replace(/\s+/g, '-');
      const m = model.toLowerCase().replace(/\s+/g, '-');
      return isAll
        ? `https://www.autoscout24.com/lst/${b}?sort=standard&desc=0&atype=C&cy=D%2CA%2CB%2CF%2CI%2CL%2CNL&ustate=N%2CU&size=20`
        : `https://www.autoscout24.com/lst/${b}/${m}?sort=standard&desc=0&atype=C&cy=D%2CA%2CB%2CF%2CI%2CL%2CNL&ustate=N%2CU&size=20`;
    },
    parser: parseAutoScout24,
  },
  {
    name: 'Schadeautos',
    buildUrl: (brand, model, isAll) => isAll
      ? `https://www.schadeautos.nl/en/cars?make=${brand.toLowerCase()}`
      : `https://www.schadeautos.nl/en/cars?make=${brand.toLowerCase()}&model=${model.toLowerCase()}`,
    parser: parseSchadeautos,
  },
  {
    name: 'Otomoto',
    buildUrl: (brand, model, isAll) => {
      const b = brand.toLowerCase().replace(/\s+/g, '-');
      const m = model.toLowerCase().replace(/\s+/g, '-');
      return isAll
        ? `https://www.otomoto.pl/osobowe/${b}?search%5Border%5D=created_at_first%3Adesc`
        : `https://www.otomoto.pl/osobowe/${b}/${m}?search%5Border%5D=created_at_first%3Adesc`;
    },
    parser: parseOtomoto,
  },
  {
    name: 'Marktplaats',
    buildUrl: (brand, model, isAll) => {
      const b = brand.toLowerCase().replace(/\s+/g, '-');
      const m = model.toLowerCase().replace(/\s+/g, '-');
      return isAll
        ? `https://www.marktplaats.nl/l/auto-s/${b}/`
        : `https://www.marktplaats.nl/l/auto-s/${b}/q/${m}/`;
    },
    parser: parseMarktplaats,
  },
];

// ===== MAIN =====
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

    if (!brand) {
      const { data: listings } = await supabase
        .from('car_listings')
        .select('*')
        .order('scraped_at', { ascending: false })
        .limit(100);

      return new Response(
        JSON.stringify({ success: true, data: listings || [], cached: true }),
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
    const sourceCounts: Record<string, number> = {};

    console.log(`\n===== SCRAPING ${brand} ${isAllModels ? '(all)' : model} =====`);

    for (const source of SOURCES) {
      try {
        const url = source.buildUrl(brand, model, isAllModels);
        console.log(`\n--- ${source.name}: ${url} ---`);

        const { markdown, html } = await scrapeMarkdown(firecrawlKey, url);

        if (markdown.length > 100 || html.length > 500) {
          const parsed = source.parser(markdown, html, brand, isAllModels ? '' : model);
          // Only add listings with valid prices
          const valid = parsed.filter(l => l.price >= 500);
          allListings.push(...valid);
          sourceCounts[source.name] = valid.length;
          console.log(`${source.name}: ${valid.length} valid listings`);
        } else {
          console.log(`${source.name}: no content`);
          sourceCounts[source.name] = 0;
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`${source.name} error:`, err);
        sourceCounts[source.name] = 0;
      }
    }

    console.log(`\n===== TOTAL: ${allListings.length} valid listings =====`);
    console.log('Sources:', JSON.stringify(sourceCounts));

    if (allListings.length > 0) {
      const { error } = await supabase
        .from('car_listings')
        .upsert(allListings, { onConflict: 'external_id,source' });

      if (error) console.error('DB error:', error);
      else console.log(`Saved ${allListings.length} to DB`);
    }

    let query = supabase.from('car_listings').select('*').ilike('brand', `%${brand}%`);
    if (!isAllModels) query = query.ilike('model', `%${model}%`);

    const { data: freshListings } = await query
      .order('scraped_at', { ascending: false })
      .limit(100);

    return new Response(
      JSON.stringify({
        success: true,
        data: freshListings || [],
        cached: false,
        count: allListings.length,
        sources: sourceCounts,
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
