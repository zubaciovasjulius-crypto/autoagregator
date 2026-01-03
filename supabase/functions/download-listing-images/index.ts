const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapedData {
  images: string[];
  details: {
    brand?: string;
    model?: string;
    year?: string;
    mileage?: string;
    price?: string;
    title?: string;
    fuel?: string;
    country?: string;
  };
}

// Known car brands for extraction
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

function parseNumber(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^\d]/g, '');
  const num = parseInt(cleaned);
  return isNaN(num) ? null : num;
}

function extractBrandFromTitle(title: string): { brand: string; model: string } | null {
  const upperTitle = title.toUpperCase();
  
  for (const brand of CAR_BRANDS) {
    if (upperTitle.includes(brand)) {
      const brandIndex = upperTitle.indexOf(brand);
      const afterBrand = title.substring(brandIndex + brand.length).trim();
      // Extract model - first word/phrase after brand
      const modelMatch = afterBrand.match(/^[\s-]*([A-Za-z0-9][\w\s-]{0,15}?)(?:\s+\d|\s+-|$|\s+20)/i);
      const model = modelMatch ? modelMatch[1].trim() : afterBrand.split(/\s+/)[0] || '';
      
      return {
        brand: brand === 'VW' ? 'VOLKSWAGEN' : brand,
        model: model.toUpperCase()
      };
    }
  }
  
  return null;
}

function detectSource(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('theparking') || urlLower.includes('leparking')) return 'theparking';
  if (urlLower.includes('mobile.de')) return 'mobile.de';
  if (urlLower.includes('schadeautos.nl')) return 'schadeautos';
  if (urlLower.includes('2dehands') || urlLower.includes('2ememain')) return '2dehands';
  if (urlLower.includes('kleinanzeigen')) return 'kleinanzeigen';
  if (urlLower.includes('gaspedaal.nl')) return 'gaspedaal';
  if (urlLower.includes('marktplaats.nl')) return 'marktplaats';
  if (urlLower.includes('autoscout24')) return 'autoscout24';
  return 'generic';
}

// ===== DETAILS EXTRACTION =====
function extractDetails(html: string, url: string): ScrapedData['details'] {
  const details: ScrapedData['details'] = {};
  const source = detectSource(url);
  
  console.log(`Extracting details for source: ${source}`);
  
  // === TITLE EXTRACTION ===
  // Priority: h1 > title tag > og:title (og:title is often generic share text)
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  
  let rawTitle = h1Match?.[1] || titleTagMatch?.[1] || ogTitleMatch?.[1] || '';
  
  // For TheParking, try to extract from URL if title is generic
  if (source === 'theparking' && rawTitle) {
    const badTitles = ['theparking', 'i found', 'isn\'t it great', 'access denied', 'zugriff'];
    if (badTitles.some(bad => rawTitle.toLowerCase().includes(bad))) {
      // Extract from URL pattern: /used-cars-detail/brand-model/...
      const urlMatch = url.match(/used-cars-detail\/([^\/]+)\//i);
      if (urlMatch) {
        rawTitle = urlMatch[1].replace(/-/g, ' ');
      }
    }
  }
  
  // Clean title
  details.title = rawTitle
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&euro;/gi, '€')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log(`Extracted title: ${details.title}`);
  
  // === BRAND & MODEL FROM TITLE ===
  if (details.title) {
    const brandModel = extractBrandFromTitle(details.title);
    if (brandModel) {
      details.brand = brandModel.brand;
      details.model = brandModel.model;
      console.log(`Extracted brand/model: ${details.brand} ${details.model}`);
    }
  }
  
  // === YEAR EXTRACTION ===
  // Look for year in specific patterns first
  const yearPatterns = [
    // German patterns
    /(?:Erstzulassung|EZ)[:\s]*(?:\d{2}\/)?(\d{4})/i,
    /Baujahr[:\s]*(\d{4})/i,
    // Dutch patterns
    /Bouwjaar[:\s]*(\d{4})/i,
    // Generic patterns
    /["']?year["']?\s*[:=]\s*["']?(\d{4})["']?/i,
    /(\d{4})\s*(?:m\.|metai|jaar|year|bj)/i,
    // JSON-LD
    /"modelYear"\s*:\s*["']?(\d{4})["']?/i,
    /"vehicleModelDate"\s*:\s*["']?(\d{4})["']?/i,
  ];
  
  for (const pattern of yearPatterns) {
    const match = html.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      if (year >= 1995 && year <= 2026) {
        details.year = year.toString();
        console.log(`Extracted year: ${details.year}`);
        break;
      }
    }
  }
  
  // Fallback: find most common 4-digit year in valid range
  if (!details.year) {
    const allYears = html.match(/\b(20[0-2]\d)\b/g) || [];
    const yearCounts: Record<string, number> = {};
    for (const y of allYears) {
      const yr = parseInt(y);
      if (yr >= 2000 && yr <= 2025) {
        yearCounts[y] = (yearCounts[y] || 0) + 1;
      }
    }
    const sortedYears = Object.entries(yearCounts).sort((a, b) => b[1] - a[1]);
    if (sortedYears.length > 0) {
      details.year = sortedYears[0][0];
      console.log(`Extracted year (fallback): ${details.year}`);
    }
  }
  
  // === MILEAGE EXTRACTION ===
  // TheParking specific: <span>Kilometer</span><span>112,000</span>
  if (source === 'theparking') {
    const theParkingMileage = html.match(/<span[^>]*>(?:Kilometer|Kilometerstand|km)[^<]*<\/span>\s*<span[^>]*>([\d,.\s]+)<\/span>/i);
    if (theParkingMileage) {
      const km = parseNumber(theParkingMileage[1]);
      if (km && km >= 100 && km < 1000000) {
        details.mileage = km.toString();
        console.log(`Extracted mileage (TheParking): ${details.mileage}`);
      }
    }
  }
  
  // Generic mileage patterns
  if (!details.mileage) {
    const mileagePatterns = [
      // Label: value patterns
      /(?:Kilometerstand|Kilometer|Mileage|km|rida)[:\s]*([\d.,\s]+)\s*(?:km)?/i,
      // Value km patterns
      /(\d{1,3}[.,\s]?\d{3})\s*km\b/i,
      // JSON patterns
      /"mileageFromOdometer"\s*:\s*["']?([\d.,]+)["']?/i,
      /"mileage"\s*:\s*["']?([\d.,]+)["']?/i,
    ];
    
    for (const pattern of mileagePatterns) {
      const match = html.match(pattern);
      if (match) {
        const km = parseNumber(match[1]);
        if (km && km >= 100 && km < 1000000) {
          details.mileage = km.toString();
          console.log(`Extracted mileage: ${details.mileage}`);
          break;
        }
      }
    }
  }
  
  // === PRICE EXTRACTION ===
  const pricePatterns = [
    // JSON patterns (most reliable)
    /"price"\s*:\s*["']?([\d.,]+)["']?/i,
    /"offers"\s*:\s*\{[^}]*"price"\s*:\s*["']?([\d.,]+)["']?/i,
    // Euro formats
    /€\s*([\d.,\s]+)/,
    /([\d.,\s]+)\s*€/,
    /EUR\s*([\d.,\s]+)/i,
    // Price labels
    /(?:prix|preis|prijs|price|kaina)[:\s]*([\d.,\s]+)\s*€?/i,
  ];
  
  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (match) {
      const price = parseNumber(match[1]);
      if (price && price >= 500 && price < 500000) {
        details.price = price.toString();
        console.log(`Extracted price: ${details.price}`);
        break;
      }
    }
  }
  
  // === FUEL EXTRACTION ===
  const fuelPatterns = [
    /"fuelType"\s*:\s*["']([^"']+)["']/i,
    /(?:Fuel|Kraftstoff|Brandstof|Kuras)[:\s]*([A-Za-z]+)/i,
    /\b(Diesel|Petrol|Benzin|Hybrid|Electric|Elektro|LPG)\b/i,
  ];
  
  for (const pattern of fuelPatterns) {
    const match = html.match(pattern);
    if (match) {
      details.fuel = match[1];
      console.log(`Extracted fuel: ${details.fuel}`);
      break;
    }
  }
  
  // === COUNTRY EXTRACTION ===
  const countryPatterns = [
    /\b(Germany|Deutschland|Vokietija)\b/i,
    /\b(Belgium|Belgique|België|Belgija)\b/i,
    /\b(France|Prancūzija)\b/i,
    /\b(Netherlands|Nederland|Holland|Olandija)\b/i,
    /\b(Austria|Österreich)\b/i,
    /\b(Italy|Italia|Italija)\b/i,
    /\b(Spain|España|Ispanija)\b/i,
  ];
  
  for (const pattern of countryPatterns) {
    const match = html.match(pattern);
    if (match) {
      details.country = match[1];
      console.log(`Extracted country: ${details.country}`);
      break;
    }
  }
  
  return details;
}

// ===== IMAGE EXTRACTION =====
function extractImages(html: string, url: string): string[] {
  const source = detectSource(url);
  const images: string[] = [];
  
  console.log(`Extracting images for source: ${source}`);
  
  // Source-specific extraction with high-quality URLs
  switch (source) {
    case 'theparking':
      // TheParking uses cloud.leparking.fr - extract LARGEST versions
      // Pattern: /XXX/YYY/ZZZ.jpg where XXX is width
      const theParkingPattern = /https:\/\/cloud\.leparking\.fr\/\d+\/\d+\/\d+\/[a-f0-9]+_\d+\.(?:jpg|jpeg|png|webp)/gi;
      const theParkingMatches = html.match(theParkingPattern) || [];
      
      // Convert to maximum resolution (2160 is max available)
      for (const img of theParkingMatches) {
        const highRes = img.replace(/\/\d+\/(\d+\/\d+\/[a-f0-9]+_\d+\.)/, '/2160/$1');
        images.push(highRes);
      }
      
      // Also try scalethumb pattern
      const scalethumbPattern = /https:\/\/scalethumb\.leparking\.fr\/unsafe\/\d+x\d+\/[^"'\s)>]+/gi;
      const scalethumbMatches = html.match(scalethumbPattern) || [];
      for (const img of scalethumbMatches) {
        // Convert to larger size (max 1920x1440)
        const highRes = img.replace(/\/unsafe\/\d+x\d+\//, '/unsafe/1920x1440/');
        images.push(highRes);
      }
      
      // Direct cloud URLs without dimensions
      const cloudPattern = /https:\/\/cloud\.leparking\.fr\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi;
      images.push(...(html.match(cloudPattern) || []));
      break;
      
    case 'schadeautos':
      // Schadeautos uses /cache/picture/WIDTH/ID/hash.jpg
      // Extract all cache picture URLs and convert to max resolution (1200)
      const schadePattern = /https:\/\/www\.schadeautos\.nl\/cache\/picture\/\d+\/\d+\/[a-f0-9]+(?:~v\d+)?\.(?:jpg|jpeg|png)/gi;
      const schadeMatches = html.match(schadePattern) || [];
      
      const highResSet = new Set<string>();
      for (const img of schadeMatches) {
        // Convert to 1200px width for best quality
        const highRes = img.replace(/\/cache\/picture\/\d+\//, '/cache/picture/1200/');
        highResSet.add(highRes);
      }
      images.push(...Array.from(highResSet));
      
      // Also try direct image URLs
      const directSchadePattern = /https:\/\/www\.schadeautos\.nl\/[^"'\s]+\/pictures\/[^"'\s]+\.(?:jpg|jpeg|png)/gi;
      images.push(...(html.match(directSchadePattern) || []));
      break;
      
    case 'mobile.de':
      // Mobile.de uses various CDN patterns
      const mobilePatterns = [
        /https:\/\/[a-z0-9.-]+\.ebayimg\.com\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
        /https:\/\/[a-z0-9.-]+\.classistatic\.de\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
        /https:\/\/img\.mobile\.de\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
      ];
      for (const pattern of mobilePatterns) {
        const matches = html.match(pattern) || [];
        // Convert to high-res versions
        for (const img of matches) {
          const highRes = img
            .replace(/\$_\d+/, '$_86') // eBay high-res suffix
            .replace(/\/\d+x\d+\//, '/1200x900/');
          images.push(highRes);
        }
      }
      break;
      
    case 'autoscout24':
      // AutoScout24 patterns
      const as24Patterns = [
        /https:\/\/[a-z0-9.-]+\.autoscout24\.net\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
        /https:\/\/[a-z0-9.-]+\.autoscout24\.com\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
      ];
      for (const pattern of as24Patterns) {
        const matches = html.match(pattern) || [];
        for (const img of matches) {
          // Convert to high-res version
          const highRes = img.replace(/\/\d+x\d+\//, '/1200x900/');
          images.push(highRes);
        }
      }
      break;
      
    case '2dehands':
    case 'marktplaats':
      const mpPatterns = [
        /https:\/\/[a-z0-9.-]+cdn[a-z0-9.-]*\.2dehands\.be\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
        /https:\/\/[a-z0-9.-]+cdn[a-z0-9.-]*\.marktplaats\.nl\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
        /https:\/\/images\.lbthumbs\.(?:be|nl)\/[^"'\s)>]+/gi,
      ];
      for (const pattern of mpPatterns) {
        images.push(...(html.match(pattern) || []));
      }
      break;
      
    case 'kleinanzeigen':
      const kaPatterns = [
        /https:\/\/[a-z0-9.-]+\.ebayimg\.com\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
        /https:\/\/[a-z0-9.-]+\.classistatic\.de\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
      ];
      for (const pattern of kaPatterns) {
        const matches = html.match(pattern) || [];
        for (const img of matches) {
          const highRes = img.replace(/\$_\d+/, '$_86');
          images.push(highRes);
        }
      }
      break;
      
    case 'gaspedaal':
      const gpPatterns = [
        /https:\/\/[a-z0-9.-]+\.gaspedaal\.nl\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
      ];
      for (const pattern of gpPatterns) {
        images.push(...(html.match(pattern) || []));
      }
      break;
  }
  
  // Extract from JSON-LD (structured data - usually has high-quality URLs)
  const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonMatch;
  while ((jsonMatch = jsonLdPattern.exec(html)) !== null) {
    try {
      const json = JSON.parse(jsonMatch[1]);
      const extractFromObj = (obj: unknown): void => {
        if (typeof obj === 'string' && /^https?:\/\/.+\.(jpg|jpeg|png|webp)/i.test(obj)) {
          images.push(obj);
        } else if (Array.isArray(obj)) {
          obj.forEach(extractFromObj);
        } else if (obj && typeof obj === 'object') {
          const record = obj as Record<string, unknown>;
          if (record.image) extractFromObj(record.image);
          if (record.photo) extractFromObj(record.photo);
          if (record.contentUrl) extractFromObj(record.contentUrl);
          if (record.thumbnailUrl) extractFromObj(record.thumbnailUrl);
        }
      };
      extractFromObj(json);
    } catch {
      // Ignore JSON parse errors
    }
  }
  
  // Extract from og:image and twitter:image (usually high-quality)
  const ogImagePattern = /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)[^>]+content=["']([^"']+)["']/gi;
  while ((jsonMatch = ogImagePattern.exec(html)) !== null) {
    if (jsonMatch[1] && /\.(jpg|jpeg|png|webp)/i.test(jsonMatch[1])) {
      images.push(jsonMatch[1]);
    }
  }
  
  // Extract from data-src, data-original, data-zoom (lazy loading - often high-res)
  const dataSrcPatterns = [
    /data-(?:src|original|zoom|full|high-res|large)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
    /data-srcset=["']([^"']+)["']/gi,
  ];
  for (const pattern of dataSrcPatterns) {
    while ((jsonMatch = pattern.exec(html)) !== null) {
      // For srcset, take the largest image
      if (jsonMatch[0].includes('srcset')) {
        const srcset = jsonMatch[1].split(',');
        for (const src of srcset) {
          const parts = src.trim().split(/\s+/);
          if (parts[0] && /^https?:\/\/.+\.(jpg|jpeg|png|webp)/i.test(parts[0])) {
            images.push(parts[0]);
          }
        }
      } else {
        images.push(jsonMatch[1]);
      }
    }
  }
  
  // Extract from regular img src (fallback)
  const imgSrcPattern = /<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  while ((jsonMatch = imgSrcPattern.exec(html)) !== null) {
    images.push(jsonMatch[1]);
  }
  
  console.log(`Found ${images.length} raw images`);
  return images;
}

function filterImages(images: string[], url: string): string[] {
  const source = detectSource(url);
  
  // Patterns to exclude (site graphics, not car photos)
  const excludePatterns = [
    /logo/i, /icon[-_]?/i, /favicon/i, /sprite/i,
    /button/i, /arrow/i, /nav[-_]/i, /menu[-_]/i,
    /facebook|twitter|instagram|linkedin|youtube|whatsapp|telegram/i,
    /1x1|pixel|tracking|beacon/i, /\.gif$/i, /\.svg$/i,
    /postaffiliatepro/i, /\/ads?\//i, /banner(?!\.)/i,
    /share[-_]?/i, /rating/i, /badge(?!s)/i, /star[-_]/i,
    /avatar/i, /user[-_]?pic/i, /profile[-_]?/i,
    /modele\.leparking/i, // TheParking sample images
    /\/gfx\//i, /\/static\//i, /\/assets\//i,
    /placeholder/i, /loading[-_]/i, /spinner/i,
    /flag[-_]/i, /country[-_]/i, /lang[-_]/i,
    /payment/i, /credit[-_]?card/i, /visa|mastercard|paypal/i,
    /app[-_]?store|play[-_]?store|google[-_]?play/i,
  ];
  
  // Source-specific filters
  const sourceFilters: Record<string, RegExp[]> = {
    'theparking': [/scalethumb.*\/50x/i, /\/80\//i, /\/120\//i, /\/240\//i],
    'schadeautos': [/\/cache\/picture\/(?:80|120|240|320)\//i],
    'mobile.de': [/\$_\d{1,2}(?!\d)/i], // Small eBay thumbnails
  };
  
  const extraFilters = sourceFilters[source] || [];
  
  // Prefer high-quality images
  const qualityScore = (img: string): number => {
    let score = 0;
    
    // High-res indicators
    if (/\/2160\//i.test(img) || /\/1920/i.test(img)) score += 100;
    if (/\/1200/i.test(img) || /\/1080/i.test(img)) score += 80;
    if (/\/800/i.test(img) || /\/900/i.test(img)) score += 60;
    if (/large|full|original|high|zoom/i.test(img)) score += 50;
    if (/\$_86/i.test(img)) score += 40; // eBay high-res
    
    // Low-res indicators (penalize)
    if (/\/80\//i.test(img) || /\/120\//i.test(img)) score -= 50;
    if (/thumb|small|mini/i.test(img)) score -= 30;
    if (/\$_\d{1,2}(?!\d)/i.test(img)) score -= 20;
    
    // Source-specific bonuses
    if (source === 'theparking' && /cloud\.leparking\.fr/i.test(img)) score += 20;
    if (source === 'schadeautos' && /schadeautos\.nl\/cache\/picture\/1200/i.test(img)) score += 20;
    
    return score;
  };
  
  // Filter and dedupe
  const seen = new Map<string, { url: string; score: number }>();
  
  for (const img of images) {
    if (!img || !img.startsWith('http')) continue;
    if (img.length < 30) continue;
    
    // Check exclusions
    let excluded = false;
    for (const pattern of [...excludePatterns, ...extraFilters]) {
      if (pattern.test(img)) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;
    
    // Create normalized key for deduplication (same image, different sizes)
    const normalized = img
      .replace(/\/\d+x?\d*\//g, '/SIZE/')
      .replace(/\$_\d+/g, '$_SIZE')
      .replace(/~v\d+/g, '')
      .replace(/\?.*$/, '')
      .toLowerCase();
    
    const score = qualityScore(img);
    const existing = seen.get(normalized);
    
    // Keep higher quality version
    if (!existing || score > existing.score) {
      seen.set(normalized, { url: img, score });
    }
  }
  
  // Sort by quality score and take top 30
  const sorted = Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .map(item => item.url);
  
  const result = sorted.slice(0, 30);
  console.log(`Filtered to ${result.length} unique high-quality images`);
  return result;
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { listingUrl } = await req.json();

    if (!listingUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Listing URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\n===== Processing: ${listingUrl} =====\n`);
    const source = detectSource(listingUrl);
    console.log(`Detected source: ${source}`);
    
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY_1') || Deno.env.get('FIRECRAWL_API_KEY');
    
    let html = '';
    
    // Try Firecrawl first
    if (firecrawlKey) {
      try {
        console.log('Fetching with Firecrawl...');
        
        const firecrawlBody: Record<string, unknown> = {
          url: listingUrl,
          formats: ['html', 'rawHtml'],
          waitFor: 5000,
          timeout: 30000,
        };
        
        // Add location for German sites
        if (source === 'mobile.de' || source === 'kleinanzeigen' || source === 'autoscout24') {
          firecrawlBody.location = { country: 'DE', languages: ['de'] };
        }
        
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(firecrawlBody),
        });
        
        if (response.ok) {
          const data = await response.json();
          html = data.data?.rawHtml || data.data?.html || data.rawHtml || data.html || '';
          
          // Check if blocked
          if (html.includes('Zugriff verweigert') || 
              html.includes('Access Denied') || 
              html.includes('captcha')) {
            console.log('Firecrawl request was blocked');
            html = '';
          } else {
            console.log(`Firecrawl got ${html.length} bytes`);
          }
        }
      } catch (e) {
        console.error('Firecrawl error:', e);
      }
    }
    
    // Fallback to direct fetch
    if (!html || html.length < 1000) {
      console.log('Trying direct fetch...');
      try {
        const response = await fetch(listingUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          },
        });
        
        if (response.ok) {
          const directHtml = await response.text();
          if (!directHtml.includes('Zugriff verweigert') && 
              !directHtml.includes('Access Denied')) {
            html = directHtml;
            console.log(`Direct fetch got ${html.length} bytes`);
          }
        }
      } catch (e) {
        console.error('Direct fetch error:', e);
      }
    }
    
    // Extract data
    const details = extractDetails(html, listingUrl);
    const rawImages = extractImages(html, listingUrl);
    const images = filterImages(rawImages, listingUrl);
    
    // Check if we got blocked
    const isBlocked = html.length < 1000 || 
                      html.includes('Zugriff verweigert') || 
                      html.includes('Access Denied') ||
                      html.includes('captcha');
    
    console.log(`\n===== Result: ${images.length} images, blocked: ${isBlocked} =====\n`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        images,
        details,
        source,
        count: images.length,
        warning: isBlocked && images.length === 0 
          ? 'Šis portalas blokuoja scrapinimą. Nuotraukų nepavyko gauti.'
          : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        images: [],
        details: {}
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
