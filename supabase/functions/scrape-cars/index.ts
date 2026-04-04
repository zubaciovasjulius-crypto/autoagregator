import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== TYPES =====
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
function normBrand(b: string): string {
  const u = b.toUpperCase().trim();
  if (u === 'VW' || u === 'VOLKS' || u === 'VOLKSWAGON') return 'VOLKSWAGEN';
  if (u.includes('MERCEDES') || u === 'MB') return 'MERCEDES';
  if (u === 'CHEVY') return 'CHEVROLET';
  if (u === 'ALFA') return 'ALFA ROMEO';
  return u;
}

function normFuel(f: string): string {
  if (!f) return 'Dyzelinas';
  const l = f.toLowerCase();
  if (l.includes('diesel') || l.includes('dyzel') || l.includes('dīzelis') || l.includes('diisel')) return 'Dyzelinas';
  if (l.includes('petrol') || l.includes('benzin') || l.includes('gasoline') || l.includes('benzyna') || l.includes('bensiin')) return 'Benzinas';
  if (l.includes('plug') || l.includes('phev')) return 'Plug-in Hibridas';
  if (l.includes('hybrid') || l.includes('hibrid') || l.includes('hübriid')) return 'Hibridas';
  if (l.includes('electr') || l.includes('elektr') || l.includes('ev') || l.includes('elektri')) return 'Elektra';
  if (l.includes('lpg') || l.includes('gpl') || l.includes('dujos') || l.includes('gāze')) return 'LPG';
  if (l.includes('cng')) return 'CNG';
  return f;
}

function normTrans(t: string): string {
  if (!t) return 'Automatinė';
  const l = t.toLowerCase();
  if (l.includes('auto') || l.includes('tiptronic') || l.includes('dsg') || l.includes('cvt') || l.includes('roboti')) return 'Automatinė';
  if (l.includes('manual') || l.includes('mechan') || l.includes('manuāl') || l.includes('käsi')) return 'Mechaninė';
  return t;
}

// Parse European price: "17.800", "17 800", "17,800", "€ 17.800,-"
function parseEurPrice(s: string): number | null {
  if (!s) return null;
  // Remove currency symbols, whitespace formatting
  let c = s.replace(/[€$£PLNzłKčEUReur,\-–\s]/gi, '');
  // European format: 17.800 (dots as thousands) → 17800
  // But 17.80 could be decimals... if has exactly 3 digits after last dot, it's thousands
  const dotParts = c.split('.');
  if (dotParts.length > 1 && dotParts[dotParts.length - 1].length === 3) {
    c = c.replace(/\./g, '');
  } else if (dotParts.length === 2 && dotParts[1].length <= 2) {
    c = dotParts[0]; // Strip cents
  }
  const n = parseInt(c);
  return (n >= 200 && n < 500000) ? n : null;
}

// Parse mileage: "123.456 km", "123 456", "123456"
function parseKm(s: string): number | null {
  if (!s) return null;
  const c = s.replace(/[^\d]/g, '');
  const n = parseInt(c);
  return (n >= 0 && n < 1500000) ? n : null;
}

// Parse year
function parseYear(s: string): number | null {
  const m = s.match(/\b(19[89]\d|20[0-2]\d)\b/);
  return m ? parseInt(m[1]) : null;
}

// Country code → Lithuanian name
const CC: Record<string, string> = {
  'DE': 'Vokietija', 'AT': 'Austrija', 'BE': 'Belgija', 'FR': 'Prancūzija',
  'NL': 'Olandija', 'IT': 'Italija', 'ES': 'Ispanija', 'CH': 'Šveicarija',
  'CZ': 'Čekija', 'PL': 'Lenkija', 'SE': 'Švedija', 'DK': 'Danija',
  'LU': 'Liuksemburgas', 'LT': 'Lietuva', 'LV': 'Latvija', 'EE': 'Estija',
  'FI': 'Suomija', 'NO': 'Norvegija', 'HU': 'Vengrija', 'SK': 'Slovakija',
  'RO': 'Rumunija', 'BG': 'Bulgarija', 'HR': 'Kroatija', 'SI': 'Slovėnija',
  'PT': 'Portugalija', 'IE': 'Airija', 'GB': 'Jungtinė Karalystė', 'UK': 'Jungtinė Karalystė',
};

// ===== FIRECRAWL =====
async function scrape(key: string, url: string): Promise<string> {
  try {
    console.log(`→ Scraping: ${url}`);
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true, waitFor: 5000, timeout: 30000 }),
    });
    if (!res.ok) { console.error(`  Firecrawl ${res.status}`); return ''; }
    const data = await res.json();
    const md = data.data?.markdown || data.markdown || '';
    if (md.includes('Access Denied') || md.includes('captcha') || md.includes('blocked')) {
      console.log('  ⚠ Blocked/captcha');
      return '';
    }
    console.log(`  ✓ ${md.length} chars`);
    return md;
  } catch (e) { console.error('  ✗ Scrape error:', e); return ''; }
}

// ===== AUTOSCOUT24 =====
function parseAutoScout24(md: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const lines = md.split('\n');

  for (let i = 0; i < lines.length && listings.length < 30; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('**') || !line.endsWith('**') || line.length < 15) continue;
    const title = line.replace(/\*\*/g, '').trim();
    if (/show more|filter|sort|sponsored|save search/i.test(title)) continue;

    let image: string | null = null, price: number | null = null;
    let year: number | null = null, mileage: number | null = null;
    let fuel: string | null = null, location: string | null = null, country = 'Europa';

    for (let j = i + 1; j < Math.min(i + 25, lines.length); j++) {
      const l = lines[j].trim();

      if (!image) {
        const m = l.match(/!\[.*?\]\((https:\/\/prod\.pictures\.autoscout24\.net[^\s)]+)\)/);
        if (m) image = m[1].replace(/\/\d+x\d+\./, '/720x540.');
      }

      if (!price) {
        const m = l.match(/^€\s*([\d.,]+)\d?$/);
        if (m) {
          let ps = m[0].replace(/^€\s*/, '');
          // Strip trailing footnote digit
          if (ps.length > 4 && /[12]$/.test(ps)) ps = ps.slice(0, -1);
          price = parseEurPrice(ps);
        }
      }

      if (!year) {
        const m = l.match(/^(\d{2})\/(\d{4})$/);
        if (m) year = parseInt(m[2]);
      }

      if (mileage === null) {
        const m = l.match(/^([\d.,\s]+)\s*km$/);
        if (m) mileage = parseKm(m[1]);
      }

      if (!fuel && /^(Diesel|Gasoline|Petrol|Hybrid|Electric|LPG|CNG|Plug-in)/i.test(l)) {
        fuel = normFuel(l);
      }

      const locM = l.match(/([A-Z]{2})-(\d{4,5})\s+(.+)/);
      if (locM) {
        location = `${locM[3].trim()}, ${locM[1]}`;
        country = CC[locM[1]] || 'Europa';
        break;
      }

      if (j > i + 5 && l.startsWith('**') && l.endsWith('**') && l.length > 15) break;
    }

    if (!price || price < 500) continue;

    const hash = `${title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}-${price}`;
    listings.push({
      external_id: `as24-${hash}`,
      title: title.substring(0, 200),
      brand: normBrand(brand), model: model || '',
      year: year || new Date().getFullYear(), price, mileage, fuel,
      transmission: null, location, country,
      source: 'AutoScout24', source_url: 'https://autoscout24.com',
      listing_url: null, image,
    });
  }
  console.log(`  AutoScout24: ${listings.length}`);
  return listings;
}

// ===== OTOMOTO (PL) =====
function parseOtomoto(md: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const lines = md.split('\n');

  for (let i = 0; i < lines.length && listings.length < 30; i++) {
    const line = lines[i].trim();
    const tm = line.match(/^##\s+\[([^\]]+)\]\((https:\/\/www\.otomoto\.pl\/osobowe\/oferta\/[^)]+)\)/);
    if (!tm) continue;

    const title = tm[1], listingUrl = tm[2];
    const idM = listingUrl.match(/-ID([a-zA-Z0-9]+)/);
    const eid = idM ? `otomoto-${idM[1]}` : `otomoto-${Date.now()}-${listings.length}`;

    let image: string | null = null, mileage: number | null = null;
    let fuel: string | null = null, transmission: string | null = null;
    let year: number | null = null, price: number | null = null, location: string | null = null;

    // Image above
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const m = lines[j].trim().match(/!\[.*?\]\((https:\/\/ireland\.apollo\.olxcdn\.com\/[^)]+)\)/);
      if (m) { image = m[1]; break; }
    }

    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const l = lines[j].trim();

      // Concatenated specs: mileageXXX XXX kmfuel_typeDieselgearboxAutomatycznayearYYYY
      const specM = l.match(/mileage([\d\s]+)km.*?fuel[_\s]?type(\w+).*?gearbox(\w+).*?year(\d{4})/i);
      if (specM) {
        mileage = parseKm(specM[1]);
        fuel = normFuel(specM[2]);
        transmission = normTrans(specM[3]);
        year = parseInt(specM[4]);
      }

      if (l.startsWith('- ') && l.includes('(')) location = l.replace(/^-\s*/, '').trim();

      const prM = l.match(/^###\s+([\d\s]+)$/);
      if (prM) {
        const pln = parseInt(prM[1].replace(/\s/g, ''));
        if (pln >= 5000 && pln < 3000000) price = Math.round(pln / 4.3);
      }

      if (j > i + 3 && l.startsWith('## [')) break;
    }

    if (!price || price < 300) continue;

    listings.push({
      external_id: eid, title,
      brand: normBrand(brand), model: model || '',
      year: year || new Date().getFullYear(), price, mileage, fuel, transmission,
      location, country: 'Lenkija',
      source: 'Otomoto', source_url: 'https://otomoto.pl',
      listing_url: listingUrl, image,
    });
  }
  console.log(`  Otomoto: ${listings.length}`);
  return listings;
}

// ===== SCHADEAUTOS (NL) =====
function parseSchadeautos(md: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const lines = md.split('\n');

  for (let i = 0; i < lines.length && listings.length < 30; i++) {
    const line = lines[i].trim();
    
    // Match various link patterns from schadeautos
    const tm = line.match(/\[([^\]]{5,})\]\((https?:\/\/(?:www\.)?schadeautos\.nl\/[^)]*(?:damaged|car|voertuig|auto)[^)]*)\)/) ||
               line.match(/##\s+\[([^\]]+)\]\((https?:\/\/(?:www\.)?schadeautos\.nl\/[^)]+)\)/);
    if (!tm) continue;

    const title = tm[1], listingUrl = tm[2];
    if (/filter|zoek|search|cookie|privacy/i.test(title)) continue;
    
    const idM = listingUrl.match(/\/o\/(\d+)/) || listingUrl.match(/\/(\d{4,})/);
    const eid = idM ? `schadeautos-${idM[1]}` : `schadeautos-${Date.now()}-${listings.length}`;

    let image: string | null = null, price: number | null = null;
    let year: number | null = null, fuel: string | null = null, mileage: number | null = null;

    // Look both above and below for data
    for (let j = Math.max(0, i - 8); j < Math.min(i + 15, lines.length); j++) {
      const l = lines[j].trim();
      
      // Price patterns
      if (!price) {
        const m = l.match(/€\s*([\d.,]+)/) || l.match(/([\d.,]+)\s*€/);
        if (m) price = parseEurPrice(m[1]);
      }
      
      // Year patterns
      if (!year) {
        const m = l.match(/ERD:\s*(\d{4})/) || l.match(/bouwjaar[:\s]*(\d{4})/i) || l.match(/year[:\s]*(\d{4})/i);
        if (m) year = parseInt(m[1]);
      }
      if (!year) year = parseYear(l);
      
      // Fuel
      if (!fuel) {
        const m = l.match(/\b(Diesel|Benzine|Hybrid|Elektrisch|LPG|Petrol|Electric)\b/i) ||
                  l.match(/fuel[:\s]*([^,|\n]+)/i) || l.match(/brandstof[:\s]*([^,|\n]+)/i);
        if (m) fuel = normFuel(m[1].trim());
      }
      
      // Mileage
      if (mileage === null) {
        const m = l.match(/([\d.,]+)\s*km/i) || l.match(/mileage[:\s]*([\d.,]+)/i) || l.match(/tellerstand[:\s]*([\d.,]+)/i);
        if (m) mileage = parseKm(m[1]);
      }
      
      // Images - schadeautos cache or CDN
      if (!image) {
        const m = l.match(/!\[.*?\]\((https?:\/\/(?:www\.)?schadeautos\.nl\/cache\/picture\/[^)]+)\)/) ||
                  l.match(/!\[.*?\]\((https?:\/\/[^)]+schadeautos[^)]+\.(?:jpg|jpeg|webp|png)[^)]*)\)/) ||
                  l.match(/!\[.*?\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|webp|png)[^)]*)\)/);
        if (m) image = m[1].replace(/\/\d+\/(\d+)\//, '/1200/$1/');
      }
      
      if (j > i + 3 && (l.startsWith('## [') || l.match(/\[([^\]]{5,})\]\(https?:\/\/(?:www\.)?schadeautos/))) break;
    }

    if (!price) continue;

    listings.push({
      external_id: eid, title: title.substring(0, 200),
      brand: normBrand(brand), model: model || '',
      year: year || new Date().getFullYear(), price, mileage, fuel,
      transmission: null, location: 'Olandija', country: 'Olandija',
      source: 'Schadeautos', source_url: 'https://schadeautos.nl',
      listing_url: listingUrl, image,
    });
  }
  console.log(`  Schadeautos: ${listings.length}`);
  return listings;
}

// ===== MARKTPLAATS (NL) =====
function parseMarktplaats(md: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  
  // Marktplaats format: each listing is a single markdown list item:
  // - [![Alt](image_url)]\\ \n **Title** \\ \n € price \\ \n specs](listing_url)
  // We need to find blocks that start with "- [" and end with "](https://www.marktplaats.nl/v/..."
  
  // Strategy: find listing URLs and work backwards to extract data
  const listingBlocks = md.split(/^- \[/m);
  
  for (const block of listingBlocks) {
    if (listings.length >= 30) break;
    
    // Find the listing URL at the end of the block
    const urlMatch = block.match(/\]\((https?:\/\/(?:www\.)?marktplaats\.nl\/v\/auto-s\/[^)]+m(\d{7,})[^)]*)\)/);
    if (!urlMatch) continue;
    
    const listingUrl = urlMatch[1];
    const eid = `marktplaats-${urlMatch[2]}`;
    
    // Extract title from **Title**
    const titleMatch = block.match(/\*\*([^*]{5,})\*\*/);
    const title = titleMatch ? titleMatch[1].trim() : `${brand} ${model}`;
    
    // Extract image from [![...](image_url)
    let image: string | null = null;
    const imgMatch = block.match(/!\[.*?\]\((https?:\/\/images\.marktplaats\.com[^)]+)\)/) ||
                     block.match(/!\[.*?\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|webp|png)[^)]*)\)/);
    if (imgMatch) image = imgMatch[1];
    
    // Extract price from € XX.XXX,- or € XX.XXX
    let price: number | null = null;
    const priceMatch = block.match(/€\s*([\d.,]+)/);
    if (priceMatch) price = parseEurPrice(priceMatch[1]);
    
    if (!price) continue;
    
    // Extract year - look for 4 digit year in specs line like "2015302.216kmDieselAutomaat..."
    let year: number | null = null;
    const yearMatch = block.match(/\\\\?\s*(\d{4})([\d.,]*km)?/);
    if (yearMatch) {
      const y = parseInt(yearMatch[1]);
      if (y >= 1990 && y <= new Date().getFullYear() + 1) year = y;
    }
    if (!year) year = parseYear(block);
    
    // Extract mileage - "302.216km" or "123.456 km"
    let mileage: number | null = null;
    const kmMatch = block.match(/([\d.,]+)\s*km/i);
    if (kmMatch) mileage = parseKm(kmMatch[1]);
    
    // Extract fuel
    let fuel: string | null = null;
    const fuelMatch = block.match(/\b(Diesel|Benzine|Hybrid|Elektrisch|LPG|Plug-in hybride|Volledig hybride|Half hybride)\b/i);
    if (fuelMatch) fuel = normFuel(fuelMatch[1]);
    
    // Extract location (appears after the block, on separate lines)
    // We skip this for now as it's outside the block
    
    listings.push({
      external_id: eid, title: title.substring(0, 200),
      brand: normBrand(brand), model: model || '',
      year: year || new Date().getFullYear(), price, mileage, fuel,
      transmission: null, location: null, country: 'Olandija',
      source: 'Marktplaats', source_url: 'https://marktplaats.nl',
      listing_url: listingUrl, image,
    });
  }
  console.log(`  Marktplaats: ${listings.length}`);
  return listings;
}

// ===== AUTOPLIUS.LT =====
function parseAutoplius(md: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const lines = md.split('\n');

  for (let i = 0; i < lines.length && listings.length < 30; i++) {
    const line = lines[i].trim();
    // Pattern: [Title](https://autoplius.lt/skelbimai/...)  or  ## [Title](url)
    const lm = line.match(/\[([^\]]{5,})\]\((https?:\/\/(?:www\.)?autoplius\.lt\/skelbimai\/[^)]+)\)/);
    if (!lm) continue;

    const title = lm[1], url = lm[2];
    const idM = url.match(/(\d{5,})/);
    const eid = idM ? `autoplius-${idM[1]}` : `autoplius-${Date.now()}-${listings.length}`;

    let price: number | null = null, year: number | null = null;
    let mileage: number | null = null, fuel: string | null = null, image: string | null = null;
    let location: string | null = null;

    for (let j = Math.max(0, i - 5); j < Math.min(i + 12, lines.length); j++) {
      const l = lines[j].trim();
      if (!price) { const m = l.match(/([\d\s.,]+)\s*€/); if (m) price = parseEurPrice(m[1]); }
      if (!year) year = parseYear(l);
      if (mileage === null) { const m = l.match(/([\d\s.,]+)\s*km/i); if (m) mileage = parseKm(m[1]); }
      if (!fuel) {
        const m = l.match(/\b(Dyzelinas|Benzinas|Elektra|Hibridas|Dujos|Hybrid|Diesel)\b/i);
        if (m) fuel = normFuel(m[1]);
      }
      if (!image) {
        const m = l.match(/!\[.*?\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|webp|png)[^)]*)\)/);
        if (m) image = m[1];
      }
      // Location patterns for Lithuanian cities
      if (!location) {
        const m = l.match(/\b(Vilnius|Kaunas|Klaipėda|Šiauliai|Panevėžys|Alytus|Marijampolė|Utena)\b/i);
        if (m) location = m[1];
      }
    }

    if (!price) continue;

    listings.push({
      external_id: eid, title: title.substring(0, 200),
      brand: normBrand(brand), model: model || '',
      year: year || new Date().getFullYear(), price, mileage, fuel,
      transmission: null, location, country: 'Lietuva',
      source: 'Autoplius', source_url: 'https://autoplius.lt',
      listing_url: url, image,
    });
  }
  console.log(`  Autoplius: ${listings.length}`);
  return listings;
}

// ===== SS.LV (Latvia) =====
function parseSsLv(md: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const lines = md.split('\n');

  for (let i = 0; i < lines.length && listings.length < 30; i++) {
    const line = lines[i].trim();
    // Pattern: [text](https://www.ss.lv/msg/transport/...) or table rows with data
    const lm = line.match(/\[([^\]]{3,})\]\((https?:\/\/(?:www\.)?ss\.(?:lv|com)\/msg\/transport\/cars\/[^)]+)\)/);
    if (!lm) continue;

    const title = lm[1], url = lm[2];
    const idM = url.match(/\/([^/]+)\.html/);
    const eid = idM ? `sslv-${idM[1]}` : `sslv-${Date.now()}-${listings.length}`;

    let price: number | null = null, year: number | null = null;
    let mileage: number | null = null, fuel: string | null = null, image: string | null = null;

    for (let j = Math.max(0, i - 3); j < Math.min(i + 10, lines.length); j++) {
      const l = lines[j].trim();
      if (!price) { const m = l.match(/([\d\s.,]+)\s*€/); if (m) price = parseEurPrice(m[1]); }
      if (!year) year = parseYear(l);
      if (mileage === null) { const m = l.match(/([\d\s.,]+)\s*km/i); if (m) mileage = parseKm(m[1]); }
      if (!fuel) {
        const m = l.match(/\b(Dīzelis|Benzīns|Elektro|Hibrīds|Gāze|Diesel|Petrol)\b/i);
        if (m) fuel = normFuel(m[1]);
      }
      if (!image) {
        const m = l.match(/!\[.*?\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|webp|png)[^)]*)\)/);
        if (m) image = m[1];
      }
    }

    if (!price) continue;

    listings.push({
      external_id: eid, title: title.substring(0, 200),
      brand: normBrand(brand), model: model || '',
      year: year || new Date().getFullYear(), price, mileage, fuel,
      transmission: null, location: 'Rīga', country: 'Latvija',
      source: 'SS.lv', source_url: 'https://ss.lv',
      listing_url: url, image,
    });
  }
  console.log(`  SS.lv: ${listings.length}`);
  return listings;
}

// ===== AUTO24.EE (Estonia) =====
function parseAuto24(md: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const lines = md.split('\n');

  for (let i = 0; i < lines.length && listings.length < 30; i++) {
    const line = lines[i].trim();
    const lm = line.match(/\[([^\]]{5,})\]\((https?:\/\/(?:www\.)?auto24\.(?:ee|com)\/[^)]+)\)/);
    if (!lm) continue;

    const title = lm[1], url = lm[2];
    const idM = url.match(/(\d{5,})/);
    const eid = idM ? `auto24-${idM[1]}` : `auto24-${Date.now()}-${listings.length}`;

    let price: number | null = null, year: number | null = null;
    let mileage: number | null = null, fuel: string | null = null, image: string | null = null;

    for (let j = Math.max(0, i - 5); j < Math.min(i + 10, lines.length); j++) {
      const l = lines[j].trim();
      if (!price) { const m = l.match(/([\d\s.,]+)\s*€/); if (m) price = parseEurPrice(m[1]); }
      if (!year) year = parseYear(l);
      if (mileage === null) { const m = l.match(/([\d\s.,]+)\s*km/i); if (m) mileage = parseKm(m[1]); }
      if (!fuel) {
        const m = l.match(/\b(Diisel|Bensiin|Elektri|Hübriid|Gaas|Diesel|Petrol)\b/i);
        if (m) fuel = normFuel(m[1]);
      }
      if (!image) {
        const m = l.match(/!\[.*?\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|webp|png)[^)]*)\)/);
        if (m) image = m[1];
      }
    }

    if (!price) continue;

    listings.push({
      external_id: eid, title: title.substring(0, 200),
      brand: normBrand(brand), model: model || '',
      year: year || new Date().getFullYear(), price, mileage, fuel,
      transmission: null, location: 'Tallinn', country: 'Estija',
      source: 'Auto24.ee', source_url: 'https://auto24.ee',
      listing_url: url, image,
    });
  }
  console.log(`  Auto24.ee: ${listings.length}`);
  return listings;
}

// ===== MOBILE.DE =====
function parseMobileDe(md: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  const lines = md.split('\n');

  for (let i = 0; i < lines.length && listings.length < 30; i++) {
    const line = lines[i].trim();
    // Look for listing links or bold titles
    const lm = line.match(/\[([^\]]{10,})\]\((https?:\/\/(?:suchen\.)?mobile\.de\/[^)]+)\)/) ||
               line.match(/\[([^\]]{10,})\]\((https?:\/\/www\.mobile\.de\/[^)]+)\)/);
    
    const isBoldTitle = !lm && line.startsWith('**') && line.endsWith('**') && line.length > 15;
    
    if (!lm && !isBoldTitle) continue;
    
    const title = lm ? lm[1] : line.replace(/\*\*/g, '').trim();
    const listingUrl = lm ? lm[2] : null;
    
    if (/filter|suche|sort|anzeige aufgeben/i.test(title)) continue;

    const eid = listingUrl 
      ? `mobilede-${listingUrl.match(/(\d{6,})/)?.[1] || Date.now()}`
      : `mobilede-${title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}-${i}`;

    let price: number | null = null, year: number | null = null;
    let mileage: number | null = null, fuel: string | null = null;
    let image: string | null = null, location: string | null = null;

    for (let j = Math.max(0, i - 3); j < Math.min(i + 15, lines.length); j++) {
      const l = lines[j].trim();
      if (!price) { const m = l.match(/€\s*([\d.,]+)/); if (m) price = parseEurPrice(m[1]); }
      if (!price) { const m = l.match(/([\d.,]+)\s*€/); if (m) price = parseEurPrice(m[1]); }
      if (!year) { const m = l.match(/EZ\s*(\d{2})\/(\d{4})/); if (m) year = parseInt(m[2]); }
      if (!year) year = parseYear(l);
      if (mileage === null) { const m = l.match(/([\d.,]+)\s*km/i); if (m) mileage = parseKm(m[1]); }
      if (!fuel) {
        const m = l.match(/\b(Diesel|Benzin|Hybrid|Elektro|LPG|CNG|Plug-in)/i);
        if (m) fuel = normFuel(m[1]);
      }
      if (!image) {
        const m = l.match(/!\[.*?\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|webp|png)[^)]*)\)/);
        if (m) image = m[1];
      }
      if (!location) {
        const m = l.match(/\b(\d{5})\s+([A-ZÄÖÜa-zäöüß]+)/);
        if (m) location = `${m[2]}, DE`;
      }
    }

    if (!price || price < 500) continue;

    listings.push({
      external_id: eid, title: title.substring(0, 200),
      brand: normBrand(brand), model: model || '',
      year: year || new Date().getFullYear(), price, mileage, fuel,
      transmission: null, location, country: 'Vokietija',
      source: 'Mobile.de', source_url: 'https://mobile.de',
      listing_url: listingUrl, image,
    });
  }
  console.log(`  Mobile.de: ${listings.length}`);
  return listings;
}

// ===== GENERIC FALLBACK PARSER =====
// Works for sites we don't have specific parsers for
function parseGeneric(md: string, brand: string, model: string, sourceName: string, sourceUrl: string, defaultCountry: string, urlPattern: RegExp): CarListing[] {
  const listings: CarListing[] = [];
  const lines = md.split('\n');

  for (let i = 0; i < lines.length && listings.length < 20; i++) {
    const line = lines[i].trim();
    const lm = line.match(new RegExp(`\\[([^\\]]{8,})\\]\\((${urlPattern.source})\\)`));
    if (!lm) continue;

    const title = lm[1], url = lm[2];
    const idM = url.match(/(\d{5,})/);
    const eid = `${sourceName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${idM?.[1] || Date.now()}-${listings.length}`;

    let price: number | null = null, year: number | null = null;
    let mileage: number | null = null, fuel: string | null = null, image: string | null = null;

    for (let j = Math.max(0, i - 5); j < Math.min(i + 10, lines.length); j++) {
      const l = lines[j].trim();
      if (!price) { const m = l.match(/([\d\s.,]+)\s*€/) || l.match(/€\s*([\d\s.,]+)/); if (m) price = parseEurPrice(m[1]); }
      if (!year) year = parseYear(l);
      if (mileage === null) { const m = l.match(/([\d\s.,]+)\s*km/i); if (m) mileage = parseKm(m[1]); }
      if (!fuel) {
        const m = l.match(/\b(Diesel|Benzin|Petrol|Hybrid|Electric|Elektr|LPG|Dyzel|Benzinas)\b/i);
        if (m) fuel = normFuel(m[1]);
      }
      if (!image) {
        const m = l.match(/!\[.*?\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|webp|png)[^)]*)\)/);
        if (m) image = m[1];
      }
    }

    if (!price) continue;

    listings.push({
      external_id: eid, title: title.substring(0, 200),
      brand: normBrand(brand), model: model || '',
      year: year || new Date().getFullYear(), price, mileage, fuel,
      transmission: null, location: null, country: defaultCountry,
      source: sourceName, source_url: sourceUrl,
      listing_url: url, image,
    });
  }
  console.log(`  ${sourceName}: ${listings.length}`);
  return listings;
}

// ===== SOURCE DEFINITIONS =====
interface Source {
  name: string;
  url: (b: string, m: string, all: boolean) => string;
  parse: (md: string, b: string, m: string) => CarListing[];
  priority: number; // Lower = scraped first
}

const SOURCES: Source[] = [
  // === TIER 1: Most reliable, largest inventory ===
  {
    name: 'AutoScout24',
    priority: 1,
    url: (b, m, all) => all
      ? `https://www.autoscout24.com/lst/${b.toLowerCase()}?sort=standard&desc=0&atype=C&cy=D%2CA%2CB%2CF%2CI%2CL%2CNL&ustate=N%2CU&size=20`
      : `https://www.autoscout24.com/lst/${b.toLowerCase()}/${m.toLowerCase().replace(/\s+/g, '-')}?sort=standard&desc=0&atype=C&cy=D%2CA%2CB%2CF%2CI%2CL%2CNL&ustate=N%2CU&size=20`,
    parse: parseAutoScout24,
  },
  {
    name: 'Mobile.de',
    priority: 2,
    url: (b, m, all) => all
      ? `https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&ms=${encodeURIComponent(b)}&ref=quickSearch&sfmr=false&vc=Car`
      : `https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&ms=${encodeURIComponent(b)}%3B%3B${encodeURIComponent(m)}&ref=quickSearch&sfmr=false&vc=Car`,
    parse: parseMobileDe,
  },
  {
    name: 'Otomoto',
    priority: 3,
    url: (b, m, all) => all
      ? `https://www.otomoto.pl/osobowe/${b.toLowerCase()}?search%5Border%5D=created_at_first%3Adesc`
      : `https://www.otomoto.pl/osobowe/${b.toLowerCase()}/${m.toLowerCase().replace(/\s+/g, '-')}?search%5Border%5D=created_at_first%3Adesc`,
    parse: parseOtomoto,
  },

  // === TIER 2: Good secondary sources ===
  {
    name: 'Schadeautos',
    priority: 4,
    url: (b, m, all) => all
      ? `https://www.schadeautos.nl/en/damaged-car/${b.toLowerCase()}`
      : `https://www.schadeautos.nl/en/damaged-car/${b.toLowerCase()}?q=${m.toLowerCase()}`,
    parse: parseSchadeautos,
  },
  {
    name: 'Marktplaats',
    priority: 5,
    url: (b, m, all) => all
      ? `https://www.marktplaats.nl/l/auto-s/${b.toLowerCase()}/`
      : `https://www.marktplaats.nl/l/auto-s/${b.toLowerCase()}/q/${m.toLowerCase()}/`,
    parse: parseMarktplaats,
  },

  // === TIER 3: Baltic countries ===
  {
    name: 'Autoplius',
    priority: 6,
    url: (b, m, all) => all
      ? `https://autoplius.lt/skelbimai/naudoti-automobiliai?make_id_list=${encodeURIComponent(b)}`
      : `https://autoplius.lt/skelbimai/naudoti-automobiliai?make_id_list=${encodeURIComponent(b)}&model_id_list=${encodeURIComponent(m)}`,
    parse: parseAutoplius,
  },
  {
    name: 'SS.lv',
    priority: 7,
    url: (b, m, all) => {
      const bLow = b.toLowerCase();
      return all
        ? `https://www.ss.lv/lv/transport/cars/${bLow}/`
        : `https://www.ss.lv/lv/transport/cars/${bLow}/${m.toLowerCase().replace(/\s+/g, '-')}/`;
    },
    parse: parseSsLv,
  },
  {
    name: 'Auto24.ee',
    priority: 8,
    url: (b, m, all) => all
      ? `https://www.auto24.ee/kasutatud/nimekiri.php?bn=2&a=100&ae=2&af=50&otession%5B%5D=${encodeURIComponent(b)}`
      : `https://www.auto24.ee/kasutatud/nimekiri.php?bn=2&a=100&ae=2&af=50&otession%5B%5D=${encodeURIComponent(b)}&ak%5B%5D=${encodeURIComponent(m)}`,
    parse: parseAuto24,
  },
];

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand, model, forceRefresh } = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const fcKey = Deno.env.get('FIRECRAWL_API_KEY_1') || Deno.env.get('FIRECRAWL_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // No brand = return cached
    if (!brand) {
      const { data } = await supabase.from('car_listings').select('*')
        .order('scraped_at', { ascending: false }).limit(100);
      return new Response(JSON.stringify({ success: true, data: data || [], cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isAll = !model || model === '*';

    // If NOT forceRefresh, return cached data if we have recent results (< 5 min old)
    if (!forceRefresh) {
      let q = supabase.from('car_listings').select('*').ilike('brand', `%${brand}%`);
      if (!isAll) q = q.ilike('model', `%${model}%`);
      const { data: cached } = await q.order('scraped_at', { ascending: false }).limit(200);
      
      if (cached && cached.length > 0) {
        const newestAt = new Date(cached[0].scraped_at).getTime();
        const fiveMinAgo = Date.now() - 5 * 60 * 1000;
        if (newestAt > fiveMinAgo) {
          console.log(`Cache hit: ${cached.length} listings for ${brand} ${model || '*'}`);
          return new Response(JSON.stringify({ success: true, data: cached, cached: true, count: cached.length }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    if (!fcKey) {
      // No API key - return whatever we have cached
      let q = supabase.from('car_listings').select('*').ilike('brand', `%${brand}%`);
      if (!isAll) q = q.ilike('model', `%${model}%`);
      const { data: fallback } = await q.order('scraped_at', { ascending: false }).limit(200);
      return new Response(JSON.stringify({ success: true, data: fallback || [], cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allListings: CarListing[] = [];
    const counts: Record<string, number> = {};

    console.log(`\n========== SCRAPING: ${brand} ${isAll ? '(all models)' : model} ==========`);

    // Sort by priority, only scrape top 4 sources to stay within timeout
    const sortedSources = [...SOURCES].sort((a, b) => a.priority - b.priority).slice(0, 4);

    for (const src of sortedSources) {
      try {
        const url = src.url(brand, model || '', isAll);
        console.log(`\n--- ${src.name} (priority ${src.priority}) ---`);
        
        const md = await scrape(fcKey, url);
        
        if (md.length > 200) {
          const parsed = src.parse(md, brand, isAll ? '' : (model || '')).filter(l => l.price >= 500);
          allListings.push(...parsed);
          counts[src.name] = parsed.length;
        } else {
          console.log(`  ⚠ Too short (${md.length} chars), skipping parse`);
          counts[src.name] = 0;
        }

        // Rate limit: 1s between requests
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.error(`  ✗ ${src.name} error:`, e);
        counts[src.name] = 0;
      }
    }

    console.log(`\n========== TOTAL: ${allListings.length} listings ==========`);
    console.log('Per source:', JSON.stringify(counts));

    // Upsert to database
    if (allListings.length > 0) {
      for (let i = 0; i < allListings.length; i += 50) {
        const chunk = allListings.slice(i, i + 50);
        const { error } = await supabase.from('car_listings').upsert(chunk, { onConflict: 'external_id,source' });
        if (error) console.error('DB upsert error:', error.message);
      }
      console.log(`✓ Saved ${allListings.length} listings to DB`);
    }

    // Return fresh data from DB
    let q = supabase.from('car_listings').select('*').ilike('brand', `%${brand}%`);
    if (!isAll) q = q.ilike('model', `%${model}%`);
    const { data: fresh } = await q.order('scraped_at', { ascending: false }).limit(200);

    return new Response(JSON.stringify({
      success: true,
      data: fresh || [],
      cached: false,
      count: allListings.length,
      sources: counts,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
