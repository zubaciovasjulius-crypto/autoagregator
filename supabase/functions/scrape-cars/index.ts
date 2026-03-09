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
  if (b === 'MERCEDES-BENZ' || b === 'MB') return 'MERCEDES';
  if (b === 'ROLLS-ROYCE') return 'ROLLS ROYCE';
  if (b === 'LAND-ROVER') return 'LAND ROVER';
  return b;
}

function normalizeFuel(fuel: string): string {
  if (!fuel) return 'Dyzelinas';
  const f = fuel.toLowerCase();
  if (f.includes('diesel') || f.includes('dyzel') || f.includes('diz')) return 'Dyzelinas';
  if (f.includes('petrol') || f.includes('benzin') || f.includes('gasoline') || f.includes('essence')) return 'Benzinas';
  if (f.includes('hybrid') || f.includes('hybr') || f.includes('plug-in')) return 'Hibridas';
  if (f.includes('electric') || f.includes('elektr') || f.includes('ev') || f.includes('électr')) return 'Elektra';
  if (f.includes('lpg') || f.includes('gpl')) return 'LPG';
  if (f.includes('cng')) return 'CNG';
  return fuel;
}

function normalizeTransmission(trans: string): string {
  if (!trans) return 'Automatinė';
  const t = trans.toLowerCase();
  if (t.includes('auto') || t.includes('tiptronic') || t.includes('dsg') || t.includes('cvt') || t.includes('steptronic')) return 'Automatinė';
  if (t.includes('manual') || t.includes('mechani') || t.includes('handschalt') || t.includes('schaltgetriebe')) return 'Mechaninė';
  return trans;
}

function parsePrice(str: string): number | null {
  if (!str) return null;
  // Remove currency symbols, spaces, keep digits and separators
  const cleaned = str.replace(/[€$£\s]/g, '').replace(/,/g, '');
  // Handle European format: 17.800 -> 17800
  if (cleaned.match(/^\d{1,3}\.\d{3}$/)) return parseInt(cleaned.replace('.', ''));
  if (cleaned.match(/^\d{1,3}\.\d{3}\.\d{3}$/)) return parseInt(cleaned.replace(/\./g, ''));
  const num = parseInt(cleaned.replace(/\./g, ''));
  return isNaN(num) || num < 100 || num > 500000 ? null : num;
}

function parseMileage(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[,\s]/g, '');
  if (cleaned.match(/^\d{1,3}\.\d{3}$/)) return parseInt(cleaned.replace('.', ''));
  const num = parseInt(cleaned.replace(/\./g, ''));
  return isNaN(num) || num < 100 || num > 999999 ? null : num;
}

// ===== FIRECRAWL =====

async function scrapeUrl(firecrawlKey: string, url: string): Promise<{ markdown: string; html: string }> {
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
      console.error(`Firecrawl ${response.status}: ${err.substring(0, 200)}`);
      return { markdown: '', html: '' };
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.rawHtml || data.data?.html || data.rawHtml || data.html || '';

    if (markdown.toLowerCase().includes('access denied') || markdown.toLowerCase().includes('captcha')) {
      console.log('Blocked');
      return { markdown: '', html: '' };
    }

    console.log(`Got ${markdown.length} md, ${html.length} html`);
    return { markdown, html };
  } catch (error) {
    console.error('Scrape error:', error);
    return { markdown: '', html: '' };
  }
}

// ===== AUTOSCOUT24 PARSER =====
// Markdown format per listing:
// **Title**
// € XX,XXX
// MM/YYYY
// XXX,XXX km
// Fuel type
// XX kW (XX hp)
// DealerXX-XXXXX City
function parseAutoScout24(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];

  // Extract listing images from markdown
  const imagePattern = /!\[.*?\]\((https:\/\/prod\.pictures\.autoscout24\.net\/listing-images\/[^\s)]+)\)/g;
  const images: string[] = [];
  let m;
  while ((m = imagePattern.exec(markdown)) !== null) {
    // Get full-size version
    const img = m[1].replace(/\/\d+x\d+\.webp/, '/720x540.webp');
    images.push(img);
  }

  // Split markdown by bold titles (each listing starts with **Title**)
  const blocks = markdown.split(/\*\*(?=[A-Z])/);
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block || block.length < 30) continue;

    // Extract title (first line before **)
    const titleMatch = block.match(/^([^*]+)\*\*/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();
    
    // Must contain brand name
    if (!title.toUpperCase().includes(brand.toUpperCase())) continue;

    // Price
    const priceMatch = block.match(/€\s*([\d.,]+)/);
    const price = priceMatch ? parsePrice(priceMatch[1]) : null;
    if (!price || price < 500) continue;

    // Registration date -> year
    const regMatch = block.match(/(\d{2})\/(\d{4})/);
    const year = regMatch ? parseInt(regMatch[2]) : null;

    // Mileage
    const kmMatch = block.match(/([\d.,]+)\s*km/);
    const mileage = kmMatch ? parseMileage(kmMatch[1]) : null;

    // Fuel
    const fuelMatch = block.match(/\b(Diesel|Gasoline|Petrol|Hybrid|Electric|LPG|CNG|Plug-in[- ]Hybrid)\b/i);
    const fuel = fuelMatch ? normalizeFuel(fuelMatch[1]) : null;

    // Country from location (DE-XXXXX, AT-XXXXX, etc.)
    const locMatch = block.match(/([A-Z]{2})-(\d{4,5})\s+([^\n]+)/);
    let country = 'Europa';
    let location: string | null = null;
    if (locMatch) {
      const cc = locMatch[1];
      location = `${locMatch[3].trim()}, ${cc}`;
      const countryMap: Record<string, string> = {
        'DE': 'Vokietija', 'AT': 'Austrija', 'BE': 'Belgija', 'FR': 'Prancūzija',
        'NL': 'Olandija', 'IT': 'Italija', 'ES': 'Ispanija', 'PL': 'Lenkija',
        'CH': 'Šveicarija', 'CZ': 'Čekija', 'SE': 'Švedija', 'DK': 'Danija',
        'LU': 'Liuksemburgas',
      };
      country = countryMap[cc] || 'Europa';
    }

    // Extract detail link from HTML for this listing
    let listingUrl: string | null = null;
    // Try to find link by listing image ID
    const imgForThis = images[listings.length];
    if (imgForThis) {
      const imgId = imgForThis.match(/listing-images\/([a-f0-9-]+)/)?.[1];
      if (imgId) {
        const linkMatch = html.match(new RegExp(`href=["'](https?://www\\.autoscout24\\.[a-z]+/offers/[^"']*${imgId.slice(0, 8)}[^"']*)["']`));
        if (linkMatch) listingUrl = linkMatch[1];
      }
    }
    
    // Fallback: get links in order
    if (!listingUrl) {
      const allLinks = html.match(/href=["'](https?:\/\/www\.autoscout24\.[a-z]+\/offers\/[^"']+)["']/gi) || [];
      const linkIdx = listings.length;
      if (allLinks[linkIdx]) {
        const lm = allLinks[linkIdx].match(/href=["']([^"']+)["']/);
        if (lm) listingUrl = lm[1];
      }
    }

    const externalId = `as24-${Date.now()}-${listings.length}`;

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
      listing_url: listingUrl,
      image: images[listings.length - 1] || null,
    });
  }

  console.log(`AutoScout24: ${listings.length} listings`);
  return listings;
}

// ===== MOBILE.DE PARSER =====
function parseMobileDe(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];

  // Mobile.de images
  const imgPattern = /https:\/\/img\.classistatic\.de\/[^\s"')]+\.(?:jpg|jpeg|webp)/gi;
  const images = [...new Set(html.match(imgPattern) || [])];

  // Mobile.de markdown: listings separated by sections with price/km/year info
  const pricePattern = /€\s*([\d.,]+)|([\d.,]+)\s*€/g;
  const prices: number[] = [];
  let m;
  while ((m = pricePattern.exec(markdown)) !== null) {
    const p = parsePrice((m as RegExpExecArray)[1] || (m as RegExpExecArray)[2]);
    if (p && p >= 500 && p < 300000) prices.push(p);
  }

  const kmPattern = /([\d.,]+)\s*km/gi;
  const mileages: number[] = [];
  while ((m = kmPattern.exec(markdown)) !== null) {
    const km = parseMileage(m[1]);
    if (km) mileages.push(km);
  }

  // Registration dates: MM/YYYY or MM.YYYY
  const regPattern = /(\d{2})[/.](\d{4})/g;
  const years: number[] = [];
  while ((m = regPattern.exec(markdown)) !== null) {
    const y = parseInt(m[2]);
    if (y >= 1990 && y <= new Date().getFullYear() + 1) years.push(y);
  }

  const fuelPattern = /\b(Diesel|Benzin|Hybrid|Elektro|LPG|CNG|Plug-in)\b/gi;
  const fuels = markdown.match(fuelPattern) || [];

  const transPattern = /\b(Automatik|Schaltgetriebe)\b/gi;
  const transmissions = markdown.match(transPattern) || [];

  // Detail links
  const linkPattern = /href=["'](https?:\/\/suchen\.mobile\.de\/fahrzeuge\/details[^"']+|https?:\/\/www\.mobile\.de\/auto-inserat\/[^"']+)["']/gi;
  const links: string[] = [];
  while ((m = linkPattern.exec(html)) !== null) {
    if (!links.includes(m[1])) links.push(m[1]);
  }

  const count = Math.min(prices.length, 30);
  for (let i = 0; i < count; i++) {
    if (!prices[i] || prices[i] < 500) continue;

    const idMatch = links[i]?.match(/(\d{8,})/);
    const externalId = idMatch ? `mobile-${idMatch[1]}` : `mobile-${Date.now()}-${i}`;

    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${years[i] || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: years[i] || new Date().getFullYear(),
      price: prices[i],
      mileage: mileages[i] || null,
      fuel: fuels[i] ? normalizeFuel(fuels[i]) : null,
      transmission: transmissions[i] ? normalizeTransmission(transmissions[i]) : null,
      location: null,
      country: 'Vokietija',
      source: 'Mobile.de',
      source_url: 'https://mobile.de',
      listing_url: links[i] || null,
      image: images[i] || null,
    });
  }

  console.log(`Mobile.de: ${listings.length} listings`);
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

  const imgPattern = /https:\/\/www\.schadeautos\.nl\/cache\/picture\/[^\s"']+\.jpg/gi;
  const rawImages = [...new Set(html.match(imgPattern) || [])];
  const images = rawImages.map(img => img.replace(/\/\d+\/([a-f0-9]+)/, '/1200/$1'));

  const pricePattern = /€\s*([\d.,]+)|([\d.,]+)\s*€/g;
  const prices: number[] = [];
  while ((m = pricePattern.exec(markdown)) !== null) {
    const p = parsePrice(m[1] || m[2]);
    if (p && p >= 200 && p < 100000) prices.push(p);
  }

  const kmPattern = /([\d.,]+)\s*km/gi;
  const mileages: number[] = [];
  while ((m = kmPattern.exec(markdown)) !== null) {
    const km = parseMileage(m[1]);
    if (km) mileages.push(km);
  }

  const yearPattern = /\b(20[0-2]\d|199\d)\b/g;
  const years: number[] = [];
  while ((m = yearPattern.exec(markdown)) !== null) {
    const y = parseInt(m[1]);
    if (y >= 1990 && y <= new Date().getFullYear() + 1) years.push(y);
  }

  const fuelPattern = /\b(Diesel|Benzine|Petrol|Hybrid|Electric|LPG)\b/gi;
  const fuels = markdown.match(fuelPattern) || [];

  const count = Math.min(links.length, 25);
  for (let i = 0; i < count; i++) {
    const price = prices[i];
    if (!price) continue;

    const idMatch = links[i].match(/\/car\/(\d+)/);
    const externalId = idMatch ? `schadeautos-${idMatch[1]}` : `schadeautos-${Date.now()}-${i}`;

    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${years[i] || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: years[i] || new Date().getFullYear(),
      price,
      mileage: mileages[i] || null,
      fuel: fuels[i] ? normalizeFuel(fuels[i]) : null,
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

// ===== OTOMOTO PARSER =====
function parseOtomoto(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  let m;

  const linkPattern = /href=["'](https?:\/\/www\.otomoto\.pl\/osobowe\/oferta\/[^"']+)["']/gi;
  const links: string[] = [];
  while ((m = linkPattern.exec(html)) !== null) {
    if (!links.includes(m[1])) links.push(m[1]);
  }

  const imgPattern = /https:\/\/ireland\.apollo\.olxcdn\.com\/[^\s"']+\.(?:jpg|jpeg|webp)/gi;
  const images = [...new Set(html.match(imgPattern) || [])];

  // Prices - Otomoto uses PLN and EUR
  const pricePatternEUR = /€\s*([\d\s.,]+)|([\d\s.,]+)\s*€|([\d\s.,]+)\s*EUR/gi;
  const pricePatternPLN = /([\d\s.,]+)\s*(?:PLN|zł)/gi;
  const prices: number[] = [];
  
  while ((m = pricePatternEUR.exec(markdown)) !== null) {
    const p = parsePrice((m[1] || m[2] || m[3]).replace(/\s/g, ''));
    if (p && p >= 500 && p < 200000) prices.push(p);
  }
  if (prices.length === 0) {
    while ((m = pricePatternPLN.exec(markdown)) !== null) {
      const p = parsePrice(m[1].replace(/\s/g, ''));
      if (p && p >= 2000) prices.push(Math.round(p / 4.3));
    }
  }

  const kmPattern = /([\d\s.,]+)\s*km/gi;
  const mileages: number[] = [];
  while ((m = kmPattern.exec(markdown)) !== null) {
    const km = parseMileage(m[1].replace(/\s/g, ''));
    if (km) mileages.push(km);
  }

  const yearPattern = /\b(20[0-2]\d|199\d)\b/g;
  const years: number[] = [];
  while ((m = yearPattern.exec(markdown)) !== null) {
    const y = parseInt(m[1]);
    if (y >= 1990 && y <= new Date().getFullYear() + 1) years.push(y);
  }

  const fuelPattern = /\b(Diesel|Benzyna|Petrol|Hybrid|Elektryczny|LPG|CNG)\b/gi;
  const fuels = markdown.match(fuelPattern) || [];

  const count = Math.min(links.length, Math.max(prices.length, 3), 25);
  for (let i = 0; i < count; i++) {
    const price = prices[i];
    if (!price || price < 300) continue;

    const idMatch = links[i]?.match(/-ID([a-zA-Z0-9]+)/) || links[i]?.match(/oferta\/([^/?]+)/);
    const externalId = idMatch ? `otomoto-${idMatch[1].slice(0, 20)}` : `otomoto-${Date.now()}-${i}`;

    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${years[i] || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: years[i] || new Date().getFullYear(),
      price,
      mileage: mileages[i] || null,
      fuel: fuels[i] ? normalizeFuel(fuels[i]) : null,
      transmission: null,
      location: null,
      country: 'Lenkija',
      source: 'Otomoto',
      source_url: 'https://otomoto.pl',
      listing_url: links[i] || null,
      image: images[i] || null,
    });
  }

  console.log(`Otomoto: ${listings.length} listings`);
  return listings;
}

// ===== 2DEHANDS PARSER =====
function parse2dehands(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  let m;

  const linkPattern = /href=["'](https?:\/\/www\.2dehands\.be\/v\/[^"']+)["']/gi;
  const links: string[] = [];
  while ((m = linkPattern.exec(html)) !== null) {
    if (!links.includes(m[1])) links.push(m[1]);
  }

  const imgPattern = /https:\/\/cdn\.2dehands\.(?:be|com)\/[^\s"']+\.(?:jpg|jpeg|webp)/gi;
  const images = [...new Set(html.match(imgPattern) || [])];

  const pricePattern = /€\s*([\d.,]+)|([\d.,]+)\s*€/g;
  const prices: number[] = [];
  while ((m = pricePattern.exec(markdown)) !== null) {
    const p = parsePrice(m[1] || m[2]);
    if (p && p >= 500 && p < 200000) prices.push(p);
  }

  const kmPattern = /([\d.,]+)\s*km/gi;
  const mileages: number[] = [];
  while ((m = kmPattern.exec(markdown)) !== null) {
    const km = parseMileage(m[1]);
    if (km) mileages.push(km);
  }

  const yearPattern = /\b(20[0-2]\d|199\d)\b/g;
  const years: number[] = [];
  while ((m = yearPattern.exec(markdown)) !== null) {
    const y = parseInt(m[1]);
    if (y >= 1990 && y <= new Date().getFullYear() + 1) years.push(y);
  }

  const count = Math.min(links.length, Math.max(prices.length, 3), 25);
  for (let i = 0; i < count; i++) {
    const price = prices[i];
    if (!price) continue;

    const idMatch = links[i]?.match(/\/(\d{8,})/);
    const externalId = idMatch ? `2dehands-${idMatch[1]}` : `2dehands-${Date.now()}-${i}`;

    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${years[i] || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: years[i] || new Date().getFullYear(),
      price,
      mileage: mileages[i] || null,
      fuel: null,
      transmission: null,
      location: null,
      country: 'Belgija',
      source: '2dehands',
      source_url: 'https://2dehands.be',
      listing_url: links[i] || null,
      image: images[i] || null,
    });
  }

  console.log(`2dehands: ${listings.length} listings`);
  return listings;
}

// ===== MARKTPLAATS PARSER =====
function parseMarktplaats(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  let m;

  const linkPattern = /href=["'](https?:\/\/www\.marktplaats\.nl\/v\/[^"']+)["']/gi;
  const links: string[] = [];
  while ((m = linkPattern.exec(html)) !== null) {
    if (!links.includes(m[1])) links.push(m[1]);
  }

  const imgPattern = /https?:\/\/[^\s"']*marktplaats[^\s"']*\.(?:jpg|jpeg|webp|png)/gi;
  const images = [...new Set(html.match(imgPattern) || [])];

  const pricePattern = /€\s*([\d.,]+)|([\d.,]+)\s*€/g;
  const prices: number[] = [];
  while ((m = pricePattern.exec(markdown)) !== null) {
    const p = parsePrice(m[1] || m[2]);
    if (p && p >= 500 && p < 200000) prices.push(p);
  }

  const kmPattern = /([\d.,]+)\s*km/gi;
  const mileages: number[] = [];
  while ((m = kmPattern.exec(markdown)) !== null) {
    const km = parseMileage(m[1]);
    if (km) mileages.push(km);
  }

  const yearPattern = /\b(20[0-2]\d|199\d)\b/g;
  const years: number[] = [];
  while ((m = yearPattern.exec(markdown)) !== null) {
    const y = parseInt(m[1]);
    if (y >= 1990 && y <= new Date().getFullYear() + 1) years.push(y);
  }

  const count = Math.min(links.length, Math.max(prices.length, 3), 25);
  for (let i = 0; i < count; i++) {
    const price = prices[i];
    if (!price) continue;

    const idMatch = links[i]?.match(/\/(\d{8,})/);
    const externalId = idMatch ? `marktplaats-${idMatch[1]}` : `marktplaats-${Date.now()}-${i}`;

    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${years[i] || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: years[i] || new Date().getFullYear(),
      price,
      mileage: mileages[i] || null,
      fuel: null,
      transmission: null,
      location: null,
      country: 'Olandija',
      source: 'Marktplaats',
      source_url: 'https://marktplaats.nl',
      listing_url: links[i] || null,
      image: images[i] || null,
    });
  }

  console.log(`Marktplaats: ${listings.length} listings`);
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
    name: 'Mobile.de',
    buildUrl: (brand, model, isAll) => {
      const b = encodeURIComponent(brand);
      const m = encodeURIComponent(model);
      return isAll
        ? `https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&ms=${b}&vc=Car`
        : `https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&ms=${b}%3B${m}&vc=Car`;
    },
    parser: parseMobileDe,
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
    name: '2dehands',
    buildUrl: (brand, model, isAll) => {
      const b = brand.toLowerCase();
      const m = model.toLowerCase();
      return isAll
        ? `https://www.2dehands.be/q/auto+${b}/`
        : `https://www.2dehands.be/q/auto+${b}+${m}/`;
    },
    parser: parse2dehands,
  },
  {
    name: 'Marktplaats',
    buildUrl: (brand, model, isAll) => {
      const b = brand.toLowerCase();
      const m = model.toLowerCase();
      return isAll
        ? `https://www.marktplaats.nl/q/auto+${b}/`
        : `https://www.marktplaats.nl/q/auto+${b}+${m}/`;
    },
    parser: parseMarktplaats,
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
        console.log(`\n--- ${source.name} ---`);

        const { markdown, html } = await scrapeUrl(firecrawlKey, url);

        if (markdown.length > 50 || html.length > 200) {
          const parsed = source.parser(markdown, html, brand, isAllModels ? '' : model);
          allListings.push(...parsed);
          sourceCounts[source.name] = parsed.length;
        } else {
          console.log(`${source.name}: no content`);
          sourceCounts[source.name] = 0;
        }

        // Rate limit pause
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        console.error(`${source.name} error:`, err);
        sourceCounts[source.name] = 0;
      }
    }

    console.log(`\n===== TOTAL: ${allListings.length} =====`);
    console.log('Sources:', JSON.stringify(sourceCounts));

    if (allListings.length > 0) {
      const { error } = await supabase
        .from('car_listings')
        .upsert(allListings, { onConflict: 'external_id,source' });

      if (error) console.error('DB error:', error);
      else console.log(`Saved ${allListings.length} to DB`);
    }

    let query = supabase
      .from('car_listings')
      .select('*')
      .ilike('brand', `%${brand}%`);

    if (!isAllModels) {
      query = query.ilike('model', `%${model}%`);
    }

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
