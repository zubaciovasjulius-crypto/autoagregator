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

function normalizeBrand(brand: string): string {
  const b = brand.toUpperCase().trim();
  if (b === 'VW') return 'VOLKSWAGEN';
  if (b.includes('MERCEDES')) return 'MERCEDES';
  return b;
}

function normalizeFuel(fuel: string): string {
  if (!fuel) return 'Dyzelinas';
  const f = fuel.toLowerCase();
  if (f.includes('diesel') || f.includes('dyzel')) return 'Dyzelinas';
  if (f.includes('petrol') || f.includes('benzin') || f.includes('gasoline') || f.includes('benzyna')) return 'Benzinas';
  if (f.includes('hybrid') || f.includes('plug')) return 'Hibridas';
  if (f.includes('electric') || f.includes('elektr') || f.includes('ev')) return 'Elektra';
  if (f.includes('lpg') || f.includes('gpl')) return 'LPG';
  return fuel;
}

async function scrapeUrl(key: string, url: string): Promise<string> {
  try {
    console.log(`Scraping: ${url}`);
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true, waitFor: 5000, timeout: 30000 }),
    });
    if (!res.ok) { console.error(`Firecrawl ${res.status}`); return ''; }
    const data = await res.json();
    const md = data.data?.markdown || data.markdown || '';
    if (md.includes('Access Denied') || md.includes('captcha')) { console.log('Blocked'); return ''; }
    console.log(`Got ${md.length} chars`);
    return md;
  } catch (e) { console.error('Scrape error:', e); return ''; }
}

// ===== AUTOSCOUT24 =====
// Format per listing:
// **Title**
// Add to list
// ![](image_url)
// XX
// € XX,XXX or € XX,XXX1 (footnote number at end)
// From XX € p.m.financing  (skip this)
// MM/YYYY
// XXX,XXX km
// Fuel
// XX kW (XX hp)
// DealerCC-ZIPCODE City
function parseAutoScout24(md: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const lines = md.split('\n');

  for (let i = 0; i < lines.length && listings.length < 25; i++) {
    const line = lines[i].trim();

    // Detect listing title: starts and ends with ** and is long enough
    if (!line.startsWith('**') || !line.endsWith('**') || line.length < 20) continue;
    const title = line.replace(/\*\*/g, '').trim();
    if (title.includes('Show more') || title.includes('Filter')) continue;

    // Scan the next 20 lines for listing data
    let image: string | null = null;
    let price: number | null = null;
    let year: number | null = null;
    let mileage: number | null = null;
    let fuel: string | null = null;
    let country = 'Europa';
    let location: string | null = null;

    for (let j = i + 1; j < Math.min(i + 25, lines.length); j++) {
      const l = lines[j].trim();

      // Image
      if (!image) {
        const imgM = l.match(/!\[.*?\]\((https:\/\/prod\.pictures\.autoscout24\.net\/listing-images\/[^\s)]+)\)/);
        if (imgM) image = imgM[1].replace(/\/\d+x\d+\.webp$/, '/720x540.webp');
      }

      // Price: "€ XX,XXX" possibly with trailing footnote digit
      if (!price) {
        const pM = l.match(/^€\s*([\d.,]+)\d?$/);
        if (pM) {
          // Remove trailing single digit (footnote) and parse
          let ps = pM[1].replace(/,/g, '');
          // Handle case like "299,9001" -> should be 299900 but that's wrong, it's 299,900 + footnote "1"
          // Actually format is "€ 17,800" or "€ 85,9001" where 1 is footnote
          // Clean: remove dots keep only digits
          ps = ps.replace(/\./g, '');
          const num = parseInt(ps);
          if (num >= 500 && num < 500000) price = num;
        }
      }

      // Registration date: MM/YYYY
      if (!year) {
        const yM = l.match(/^(\d{2})\/(\d{4})$/);
        if (yM) year = parseInt(yM[2]);
      }

      // Mileage: "XXX,XXX km" or "XXX km"
      if (mileage === null) {
        const kM = l.match(/^([\d.,]+)\s*km$/);
        if (kM) {
          const kmStr = kM[1].replace(/,/g, '').replace(/\./g, '');
          const km = parseInt(kmStr);
          if (km >= 0 && km < 1000000) mileage = km;
        }
      }

      // Fuel type
      if (!fuel) {
        if (/^(Diesel|Gasoline|Petrol|Hybrid|Electric|LPG|CNG|Plug-in Hybrid)$/i.test(l)) {
          fuel = normalizeFuel(l);
        }
      }

      // Location: CC-ZIPCODE City
      const locM = l.match(/([A-Z]{2})-(\d{4,5})\s+(.+)/);
      if (locM) {
        const cc = locM[1];
        location = `${locM[3].trim()}, ${cc}`;
        const cmap: Record<string, string> = {
          'DE': 'Vokietija', 'AT': 'Austrija', 'BE': 'Belgija', 'FR': 'Prancūzija',
          'NL': 'Olandija', 'IT': 'Italija', 'ES': 'Ispanija', 'CH': 'Šveicarija',
          'CZ': 'Čekija', 'PL': 'Lenkija', 'SE': 'Švedija', 'DK': 'Danija', 'LU': 'Liuksemburgas',
        };
        country = cmap[cc] || 'Europa';
        break; // Location is last field, stop scanning
      }

      // Stop if we hit next listing
      if (j > i + 5 && l.startsWith('**') && l.endsWith('**') && l.length > 20) break;
    }

    if (!price || price < 500) continue;

    // Fix: prices like 859001 should be 85900 (strip trailing footnote digit from raw)
    // Check: if price > 100000 and ends with 1, it might be a footnote
    if (price > 100000) {
      const priceStr = price.toString();
      if (priceStr.endsWith('1') || priceStr.endsWith('2')) {
        const trimmed = parseInt(priceStr.slice(0, -1));
        if (trimmed >= 1000) price = trimmed;
      }
    }

    const hash = `${title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}-${price}`;
    listings.push({
      external_id: `as24-${hash}`,
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
      listing_url: null,
      image,
    });
  }

  console.log(`AutoScout24: ${listings.length} listings`);
  return listings;
}

// ===== OTOMOTO =====
// Format per listing:
// ![](image_url)
// ## [Title](detail_url)
// specs
// mileageXXX XXX kmfuel_typeDieselgearboxAutomatycznayearYYYY
// - Location
// ### XXX XXX
// PLN
function parseOtomoto(md: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const lines = md.split('\n');

  for (let i = 0; i < lines.length && listings.length < 25; i++) {
    const line = lines[i].trim();

    // Detect listing: ## [Title](url)
    const titleMatch = line.match(/^##\s+\[([^\]]+)\]\((https:\/\/www\.otomoto\.pl\/osobowe\/oferta\/[^)]+)\)/);
    if (!titleMatch) continue;

    const title = titleMatch[1];
    const listingUrl = titleMatch[2];

    // Extract ID from URL
    const idMatch = listingUrl.match(/-ID([a-zA-Z0-9]+)/);
    const externalId = idMatch ? `otomoto-${idMatch[1]}` : `otomoto-${Date.now()}-${listings.length}`;

    // Image from line before (![](url))
    let image: string | null = null;
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const imgM = lines[j].trim().match(/!\[.*?\]\((https:\/\/ireland\.apollo\.olxcdn\.com\/[^)]+)\)/);
      if (imgM) { image = imgM[1]; break; }
    }

    // Specs line: mileageXXX XXX kmfuel_typeDieselgearboxAutomatycznayearYYYY
    let mileage: number | null = null;
    let fuel: string | null = null;
    let transmission: string | null = null;
    let year: number | null = null;
    let price: number | null = null;
    let location: string | null = null;

    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const l = lines[j].trim();

      // Specs line (concatenated)
      const specMatch = l.match(/mileage([\d\s]+)km.*?fuel[_\s]?type(\w+).*?gearbox(\w+).*?year(\d{4})/i);
      if (specMatch) {
        mileage = parseInt(specMatch[1].replace(/\s/g, ''));
        if (mileage < 100 || mileage > 999999) mileage = null;
        fuel = normalizeFuel(specMatch[2]);
        transmission = specMatch[3].toLowerCase().includes('automat') ? 'Automatinė' : 'Mechaninė';
        year = parseInt(specMatch[4]);
      }

      // Location
      if (l.startsWith('- ') && l.includes('(')) {
        location = l.replace(/^-\s*/, '').trim();
      }

      // Price: ### XXX XXX
      const priceMatch = l.match(/^###\s+([\d\s]+)$/);
      if (priceMatch) {
        const plnPrice = parseInt(priceMatch[1].replace(/\s/g, ''));
        if (plnPrice >= 5000 && plnPrice < 2000000) {
          price = Math.round(plnPrice / 4.3); // PLN to EUR
        }
      }

      // Stop at next listing
      if (j > i + 3 && l.startsWith('## [')) break;
    }

    if (!price || price < 300) continue;

    listings.push({
      external_id: externalId,
      title,
      brand: normalizeBrand(brand),
      model: model || '',
      year: year || new Date().getFullYear(),
      price,
      mileage,
      fuel,
      transmission,
      location,
      country: 'Lenkija',
      source: 'Otomoto',
      source_url: 'https://otomoto.pl',
      listing_url: listingUrl,
      image,
    });
  }

  console.log(`Otomoto: ${listings.length} listings`);
  return listings;
}

// ===== SCHADEAUTOS =====
// Format per listing:
// [![alt](image)](detail_url)
// new (optional)
// ## [Brand Model](detail_url)
// description
// € X.XXX
// ![ERD: YYYY](...)YYYY
// ![fuel: type](...)type
// ![mileage: XXX.XXX](...)XXX.XXX
function parseSchadeautos(md: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const lines = md.split('\n');

  for (let i = 0; i < lines.length && listings.length < 25; i++) {
    const line = lines[i].trim();

    // Detect listing: ## [Brand Model](detail_url)
    const titleMatch = line.match(/^##\s+\[([^\]]+)\]\((https:\/\/www\.schadeautos\.nl\/en\/(?:damaged|car)\/[^)]+)\)/);
    if (!titleMatch) continue;

    const title = titleMatch[1];
    const listingUrl = titleMatch[2];

    // Extract ID from URL
    const idMatch = listingUrl.match(/\/o\/(\d+)/);
    const externalId = idMatch ? `schadeautos-${idMatch[1]}` : `schadeautos-${Date.now()}-${listings.length}`;

    // Image: look above for [![alt](image_url)](detail_url)
    let image: string | null = null;
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const imgM = lines[j].trim().match(/\[!\[.*?\]\((https:\/\/www\.schadeautos\.nl\/cache\/picture\/[^)]+)\)/);
      if (imgM) {
        image = imgM[1].replace(/\/\d+\/(\d+)\//, '/1200/$1/');
        break;
      }
    }

    // Scan next lines for price, year, fuel, mileage
    let price: number | null = null;
    let year: number | null = null;
    let fuel: string | null = null;
    let mileage: number | null = null;

    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const l = lines[j].trim();

      // Price: € X.XXX
      if (!price) {
        const pM = l.match(/€\s*([\d.,]+)/);
        if (pM) {
          const ps = pM[1].replace(/\./g, '').replace(',', '');
          const p = parseInt(ps);
          if (p >= 100 && p < 200000) price = p;
        }
      }

      // Year: ![ERD: YYYY](...)YYYY
      if (!year) {
        const yM = l.match(/ERD:\s*(\d{4})/);
        if (yM) year = parseInt(yM[1]);
        // Also check just YYYY at end of line after image
        if (!year) {
          const yM2 = l.match(/\.(?:png|jpg)\)(\d{4})$/);
          if (yM2) year = parseInt(yM2[1]);
        }
      }

      // Fuel: ![fuel: type](...)type
      if (!fuel) {
        const fM = l.match(/fuel:\s*([^)]+)\)/);
        if (fM) fuel = normalizeFuel(fM[1]);
      }

      // Mileage: ![mileage: XXX.XXX](...)XXX.XXX
      if (mileage === null) {
        const mM = l.match(/mileage:\s*([\d.,]+)/);
        if (mM) {
          const kmStr = mM[1].replace(/\./g, '').replace(',', '');
          const km = parseInt(kmStr);
          if (km >= 0 && km < 999999) mileage = km;
        }
      }

      // Stop at next listing
      if (j > i + 2 && l.startsWith('## [')) break;
    }

    if (!price) continue;

    listings.push({
      external_id: externalId,
      title: `${title} - ${lines[i + 1]?.trim()?.substring(0, 80) || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: year || new Date().getFullYear(),
      price,
      mileage,
      fuel,
      transmission: null,
      location: 'Olandija',
      country: 'Olandija',
      source: 'Schadeautos',
      source_url: 'https://schadeautos.nl',
      listing_url: listingUrl,
      image,
    });
  }

  console.log(`Schadeautos: ${listings.length} listings`);
  return listings;
}

// ===== MARKTPLAATS =====
// Marktplaats markdown is less structured - fall back to link extraction
function parseMarktplaats(md: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const lines = md.split('\n');

  // Look for linked titles: [Title](url)
  for (let i = 0; i < lines.length && listings.length < 25; i++) {
    const line = lines[i].trim();

    const linkMatch = line.match(/\[([^\]]+)\]\((https:\/\/www\.marktplaats\.nl\/v\/auto-s\/[^)]+)\)/);
    if (!linkMatch) continue;

    const title = linkMatch[1];
    const url = linkMatch[2];

    // Must look like a car listing
    if (title.length < 10) continue;

    const idMatch = url.match(/m(\d{7,})/);
    if (!idMatch) continue;
    const externalId = `marktplaats-${idMatch[1]}`;

    // Scan context for price, year, mileage
    let price: number | null = null;
    let year: number | null = null;
    let mileage: number | null = null;
    let fuel: string | null = null;
    let image: string | null = null;

    for (let j = Math.max(0, i - 5); j < Math.min(i + 10, lines.length); j++) {
      const l = lines[j].trim();

      if (!price) {
        const pM = l.match(/€\s*([\d.,]+)/);
        if (pM) {
          const ps = pM[1].replace(/\./g, '').replace(',', '');
          const p = parseInt(ps);
          if (p >= 500 && p < 300000) price = p;
        }
      }

      if (!year) {
        const yM = l.match(/\b(20[0-2]\d)\b/);
        if (yM) year = parseInt(yM[1]);
      }

      if (mileage === null) {
        const kM = l.match(/([\d.,]+)\s*km/);
        if (kM) {
          const km = parseInt(kM[1].replace(/[.,]/g, ''));
          if (km >= 100 && km < 999999) mileage = km;
        }
      }

      if (!fuel) {
        const fM = l.match(/\b(Diesel|Benzine|Hybrid|Elektrisch|LPG)\b/i);
        if (fM) fuel = normalizeFuel(fM[1]);
      }

      if (!image) {
        const imgM = l.match(/!\[.*?\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|webp|png)[^)]*)\)/);
        if (imgM) image = imgM[1];
      }
    }

    if (!price) continue;

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
      location: null,
      country: 'Olandija',
      source: 'Marktplaats',
      source_url: 'https://marktplaats.nl',
      listing_url: url,
      image,
    });
  }

  console.log(`Marktplaats: ${listings.length} listings`);
  return listings;
}

// ===== SOURCES =====
interface Src {
  name: string;
  url: (b: string, m: string, all: boolean) => string;
  parse: (md: string, b: string, m: string) => CarListing[];
}

const SOURCES: Src[] = [
  {
    name: 'AutoScout24',
    url: (b, m, all) => all
      ? `https://www.autoscout24.com/lst/${b.toLowerCase()}?sort=standard&desc=0&atype=C&cy=D%2CA%2CB%2CF%2CI%2CL%2CNL&ustate=N%2CU&size=20`
      : `https://www.autoscout24.com/lst/${b.toLowerCase()}/${m.toLowerCase().replace(/\s+/g, '-')}?sort=standard&desc=0&atype=C&cy=D%2CA%2CB%2CF%2CI%2CL%2CNL&ustate=N%2CU&size=20`,
    parse: parseAutoScout24,
  },
  {
    name: 'Otomoto',
    url: (b, m, all) => all
      ? `https://www.otomoto.pl/osobowe/${b.toLowerCase()}?search%5Border%5D=created_at_first%3Adesc`
      : `https://www.otomoto.pl/osobowe/${b.toLowerCase()}/${m.toLowerCase().replace(/\s+/g, '-')}?search%5Border%5D=created_at_first%3Adesc`,
    parse: parseOtomoto,
  },
  {
    name: 'Schadeautos',
    url: (b, m, all) => all
      ? `https://www.schadeautos.nl/en/damaged-car/${b.toLowerCase()}`
      : `https://www.schadeautos.nl/en/damaged-car/${b.toLowerCase()}?q=${m.toLowerCase()}`,
    parse: parseSchadeautos,
  },
  {
    name: 'Marktplaats',
    url: (b, m, all) => all
      ? `https://www.marktplaats.nl/l/auto-s/${b.toLowerCase()}/`
      : `https://www.marktplaats.nl/l/auto-s/${b.toLowerCase()}/q/${m.toLowerCase()}/`,
    parse: parseMarktplaats,
  },
];

// ===== MAIN =====
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand, model } = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const fcKey = Deno.env.get('FIRECRAWL_API_KEY_1') || Deno.env.get('FIRECRAWL_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!brand) {
      const { data } = await supabase.from('car_listings').select('*').order('scraped_at', { ascending: false }).limit(100);
      return new Response(JSON.stringify({ success: true, data: data || [], cached: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!fcKey) {
      return new Response(JSON.stringify({ success: false, error: 'API key missing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isAll = !model || model === '*';
    const all: CarListing[] = [];
    const counts: Record<string, number> = {};

    console.log(`\n===== ${brand} ${isAll ? '(all)' : model} =====`);

    for (const src of SOURCES) {
      try {
        const url = src.url(brand, model, isAll);
        console.log(`\n--- ${src.name} ---`);
        const md = await scrapeUrl(fcKey, url);
        if (md.length > 200) {
          const parsed = src.parse(md, brand, isAll ? '' : model).filter(l => l.price >= 500);
          all.push(...parsed);
          counts[src.name] = parsed.length;
        } else {
          counts[src.name] = 0;
        }
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        console.error(`${src.name}:`, e);
        counts[src.name] = 0;
      }
    }

    console.log(`\nTOTAL: ${all.length}`, JSON.stringify(counts));

    if (all.length > 0) {
      const { error } = await supabase.from('car_listings').upsert(all, { onConflict: 'external_id,source' });
      if (error) console.error('DB:', error);
      else console.log(`Saved ${all.length}`);
    }

    let q = supabase.from('car_listings').select('*').ilike('brand', `%${brand}%`);
    if (!isAll) q = q.ilike('model', `%${model}%`);
    const { data: fresh } = await q.order('scraped_at', { ascending: false }).limit(100);

    return new Response(JSON.stringify({ success: true, data: fresh || [], cached: false, count: all.length, sources: counts }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
