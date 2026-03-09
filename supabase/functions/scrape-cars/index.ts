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

// ===== NORMALIZATION HELPERS =====

function normalizeBrand(brand: string): string {
  const b = brand.toUpperCase().trim();
  if (b === 'VW' || b === 'VOLKSWAGON') return 'VOLKSWAGEN';
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
  if (f.includes('hybrid') || f.includes('hybr')) return 'Hibridas';
  if (f.includes('electric') || f.includes('elektr') || f.includes('ev') || f.includes('électr')) return 'Elektra';
  if (f.includes('lpg') || f.includes('gas') || f.includes('gpl')) return 'LPG';
  return fuel;
}

function normalizeTransmission(trans: string): string {
  if (!trans) return 'Automatinė';
  const t = trans.toLowerCase();
  if (t.includes('auto') || t.includes('tiptronic') || t.includes('dsg') || t.includes('cvt') || t.includes('steptronic')) return 'Automatinė';
  if (t.includes('manual') || t.includes('mechani') || t.includes('handschalt')) return 'Mechaninė';
  return trans;
}

function normalizeCountry(country: string): string {
  if (!country) return 'Europa';
  const c = country.toLowerCase();
  if (c.includes('germany') || c.includes('deutschland') || c.includes('vokietij') || c.includes('de')) return 'Vokietija';
  if (c.includes('belgium') || c.includes('belgi') || c.includes('belgique') || c.includes('be')) return 'Belgija';
  if (c.includes('france') || c.includes('pranc') || c.includes('fr')) return 'Prancūzija';
  if (c.includes('netherlands') || c.includes('olandij') || c.includes('holland') || c.includes('nl') || c.includes('nederland')) return 'Olandija';
  if (c.includes('austria') || c.includes('österreich') || c.includes('austrij') || c.includes('at')) return 'Austrija';
  if (c.includes('italy') || c.includes('italia') || c.includes('italij') || c.includes('it')) return 'Italija';
  if (c.includes('spain') || c.includes('españa') || c.includes('ispanij') || c.includes('es')) return 'Ispanija';
  if (c.includes('poland') || c.includes('polska') || c.includes('lenkij') || c.includes('pl')) return 'Lenkija';
  if (c.includes('lithuania') || c.includes('lietuv') || c.includes('lt')) return 'Lietuva';
  if (c.includes('czech') || c.includes('čekij') || c.includes('cz')) return 'Čekija';
  if (c.includes('sweden') || c.includes('švedij') || c.includes('se')) return 'Švedija';
  if (c.includes('switzerland') || c.includes('šveicarij') || c.includes('ch') || c.includes('schweiz')) return 'Šveicarija';
  if (c.includes('latvia') || c.includes('latvij') || c.includes('lv')) return 'Latvija';
  if (c.includes('denmark') || c.includes('danij') || c.includes('dk')) return 'Danija';
  return 'Europa';
}

function parsePrice(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^\d.,]/g, '').replace(',', '.');
  // Handle cases like 12.500 (European format = 12500)
  if (cleaned.match(/^\d{1,3}\.\d{3}$/)) {
    return parseInt(cleaned.replace('.', ''));
  }
  const num = parseInt(cleaned.replace(/\./g, ''));
  return isNaN(num) ? null : (num > 0 && num < 500000 ? num : null);
}

function parseMileage(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^\d.,]/g, '').replace(',', '.');
  if (cleaned.match(/^\d{1,3}\.\d{3}$/)) {
    return parseInt(cleaned.replace('.', ''));
  }
  const num = parseInt(cleaned.replace(/\./g, ''));
  return isNaN(num) ? null : (num > 100 && num < 1000000 ? num : null);
}

function parseYear(str: string): number | null {
  if (!str) return null;
  const match = str.match(/(19|20)\d{2}/);
  if (match) {
    const y = parseInt(match[0]);
    return (y >= 1990 && y <= new Date().getFullYear() + 1) ? y : null;
  }
  return null;
}

// ===== FIRECRAWL SCRAPER =====

async function scrapeWithFirecrawl(firecrawlKey: string, url: string): Promise<{ markdown: string; html: string }> {
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
      console.error(`Firecrawl HTTP ${response.status}: ${err}`);
      return { markdown: '', html: '' };
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.rawHtml || data.data?.html || data.rawHtml || data.html || '';

    if (markdown.toLowerCase().includes('access denied') ||
        markdown.toLowerCase().includes('captcha') ||
        html.includes('Zugriff verweigert')) {
      console.log('Request was blocked');
      return { markdown: '', html: '' };
    }

    console.log(`Got ${markdown.length} chars markdown, ${html.length} chars HTML`);
    return { markdown, html };
  } catch (error) {
    console.error('Firecrawl error:', error);
    return { markdown: '', html: '' };
  }
}

// ===== SOURCE PARSERS =====

// AutoScout24 - largest EU car marketplace
function parseAutoScout24(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  
  // Extract detail links from HTML
  const linkPattern = /href=["'](https?:\/\/www\.autoscout24\.[a-z]+\/aanbod\/[^"']+|\/aanbod\/[^"']+)["']/gi;
  const links: string[] = [];
  let m;
  while ((m = linkPattern.exec(html)) !== null) {
    let url = m[1];
    if (url.startsWith('/')) url = 'https://www.autoscout24.com' + url;
    if (!links.includes(url)) links.push(url);
  }
  
  // Also try /offers/ pattern
  const linkPattern2 = /href=["'](https?:\/\/www\.autoscout24\.[a-z]+\/offers\/[^"']+|\/offers\/[^"']+)["']/gi;
  while ((m = linkPattern2.exec(html)) !== null) {
    let url = m[1];
    if (url.startsWith('/')) url = 'https://www.autoscout24.com' + url;
    if (!links.includes(url)) links.push(url);
  }

  // Extract images
  const imgPattern = /https:\/\/prod\.pictures\.autoscout24\.net\/listing-images\/[^\s"']+\.(?:jpg|jpeg|webp|png)/gi;
  const images = [...new Set(html.match(imgPattern) || [])];
  
  // Parse markdown for listing data
  // AutoScout24 markdown typically has listings with price, km, year in structured format
  const pricePattern = /€\s*([\d.,]+)/g;
  const prices: number[] = [];
  while ((m = pricePattern.exec(markdown)) !== null) {
    const p = parsePrice(m[1]);
    if (p && p >= 500 && p < 200000) prices.push(p);
  }
  
  const kmPattern = /([\d.,]+)\s*km/gi;
  const mileages: number[] = [];
  while ((m = kmPattern.exec(markdown)) !== null) {
    const km = parseMileage(m[1]);
    if (km) mileages.push(km);
  }
  
  const yearPattern = /\b(20[0-2]\d|19[9]\d)\b/g;
  const years: number[] = [];
  while ((m = yearPattern.exec(markdown)) !== null) {
    const y = parseInt(m[1]);
    if (y >= 1990 && y <= new Date().getFullYear() + 1) years.push(y);
  }
  
  // Fuel types
  const fuelPattern = /\b(Diesel|Benzin|Petrol|Hybrid|Electric|Elektro|LPG|CNG|Plug-in)\b/gi;
  const fuels = markdown.match(fuelPattern) || [];
  
  // Transmissions
  const transPattern = /\b(Automatic|Manual|Automatik|Schaltgetriebe|Tiptronic|DSG|CVT|Automatisch|Handgeschakeld)\b/gi;
  const transmissions = markdown.match(transPattern) || [];
  
  const count = Math.min(links.length, Math.max(prices.length, 5), 30);
  
  for (let i = 0; i < count; i++) {
    const url = links[i];
    if (!url) continue;
    
    const idMatch = url.match(/\/([a-f0-9-]{20,})/) || url.match(/\/(\d{10,})/);
    const externalId = idMatch ? `as24-${idMatch[1].slice(0, 20)}` : `as24-${Date.now()}-${i}`;
    
    const price = prices[i];
    if (!price || price < 500) continue;
    
    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${years[i] || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: years[i] || new Date().getFullYear(),
      price,
      mileage: mileages[i] || null,
      fuel: fuels[i] ? normalizeFuel(fuels[i]) : null,
      transmission: transmissions[i] ? normalizeTransmission(transmissions[i]) : 'Automatinė',
      location: null,
      country: 'Europa',
      source: 'AutoScout24',
      source_url: 'https://autoscout24.com',
      listing_url: url,
      image: images[i] || null,
    });
  }
  
  console.log(`AutoScout24: parsed ${listings.length} listings`);
  return listings;
}

// Mobile.de - Germany's largest
function parseMobileDe(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  
  // Detail links
  const linkPattern = /href=["'](https?:\/\/suchen\.mobile\.de\/fahrzeuge\/details[^"']+|\/fahrzeuge\/details[^"']+)["']/gi;
  const links: string[] = [];
  let m;
  while ((m = linkPattern.exec(html)) !== null) {
    let url = m[1];
    if (url.startsWith('/')) url = 'https://suchen.mobile.de' + url;
    if (!links.includes(url)) links.push(url);
  }
  
  // Also try /auto/ links
  const linkPattern2 = /href=["'](https?:\/\/www\.mobile\.de\/auto-inserat\/[^"']+)["']/gi;
  while ((m = linkPattern2.exec(html)) !== null) {
    if (!links.includes(m[1])) links.push(m[1]);
  }
  
  // Images
  const imgPattern = /https:\/\/img\.classistatic\.de\/[^\s"']+\.(?:jpg|jpeg|webp|png)/gi;
  const images = [...new Set(html.match(imgPattern) || [])];
  
  // Parse prices (€ format)
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
  
  const fuelPattern = /\b(Diesel|Benzin|Hybrid|Elektro|LPG|CNG|Plug-in)\b/gi;
  const fuels = markdown.match(fuelPattern) || [];
  
  const transPattern = /\b(Automatik|Schaltgetriebe|Automatic|Manual)\b/gi;
  const transmissions = markdown.match(transPattern) || [];
  
  const count = Math.min(links.length, Math.max(prices.length, 5), 30);
  
  for (let i = 0; i < count; i++) {
    const url = links[i];
    if (!url) continue;
    
    const idMatch = url.match(/(\d{8,})/);
    const externalId = idMatch ? `mobile-${idMatch[1]}` : `mobile-${Date.now()}-${i}`;
    
    const price = prices[i];
    if (!price || price < 500) continue;
    
    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${years[i] || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: years[i] || new Date().getFullYear(),
      price,
      mileage: mileages[i] || null,
      fuel: fuels[i] ? normalizeFuel(fuels[i]) : null,
      transmission: transmissions[i] ? normalizeTransmission(transmissions[i]) : 'Automatinė',
      location: null,
      country: 'Vokietija',
      source: 'Mobile.de',
      source_url: 'https://mobile.de',
      listing_url: url,
      image: images[i] || null,
    });
  }
  
  console.log(`Mobile.de: parsed ${listings.length} listings`);
  return listings;
}

// Schadeautos.nl - Dutch damaged cars
function parseSchadeautos(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  
  const linkPattern = /href=["'](\/en\/car\/\d+)["']/gi;
  const links: string[] = [];
  let m;
  while ((m = linkPattern.exec(html)) !== null) {
    const url = `https://www.schadeautos.nl${m[1]}`;
    if (!links.includes(url)) links.push(url);
  }
  
  // Images
  const imgPattern = /https:\/\/www\.schadeautos\.nl\/cache\/picture\/[^\s"']+\.jpg/gi;
  const images = [...new Set((html.match(imgPattern) || []).map(img => 
    img.replace(/\/\d+\/([a-f0-9]+)/, '/1200/$1')
  ))];
  
  const pricePattern = /€\s*([\d.,]+)|([\d.,]+)\s*€/g;
  const prices: number[] = [];
  while ((m = pricePattern.exec(markdown)) !== null) {
    const p = parsePrice(m[1] || m[2]);
    if (p && p >= 300 && p < 100000) prices.push(p);
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
    const url = links[i];
    if (!url) continue;
    
    const idMatch = url.match(/\/car\/(\d+)/);
    const externalId = idMatch ? `schadeautos-${idMatch[1]}` : `schadeautos-${Date.now()}-${i}`;
    
    const price = prices[i];
    if (!price) continue;
    
    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${years[i] || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: years[i] || new Date().getFullYear(),
      price,
      mileage: mileages[i] || null,
      fuel: fuels[i] ? normalizeFuel(fuels[i]) : null,
      transmission: 'Automatinė',
      location: 'Olandija',
      country: 'Olandija',
      source: 'Schadeautos',
      source_url: 'https://schadeautos.nl',
      listing_url: url,
      image: images[i] || null,
    });
  }
  
  console.log(`Schadeautos: parsed ${listings.length} listings`);
  return listings;
}

// Otomoto.pl - Poland
function parseOtomoto(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  
  const linkPattern = /href=["'](https?:\/\/www\.otomoto\.pl\/osobowe\/oferta\/[^"']+)["']/gi;
  const links: string[] = [];
  let m;
  while ((m = linkPattern.exec(html)) !== null) {
    if (!links.includes(m[1])) links.push(m[1]);
  }
  
  const imgPattern = /https:\/\/ireland\.apollo\.olxcdn\.com\/[^\s"']+\.(?:jpg|jpeg|webp)/gi;
  const images = [...new Set(html.match(imgPattern) || [])];
  
  // Otomoto prices in PLN - convert approx to EUR (1 EUR ≈ 4.3 PLN)
  const pricePatternPLN = /([\d\s.,]+)\s*(?:PLN|zł)/gi;
  const pricePatternEUR = /€\s*([\d.,]+)|([\d.,]+)\s*€|([\d\s.,]+)\s*EUR/gi;
  const prices: number[] = [];
  
  while ((m = pricePatternEUR.exec(markdown)) !== null) {
    const p = parsePrice(m[1] || m[2] || m[3]);
    if (p && p >= 500 && p < 200000) prices.push(p);
  }
  
  if (prices.length === 0) {
    while ((m = pricePatternPLN.exec(markdown)) !== null) {
      const p = parsePrice(m[1]);
      if (p && p >= 2000) prices.push(Math.round(p / 4.3));
    }
  }
  
  const kmPattern = /([\d\s.,]+)\s*km/gi;
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
  
  const fuelPattern = /\b(Diesel|Benzyna|Petrol|Hybrid|Elektryczny|LPG|CNG)\b/gi;
  const fuels = markdown.match(fuelPattern) || [];
  
  const count = Math.min(links.length, Math.max(prices.length, 5), 25);
  
  for (let i = 0; i < count; i++) {
    const url = links[i];
    if (!url) continue;
    
    const idMatch = url.match(/-ID([a-zA-Z0-9]+)\.html/) || url.match(/oferta\/([^/]+)/);
    const externalId = idMatch ? `otomoto-${idMatch[1].slice(0, 20)}` : `otomoto-${Date.now()}-${i}`;
    
    const price = prices[i];
    if (!price || price < 300) continue;
    
    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${years[i] || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: years[i] || new Date().getFullYear(),
      price,
      mileage: mileages[i] || null,
      fuel: fuels[i] ? normalizeFuel(fuels[i]) : null,
      transmission: 'Automatinė',
      location: null,
      country: 'Lenkija',
      source: 'Otomoto',
      source_url: 'https://otomoto.pl',
      listing_url: url,
      image: images[i] || null,
    });
  }
  
  console.log(`Otomoto: parsed ${listings.length} listings`);
  return listings;
}

// 2dehands.be / 2ememain.be - Belgium
function parse2dehands(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  
  const linkPattern = /href=["'](https?:\/\/www\.2dehands\.be\/[av]\/[^"']+)["']/gi;
  const links: string[] = [];
  let m;
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
  
  const fuelPattern = /\b(Diesel|Benzine|Petrol|Hybrid|Elektrisch|LPG|CNG)\b/gi;
  const fuels = markdown.match(fuelPattern) || [];
  
  const count = Math.min(links.length, Math.max(prices.length, 5), 25);
  
  for (let i = 0; i < count; i++) {
    const url = links[i];
    if (!url) continue;
    
    const idMatch = url.match(/[av]\/[^/]+\/(\d+)/);
    const externalId = idMatch ? `2dehands-${idMatch[1]}` : `2dehands-${Date.now()}-${i}`;
    
    const price = prices[i];
    if (!price || price < 300) continue;
    
    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${years[i] || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: years[i] || new Date().getFullYear(),
      price,
      mileage: mileages[i] || null,
      fuel: fuels[i] ? normalizeFuel(fuels[i]) : null,
      transmission: 'Automatinė',
      location: null,
      country: 'Belgija',
      source: '2dehands',
      source_url: 'https://2dehands.be',
      listing_url: url,
      image: images[i] || null,
    });
  }
  
  console.log(`2dehands: parsed ${listings.length} listings`);
  return listings;
}

// Marktplaats.nl - Netherlands
function parseMarktplaats(markdown: string, html: string, brand: string, model: string): CarListing[] {
  const listings: CarListing[] = [];
  
  const linkPattern = /href=["'](https?:\/\/www\.marktplaats\.nl\/v\/[^"']+)["']/gi;
  const links: string[] = [];
  let m;
  while ((m = linkPattern.exec(html)) !== null) {
    if (!links.includes(m[1])) links.push(m[1]);
  }
  
  const imgPattern = /https:\/\/cdn\.marktplaats\.(?:nl|com)\/[^\s"']+\.(?:jpg|jpeg|webp)/gi;
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
  
  const fuelPattern = /\b(Diesel|Benzine|Petrol|Hybrid|Elektrisch|LPG)\b/gi;
  const fuels = markdown.match(fuelPattern) || [];
  
  const count = Math.min(links.length, Math.max(prices.length, 5), 25);
  
  for (let i = 0; i < count; i++) {
    const url = links[i];
    if (!url) continue;
    
    const idMatch = url.match(/\/(\d{8,})/);
    const externalId = idMatch ? `marktplaats-${idMatch[1]}` : `marktplaats-${Date.now()}-${i}`;
    
    const price = prices[i];
    if (!price || price < 300) continue;
    
    listings.push({
      external_id: externalId,
      title: `${brand} ${model || ''} ${years[i] || ''}`.trim(),
      brand: normalizeBrand(brand),
      model: model || '',
      year: years[i] || new Date().getFullYear(),
      price,
      mileage: mileages[i] || null,
      fuel: fuels[i] ? normalizeFuel(fuels[i]) : null,
      transmission: 'Automatinė',
      location: null,
      country: 'Olandija',
      source: 'Marktplaats',
      source_url: 'https://marktplaats.nl',
      listing_url: url,
      image: images[i] || null,
    });
  }
  
  console.log(`Marktplaats: parsed ${listings.length} listings`);
  return listings;
}

// ===== SOURCE URL BUILDERS =====

interface SourceConfig {
  name: string;
  buildUrl: (brand: string, model: string, isAllModels: boolean) => string;
  parser: (markdown: string, html: string, brand: string, model: string) => CarListing[];
}

const SOURCES: SourceConfig[] = [
  {
    name: 'AutoScout24',
    buildUrl: (brand, model, isAll) => {
      const b = brand.toLowerCase().replace(/\s+/g, '-');
      const m = model.toLowerCase().replace(/\s+/g, '-');
      return isAll
        ? `https://www.autoscout24.com/lst/${b}?sort=standard&desc=0&atype=C&cy=D%2CA%2CB%2CF%2CI%2CL%2CNL&ustate=N%2CU&size=20&page=1`
        : `https://www.autoscout24.com/lst/${b}/${m}?sort=standard&desc=0&atype=C&cy=D%2CA%2CB%2CF%2CI%2CL%2CNL&ustate=N%2CU&size=20&page=1`;
    },
    parser: parseAutoScout24,
  },
  {
    name: 'Mobile.de',
    buildUrl: (brand, model, isAll) => {
      const b = encodeURIComponent(brand);
      const m = encodeURIComponent(model);
      return isAll
        ? `https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&ms=${b}&ref=quickSearch&sfmr=false&vc=Car`
        : `https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&ms=${b}%3B${m}&ref=quickSearch&sfmr=false&vc=Car`;
    },
    parser: parseMobileDe,
  },
  {
    name: 'Schadeautos',
    buildUrl: (brand, model, isAll) => {
      const b = brand.toLowerCase();
      return isAll
        ? `https://www.schadeautos.nl/en/cars?make=${b}`
        : `https://www.schadeautos.nl/en/cars?make=${b}&model=${model.toLowerCase()}`;
    },
    parser: parseSchadeautos,
  },
  {
    name: 'Otomoto',
    buildUrl: (brand, model, isAll) => {
      const b = brand.toLowerCase().replace(/\s+/g, '-');
      const m = model.toLowerCase().replace(/\s+/g, '-');
      return isAll
        ? `https://www.otomoto.pl/osobowe/${b}?search%5Bfilter_enum_damaged%5D=0&search%5Border%5D=created_at_first%3Adesc`
        : `https://www.otomoto.pl/osobowe/${b}/${m}?search%5Bfilter_enum_damaged%5D=0&search%5Border%5D=created_at_first%3Adesc`;
    },
    parser: parseOtomoto,
  },
  {
    name: '2dehands',
    buildUrl: (brand, model, isAll) => {
      const b = brand.toLowerCase().replace(/\s+/g, '-');
      const m = model.toLowerCase().replace(/\s+/g, '-');
      return isAll
        ? `https://www.2dehands.be/q/auto+${b}/`
        : `https://www.2dehands.be/q/auto+${b}+${m}/`;
    },
    parser: parse2dehands,
  },
  {
    name: 'Marktplaats',
    buildUrl: (brand, model, isAll) => {
      const b = brand.toLowerCase().replace(/\s+/g, '+');
      const m = model.toLowerCase().replace(/\s+/g, '+');
      return isAll
        ? `https://www.marktplaats.nl/l/auto-s/q/${b}/`
        : `https://www.marktplaats.nl/l/auto-s/q/${b}+${m}/`;
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

    // No brand = return cached
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

    console.log(`\n===== SCRAPING ${brand} ${isAllModels ? '(all models)' : model} =====`);
    console.log(`Sources: ${SOURCES.map(s => s.name).join(', ')}\n`);

    // Scrape all sources sequentially with delay
    for (const source of SOURCES) {
      try {
        const url = source.buildUrl(brand, model, isAllModels);
        console.log(`\n--- ${source.name} ---`);
        
        const { markdown, html } = await scrapeWithFirecrawl(firecrawlKey, url);
        
        if (markdown.length > 100 || html.length > 500) {
          const parsed = source.parser(markdown, html, brand, isAllModels ? '' : model);
          allListings.push(...parsed);
          sourceCounts[source.name] = parsed.length;
        } else {
          console.log(`${source.name}: insufficient content received`);
          sourceCounts[source.name] = 0;
        }
        
        // Rate limit delay between sources
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (err) {
        console.error(`${source.name} error:`, err);
        sourceCounts[source.name] = 0;
      }
    }

    console.log(`\n===== TOTAL: ${allListings.length} listings =====`);
    console.log('Source breakdown:', JSON.stringify(sourceCounts));

    // Upsert to database
    if (allListings.length > 0) {
      const { error: upsertError } = await supabase
        .from('car_listings')
        .upsert(allListings, { onConflict: 'external_id,source' });

      if (upsertError) {
        console.error('DB upsert error:', upsertError);
      } else {
        console.log(`Saved ${allListings.length} listings to DB`);
      }
    }

    // Return fresh from DB
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
