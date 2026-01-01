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
  };
}

// Known car brands for extraction
const CAR_BRANDS = [
  'AUDI', 'BMW', 'MERCEDES', 'VOLKSWAGEN', 'VW', 'TOYOTA', 'HONDA', 'FORD', 'CHEVROLET',
  'NISSAN', 'HYUNDAI', 'KIA', 'MAZDA', 'SUBARU', 'LEXUS', 'VOLVO', 'PORSCHE', 'JAGUAR',
  'LAND ROVER', 'RANGE ROVER', 'MINI', 'FIAT', 'ALFA ROMEO', 'PEUGEOT', 'CITROEN', 'RENAULT',
  'OPEL', 'SEAT', 'SKODA', 'SUZUKI', 'MITSUBISHI', 'JEEP', 'DODGE', 'CHRYSLER', 'CADILLAC',
  'TESLA', 'FERRARI', 'LAMBORGHINI', 'MASERATI', 'ASTON MARTIN', 'BENTLEY', 'ROLLS ROYCE',
  'DACIA', 'LANCIA', 'SAAB', 'INFINITI', 'ACURA', 'GENESIS', 'CUPRA', 'DS', 'SMART'
];

function extractBrandFromTitle(title: string): { brand: string; model: string } | null {
  const upperTitle = title.toUpperCase();
  
  for (const brand of CAR_BRANDS) {
    if (upperTitle.includes(brand)) {
      const brandIndex = upperTitle.indexOf(brand);
      const afterBrand = title.substring(brandIndex + brand.length).trim();
      const modelMatch = afterBrand.match(/^[\s-]*([A-Za-z0-9][\w\s-]{0,20}?)(?:\s+\d|\s+-|$)/i);
      const model = modelMatch ? modelMatch[1].trim() : afterBrand.split(/\s+/)[0];
      
      return {
        brand: brand === 'VW' ? 'VOLKSWAGEN' : brand,
        model: model || ''
      };
    }
  }
  
  const words = title.split(/[\s-]+/);
  if (words.length > 0) {
    return {
      brand: words[0].toUpperCase(),
      model: words.length > 1 ? words[1] : ''
    };
  }
  
  return null;
}

function extractDetailsFromHtml(html: string, url: string): ScrapedData['details'] {
  const details: ScrapedData['details'] = {};
  
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const h1Tag = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  
  details.title = ogTitle?.[1] || h1Tag?.[1] || titleTag?.[1] || '';
  details.title = details.title.trim();
  
  // Skip if we got access denied page
  if (details.title.toLowerCase().includes('zugriff verweigert') || 
      details.title.toLowerCase().includes('access denied') ||
      details.title.toLowerCase().includes('captcha')) {
    details.title = '';
  }
  
  if (details.title) {
    const brandModel = extractBrandFromTitle(details.title);
    if (brandModel) {
      details.brand = brandModel.brand;
      details.model = brandModel.model;
    }
  }
  
  const yearPatterns = [
    /["']?year["']?\s*[:=]\s*["']?(\d{4})["']?/i,
    /(\d{4})\s*(?:m\.|metai|jaar|year|bj)/i,
    /Erstzulassung[:\s]*(\d{2})\/(\d{4})/i,
    /\b(20[0-2][0-9])\b/,
    /\b(19[9][0-9])\b/,
  ];
  for (const pattern of yearPatterns) {
    const match = html.match(pattern);
    if (match) {
      const year = match[2] ? parseInt(match[2]) : parseInt(match[1]);
      if (year >= 1990 && year <= 2025) {
        details.year = year.toString();
        break;
      }
    }
  }
  
  const mileagePatterns = [
    /["']?(?:mileage|km|rida|kilometerstand)["']?\s*[:=]\s*["']?([\d.,]+)["']?/i,
    /([\d.,]{2,7})\s*km\b/i,
    /\b([\d]{2,3}[.,]?\d{3})\s*(?:km|kilometers)/i,
  ];
  for (const pattern of mileagePatterns) {
    const match = html.match(pattern);
    if (match) {
      details.mileage = match[1].replace(/[.,]/g, '');
      break;
    }
  }
  
  const pricePatterns = [
    /["']?price["']?\s*[:=]\s*["']?([\d.,]+)["']?/i,
    /€\s*([\d.,]+)/i,
    /([\d.,]+)\s*€/i,
    /EUR\s*([\d.,]+)/i,
  ];
  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (match) {
      const priceStr = match[1].replace(/[.,]/g, '');
      const price = parseInt(priceStr);
      if (price > 100 && price < 1000000) {
        details.price = priceStr;
        break;
      }
    }
  }
  
  return details;
}

// ===== SITE-SPECIFIC EXTRACTORS =====

function extractMobileDeImages(html: string): string[] {
  const images: string[] = [];
  
  // Mobile.de uses various CDNs
  const patterns = [
    /https:\/\/[^"'\s]+i\.ebayimg\.com[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]+prod\.pictures\.autoscout24\.net[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]+img\.classistatic\.de[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]+mobile\.de[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]+apollo[^"'\s]+mobile[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = html.match(pattern) || [];
    images.push(...matches);
  }
  
  // Extract from JSON-LD
  const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      if (json.image) {
        if (Array.isArray(json.image)) images.push(...json.image);
        else if (typeof json.image === 'string') images.push(json.image);
      }
      if (json.offers?.image) {
        if (Array.isArray(json.offers.image)) images.push(...json.offers.image);
        else if (typeof json.offers.image === 'string') images.push(json.offers.image);
      }
    } catch (e) {}
  }
  
  // Extract from gallery data
  const galleryPattern = /"imageUrl"\s*:\s*"([^"]+)"/gi;
  while ((match = galleryPattern.exec(html)) !== null) {
    images.push(match[1].replace(/\\\//g, '/'));
  }
  
  // Extract from image arrays in script tags
  const imgArrayPattern = /\["(https?:\/\/[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  while ((match = imgArrayPattern.exec(html)) !== null) {
    images.push(match[1].replace(/\\\//g, '/'));
  }
  
  console.log(`Mobile.de: found ${images.length} images`);
  return images;
}

function extractSchadeautosImages(html: string, listingUrl: string): string[] {
  const images: string[] = [];
  
  // Extract listing ID from URL - schadeautos uses numeric ID at end
  // Examples: /voertuig/audi-a3-sportback/53813 or /o/53813
  const listingIdMatch = listingUrl.match(/\/(\d+)\/?(?:\?|$)/);
  const listingId = listingIdMatch?.[1] || '';
  
  console.log(`Schadeautos listing ID: ${listingId}`);
  
  // Only look for /cache/picture/ URLs - these are the actual listing photos
  // Pattern: /cache/picture/{size}/{listingId}/{hash}~v{timestamp}.jpg
  const cachePattern = /https:\/\/www\.schadeautos\.nl\/cache\/picture\/(\d+)\/(\d+)\/([a-f0-9]+)(?:~v\d+)?\.jpg/gi;
  let match;
  const foundImages = new Map<string, { url: string; size: number }>();
  
  while ((match = cachePattern.exec(html)) !== null) {
    const [fullUrl, size, imgListingId, hash] = match;
    
    // Skip if this is a different listing's image (from recommendations etc)
    if (listingId && imgListingId !== listingId) {
      continue;
    }
    
    // Create high-res version URL
    const highResUrl = `https://www.schadeautos.nl/cache/picture/1200/${imgListingId}/${hash}.jpg`;
    const sizeNum = parseInt(size);
    
    // Store by hash, prefer larger size
    const existing = foundImages.get(hash);
    if (!existing || sizeNum > existing.size) {
      foundImages.set(hash, { url: highResUrl, size: 1200 });
    }
  }
  
  // Get unique high-res URLs
  for (const { url } of foundImages.values()) {
    images.push(url);
  }
  
  // Also check data attributes for zoomed images
  const dataPattern = /data-(?:zoom|large|original|full)=["'](https:\/\/www\.schadeautos\.nl\/cache\/picture[^"']+)["']/gi;
  while ((match = dataPattern.exec(html)) !== null) {
    const url = match[1];
    if (!images.includes(url) && (!listingId || url.includes(`/${listingId}/`))) {
      images.push(url);
    }
  }
  
  console.log(`Schadeautos: found ${images.length} listing images`);
  return images;
}

function extract2dehandsImages(html: string): string[] {
  const images: string[] = [];
  
  // 2dehands.be / 2ememain.be image patterns
  const patterns = [
    /https:\/\/[^"'\s]*2dehands[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]*2ememain[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]*lbthumbs[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]*marktplaats[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]*cloud\.leparking[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = html.match(pattern) || [];
    images.push(...matches);
  }
  
  // JSON image arrays
  const jsonPattern = /"(?:imageUrl|src|url)":\s*"(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  let match;
  while ((match = jsonPattern.exec(html)) !== null) {
    images.push(match[1].replace(/\\\//g, '/'));
  }
  
  console.log(`2dehands: found ${images.length} images`);
  return images;
}

function extractKleinanzeigenImages(html: string): string[] {
  const images: string[] = [];
  
  // Kleinanzeigen (eBay Kleinanzeigen) patterns
  const patterns = [
    /https:\/\/[^"'\s]*kleinanzeigen[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]*ebayimg\.com[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]*ebay-kleinanzeigen[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]*img\.classistatic\.de[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = html.match(pattern) || [];
    images.push(...matches);
  }
  
  // Gallery JSON
  const galleryPattern = /"(?:image|photo|src|url)":\s*"(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  let match;
  while ((match = galleryPattern.exec(html)) !== null) {
    images.push(match[1].replace(/\\\//g, '/'));
  }
  
  console.log(`Kleinanzeigen: found ${images.length} images`);
  return images;
}

function extractGaspedaalImages(html: string): string[] {
  const images: string[] = [];
  
  // Gaspedaal.nl patterns
  const patterns = [
    /https:\/\/[^"'\s]*gaspedaal[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]*cdn\.gaspedaal\.nl[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = html.match(pattern) || [];
    images.push(...matches);
  }
  
  // Data attributes for lazy loading
  const dataPattern = /data-(?:src|image|lazy|original)=["'](https:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  let match;
  while ((match = dataPattern.exec(html)) !== null) {
    images.push(match[1]);
  }
  
  console.log(`Gaspedaal: found ${images.length} images`);
  return images;
}

function extractMarktplaatsImages(html: string): string[] {
  const images: string[] = [];
  
  // Marktplaats.nl patterns
  const patterns = [
    /https:\/\/[^"'\s]*marktplaats[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]*lbthumbs\.marktplaats[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]*cloud\.leparking[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = html.match(pattern) || [];
    images.push(...matches);
  }
  
  // JSON patterns
  const jsonPattern = /"(?:imageUrl|src|url|image)":\s*"(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  let match;
  while ((match = jsonPattern.exec(html)) !== null) {
    images.push(match[1].replace(/\\\//g, '/'));
  }
  
  console.log(`Marktplaats: found ${images.length} images`);
  return images;
}

function extractAutoscout24Images(html: string): string[] {
  const images: string[] = [];
  
  // AutoScout24 patterns (works for .de, .be, .nl, .at, etc.)
  const patterns = [
    /https:\/\/[^"'\s]*autoscout24[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]*prod\.pictures\.autoscout24\.net[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
    /https:\/\/[^"'\s]*pics\.autoscout24[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = html.match(pattern) || [];
    images.push(...matches);
  }
  
  // JSON-LD structured data
  const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      if (json.image) {
        if (Array.isArray(json.image)) images.push(...json.image);
        else if (typeof json.image === 'string') images.push(json.image);
      }
    } catch (e) {}
  }
  
  // Gallery data
  const galleryPattern = /"(?:imageUrl|src|image|url)":\s*"(https:\/\/[^"]*autoscout24[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  while ((match = galleryPattern.exec(html)) !== null) {
    images.push(match[1].replace(/\\\//g, '/'));
  }
  
  // Data attributes
  const dataPattern = /data-(?:src|image|full|zoom|large)=["'](https:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  while ((match = dataPattern.exec(html)) !== null) {
    images.push(match[1]);
  }
  
  console.log(`AutoScout24: found ${images.length} images`);
  return images;
}

// Extract images only from .col9.col12-sm.content section (schadeautos layout)
function extractContentSectionImages(html: string): string[] {
  const images: string[] = [];
  
  // Find div with class containing "col9" AND "col12-sm" AND "content"
  // Pattern: class="col9 col12-sm content" or similar variations
  const contentRegex = /<div[^>]+class=["'][^"']*\bcol9\b[^"']*\bcol12-sm\b[^"']*\bcontent\b[^"']*["'][^>]*>([\s\S]*?)(?=<\/div>\s*<div[^>]+class=["'][^"']*\bcol|<\/section>|<footer|$)/gi;
  
  // Also try alternative order: content col9 col12-sm
  const contentRegex2 = /<div[^>]+class=["'][^"']*\bcontent\b[^"']*\bcol9\b[^"']*["'][^>]*>([\s\S]*?)(?=<\/div>\s*<div[^>]+class=["'][^"']*\bcol|<\/section>|<footer|$)/gi;
  
  let contentMatch;
  let contentHtml = '';
  
  while ((contentMatch = contentRegex.exec(html)) !== null) {
    contentHtml += contentMatch[0];
  }
  
  // Try alternative pattern if first didn't match
  if (!contentHtml) {
    while ((contentMatch = contentRegex2.exec(html)) !== null) {
      contentHtml += contentMatch[0];
    }
  }
  
  // If still no match, try simpler pattern for just "content" class within a col structure
  if (!contentHtml) {
    const simpleContentRegex = /<div[^>]+class=["'][^"']*\bcontent\b[^"']*["'][^>]*>([\s\S]*?)(?=<\/div>\s*<\/div>\s*<\/div>|<footer|$)/gi;
    while ((contentMatch = simpleContentRegex.exec(html)) !== null) {
      contentHtml += contentMatch[0];
    }
  }
  
  if (contentHtml) {
    console.log(`Found content section: ${contentHtml.length} chars`);
    
    // Extract images from img tags
    const imgTagRegex = /<img[^>]+(?:src|data-src|data-lazy|data-original)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
    let match;
    while ((match = imgTagRegex.exec(contentHtml)) !== null) {
      images.push(match[1]);
    }
    
    // Extract from data attributes
    const dataPattern = /data-(?:src|image|original|lazy|full|zoom|large)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
    while ((match = dataPattern.exec(contentHtml)) !== null) {
      images.push(match[1]);
    }
    
    // Extract from background images
    const bgPattern = /url\(['"]?(https?:\/\/[^'")\s]+\.(?:jpg|jpeg|png|webp)[^'")\s]*)['"]?\)/gi;
    while ((match = bgPattern.exec(contentHtml)) !== null) {
      images.push(match[1]);
    }
    
    // Extract from srcset attributes
    const srcsetPattern = /srcset=["']([^"']+)["']/gi;
    while ((match = srcsetPattern.exec(contentHtml)) !== null) {
      const srcsetValue = match[1];
      const srcsetUrls = srcsetValue.split(',').map(s => s.trim().split(/\s+/)[0]);
      for (const url of srcsetUrls) {
        if (url.match(/https?:\/\/.*\.(jpg|jpeg|png|webp)/i)) {
          images.push(url);
        }
      }
    }
    
    console.log(`Content section: found ${images.length} images`);
  } else {
    console.log('Content section not found');
  }
  
  return images;
}

function extractGenericImages(html: string): string[] {
  const images: string[] = [];
  
  // OG image
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImageMatch) images.push(ogImageMatch[1]);
  
  // Standard img tags
  const imgTagRegex = /<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  let match;
  while ((match = imgTagRegex.exec(html)) !== null) {
    images.push(match[1]);
  }
  
  // Data attributes for lazy loading
  const dataPatterns = [
    /data-(?:src|image|original|lazy|full|zoom|large|hires|big)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
    /data-srcset=["']([^"']+)["']/gi,
  ];
  
  for (const pattern of dataPatterns) {
    while ((match = pattern.exec(html)) !== null) {
      // Handle srcset format
      if (match[1].includes(',')) {
        const urls = match[1].split(',').map(s => s.trim().split(' ')[0]);
        images.push(...urls.filter(u => u.startsWith('http')));
      } else {
        images.push(match[1]);
      }
    }
  }
  
  // JSON image patterns
  const jsonPattern = /"(?:url|src|image|photo|img|picture|href)":\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  while ((match = jsonPattern.exec(html)) !== null) {
    images.push(match[1].replace(/\\\//g, '/'));
  }
  
  // Background images in style
  const bgPattern = /url\(['"]?(https?:\/\/[^'")\s]+\.(?:jpg|jpeg|png|webp)[^'")\s]*)['"]?\)/gi;
  while ((match = bgPattern.exec(html)) !== null) {
    images.push(match[1]);
  }
  
  return images;
}

function filterAndDedupeImages(images: string[], sourceUrl: string): string[] {
  const excludePatterns = [
    /logo/i, /icon/i, /flag/i, /avatar/i, /placeholder/i, /blank/i,
    /spinner/i, /loading/i, /banner/i, /ad[-_]/i, /\/ads\//i,
    /favicon/i, /button/i, /arrow/i, /social/i, /share/i,
    /facebook|twitter|instagram|linkedin|youtube|whatsapp/i,
    /1x1|pixel|tracking/i, /badge/i, /rating/i, /star/i,
    /sprite/i, /thumb_\d+x\d+/i, /\/s\/\d+x\d+\//i,
    /\/gfx\//i, // Exclude schadeautos /gfx/ folder (icons, decorative images)
    /visual\/SA2-/i, // Exclude schadeautos visual decorations
    /build-year\.png/i, /distance\.png/i, // Exclude specific schadeautos icons
  ];
  
  // Size preference patterns
  const sizePatterns = [
    { pattern: /\/(\d+)x(\d+)\//i, extractor: (m: RegExpMatchArray) => parseInt(m[1]) * parseInt(m[2]) },
    { pattern: /\/cache\/picture\/(\d+)\//i, extractor: (m: RegExpMatchArray) => parseInt(m[1]) },
    { pattern: /_(\d+)x(\d+)\./i, extractor: (m: RegExpMatchArray) => parseInt(m[1]) * parseInt(m[2]) },
    { pattern: /[?&]w=(\d+)/i, extractor: (m: RegExpMatchArray) => parseInt(m[1]) },
  ];
  
  const getImageSize = (url: string): number => {
    for (const { pattern, extractor } of sizePatterns) {
      const match = url.match(pattern);
      if (match) return extractor(match);
    }
    return 0;
  };
  
  const normalizeUrl = (url: string): string => {
    return url
      .replace(/\/\d+x\d+\//g, '/SIZE/')
      .replace(/_\d+x\d+/g, '_SIZE')
      .replace(/\/cache\/picture\/\d+\//g, '/cache/picture/X/')
      .replace(/~v\d+/g, '')
      .replace(/\?.*$/, '')
      .replace(/(https?:\/\/[^/]+).*?([a-f0-9]{8,}).*$/i, '$1...$2');
  };
  
  const seen = new Map<string, { url: string; size: number }>();
  
  for (const img of images) {
    if (!img || !img.startsWith('http')) continue;
    
    // Check exclusions
    let excluded = false;
    for (const pattern of excludePatterns) {
      if (pattern.test(img)) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;
    
    // Skip very short URLs (likely not real images)
    if (img.length < 40) continue;
    
    const normalizedKey = normalizeUrl(img);
    const size = getImageSize(img);
    const existing = seen.get(normalizedKey);
    
    if (!existing || size > existing.size) {
      seen.set(normalizedKey, { url: img, size });
    }
  }
  
  // Sort by size (largest first) and return
  const result = Array.from(seen.values())
    .sort((a, b) => b.size - a.size)
    .map(item => item.url)
    .slice(0, 50);
  
  console.log(`Filtered to ${result.length} unique images`);
  return result;
}

function detectSource(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('mobile.de') || urlLower.includes('suchen.mobile.de')) return 'mobile.de';
  if (urlLower.includes('schadeautos.nl')) return 'schadeautos';
  if (urlLower.includes('2dehands') || urlLower.includes('2ememain')) return '2dehands';
  if (urlLower.includes('kleinanzeigen') || urlLower.includes('ebay-kleinanzeigen')) return 'kleinanzeigen';
  if (urlLower.includes('gaspedaal.nl')) return 'gaspedaal';
  if (urlLower.includes('marktplaats.nl')) return 'marktplaats';
  if (urlLower.includes('autoscout24')) return 'autoscout24';
  return 'generic';
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch (e) {
      console.log(`Fetch attempt ${i + 1} failed:`, e);
    }
    if (i < retries) {
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}

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

    console.log(`Processing listing: ${listingUrl}`);
    const source = detectSource(listingUrl);
    console.log(`Detected source: ${source}`);
    
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY_1') || Deno.env.get('FIRECRAWL_API_KEY');
    
    let html = '';
    let usedScreenshot = false;
    
    // Try Firecrawl first with better options for anti-bot sites
    if (firecrawlKey) {
      try {
        console.log('Trying Firecrawl with enhanced settings...');
        
        // For mobile.de and similar protected sites, use screenshot + scrape
        const firecrawlBody: Record<string, unknown> = {
          url: listingUrl,
          formats: ['html', 'rawHtml'],
          waitFor: 8000,
          timeout: 30000,
        };
        
        // Add location settings for German sites
        if (source === 'mobile.de' || source === 'kleinanzeigen' || source === 'autoscout24') {
          firecrawlBody.location = {
            country: 'DE',
            languages: ['de']
          };
        }
        
        const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(firecrawlBody),
        });
        
        if (firecrawlResponse.ok) {
          const firecrawlData = await firecrawlResponse.json();
          html = firecrawlData.data?.rawHtml || firecrawlData.data?.html || firecrawlData.rawHtml || firecrawlData.html || '';
          
          // Check if we got blocked
          if (html.includes('Zugriff verweigert') || html.includes('Access Denied') || html.includes('captcha')) {
            console.log('Firecrawl got blocked, trying alternative approach...');
            html = '';
          } else {
            console.log(`Firecrawl fetched ${html.length} bytes`);
          }
        } else {
          const errorData = await firecrawlResponse.json().catch(() => ({}));
          console.log('Firecrawl failed:', errorData);
        }
      } catch (e) {
        console.log('Firecrawl error:', e);
      }
    }
    
    // Fallback to direct fetch with various headers
    if (!html || html.length < 1000) {
      console.log('Trying direct fetch with browser-like headers...');
      
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      ];
      
      for (const ua of userAgents) {
        try {
          const response = await fetch(listingUrl, {
            headers: {
              'User-Agent': ua,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7,nl;q=0.6',
              'Accept-Encoding': 'gzip, deflate, br',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'none',
              'Sec-Fetch-User': '?1',
              'Upgrade-Insecure-Requests': '1',
            },
          });

          if (response.ok) {
            const directHtml = await response.text();
            
            // Check if not blocked
            if (!directHtml.includes('Zugriff verweigert') && 
                !directHtml.includes('Access Denied') && 
                !directHtml.includes('captcha')) {
              if (directHtml.length > html.length) {
                html = directHtml;
                console.log(`Direct fetch got ${html.length} bytes`);
                break;
              }
            }
          }
        } catch (e) {
          console.log('Direct fetch error:', e);
        }
      }
    }

    // Extract what we can even if blocked - for some sites the images are in the initial response
    const details = extractDetailsFromHtml(html, listingUrl);
    console.log('Extracted details:', details);

    // Extract images based on source
    let allImages: string[] = [];
    
    switch (source) {
      case 'mobile.de':
        allImages = extractMobileDeImages(html);
        break;
      case 'schadeautos':
        allImages = extractSchadeautosImages(html, listingUrl);
        break;
      case '2dehands':
        allImages = extract2dehandsImages(html);
        break;
      case 'kleinanzeigen':
        allImages = extractKleinanzeigenImages(html);
        break;
      case 'gaspedaal':
        allImages = extractGaspedaalImages(html);
        break;
      case 'marktplaats':
        allImages = extractMarktplaatsImages(html);
        break;
      case 'autoscout24':
        allImages = extractAutoscout24Images(html);
        break;
      default:
        allImages = [];
    }
    
    // First try to extract only from .col9.col12-sm.content section
    const contentImages = extractContentSectionImages(html);
    if (contentImages.length > 0) {
      allImages.push(...contentImages);
      console.log(`Using ${contentImages.length} images from .content section`);
    } else {
      // Fallback to generic extraction if no content section found
      const genericImages = extractGenericImages(html);
      allImages.push(...genericImages);
      console.log(`Fallback: using ${genericImages.length} generic images`);
    }
    
    console.log(`Total raw images: ${allImages.length}`);
    
    // Filter and dedupe
    const result = filterAndDedupeImages(allImages, listingUrl);
    
    console.log(`Final result: ${result.length} unique images`);

    // Check for various blocking scenarios
    const isBlocked = html.includes('Zugriff verweigert') || 
                      html.includes('Access Denied') ||
                      html.includes('captcha');
    
    // Check if schadeautos redirected to home page (they block scrapers this way)
    const isSchadeautosHomePage = source === 'schadeautos' && 
      (html.includes('<body class="home') || 
       html.includes('Buy Damaged Cars') ||
       (details.title?.includes('Schadeautos') && !listingUrl.includes(details.title)));
    
    if (result.length === 0 && (isBlocked || isSchadeautosHomePage)) {
      const errorMessage = isSchadeautosHomePage 
        ? 'Schadeautos.nl blokuoja prieigą. Šis portalas nepalaikomas.'
        : 'Svetainė blokuoja prieigą. Pabandykite vėliau arba naudokite kitą nuorodą.';
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          blocked: true,
          source 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        images: result,
        details,
        source,
        count: result.length 
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
