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
      // Find where the brand is and extract model after it
      const brandIndex = upperTitle.indexOf(brand);
      const afterBrand = title.substring(brandIndex + brand.length).trim();
      
      // Extract model - usually the next word(s) before numbers or special chars
      const modelMatch = afterBrand.match(/^[\s-]*([A-Za-z0-9][\w\s-]{0,20}?)(?:\s+\d|\s+-|$)/i);
      const model = modelMatch ? modelMatch[1].trim() : afterBrand.split(/\s+/)[0];
      
      return {
        brand: brand === 'VW' ? 'VOLKSWAGEN' : brand,
        model: model || ''
      };
    }
  }
  
  // Fallback: first word might be brand
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
  
  // Try to extract title from various sources
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const h1Tag = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  
  details.title = ogTitle?.[1] || h1Tag?.[1] || titleTag?.[1] || '';
  details.title = details.title.trim();
  
  // Extract brand and model from title
  if (details.title) {
    const brandModel = extractBrandFromTitle(details.title);
    if (brandModel) {
      details.brand = brandModel.brand;
      details.model = brandModel.model;
    }
  }
  
  // Extract year - look for 4-digit year pattern
  const yearPatterns = [
    /["']?year["']?\s*[:=]\s*["']?(\d{4})["']?/i,
    /(\d{4})\s*(?:m\.|metai|jaar|year|bj)/i,
    /\b(20[0-2][0-9])\b/,
    /\b(19[9][0-9])\b/,
  ];
  for (const pattern of yearPatterns) {
    const match = html.match(pattern);
    if (match && parseInt(match[1]) >= 1990 && parseInt(match[1]) <= 2025) {
      details.year = match[1];
      break;
    }
  }
  
  // Extract mileage
  const mileagePatterns = [
    /["']?(?:mileage|km|rida|kilometerstand)["']?\s*[:=]\s*["']?([\d.,]+)["']?/i,
    /([\d.,]{2,6})\s*km\b/i,
    /\b([\d]{2,3}[.,]?\d{3})\s*(?:km|kilometers)/i,
  ];
  for (const pattern of mileagePatterns) {
    const match = html.match(pattern);
    if (match) {
      details.mileage = match[1].replace(/[.,]/g, '');
      break;
    }
  }
  
  // Extract price
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

function extractAllImages(html: string, url: string): string[] {
  const images: string[] = [];
  
  console.log('Extracting images from URL:', url);
  
  // SCHADEAUTOS.NL - Multiple patterns
  if (url.includes('schadeautos.nl')) {
    // Pattern 1: Gallery images in JavaScript/JSON
    const galleryJsonRegex = /"(https:\/\/www\.schadeautos\.nl\/cache\/picture\/[^"]+)"/gi;
    let match;
    while ((match = galleryJsonRegex.exec(html)) !== null) {
      images.push(match[1]);
    }
    
    // Pattern 2: srcset images
    const srcsetRegex = /srcset="([^"]+)"/gi;
    while ((match = srcsetRegex.exec(html)) !== null) {
      const urls = match[1].split(',').map(s => s.trim().split(' ')[0]);
      for (const imgUrl of urls) {
        if (imgUrl.includes('schadeautos.nl') && (imgUrl.endsWith('.jpg') || imgUrl.endsWith('.jpeg') || imgUrl.endsWith('.png') || imgUrl.endsWith('.webp'))) {
          images.push(imgUrl);
        }
      }
    }
    
    // Pattern 3: data-src (lazy loading)
    const dataSrcRegex = /data-src="(https:\/\/www\.schadeautos\.nl[^"]+\.(jpg|jpeg|png|webp))"/gi;
    while ((match = dataSrcRegex.exec(html)) !== null) {
      images.push(match[1]);
    }
    
    // Pattern 4: img src
    const imgSrcRegex = /<img[^>]+src="(https:\/\/www\.schadeautos\.nl[^"]+\.(jpg|jpeg|png|webp))"/gi;
    while ((match = imgSrcRegex.exec(html)) !== null) {
      images.push(match[1]);
    }
    
    // Pattern 5: Background images
    const bgRegex = /url\(['"]?(https:\/\/www\.schadeautos\.nl[^'")\s]+\.(jpg|jpeg|png|webp))['"]?\)/gi;
    while ((match = bgRegex.exec(html)) !== null) {
      images.push(match[1]);
    }
    
    // Pattern 6: Look in script tags for image arrays
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    while ((match = scriptRegex.exec(html)) !== null) {
      const scriptContent = match[1];
      const imgInScript = /["'](https:\/\/www\.schadeautos\.nl\/cache\/picture\/\d+\/\d+\/[^"']+\.(?:jpg|jpeg|png|webp))["']/gi;
      let imgMatch;
      while ((imgMatch = imgInScript.exec(scriptContent)) !== null) {
        images.push(imgMatch[1]);
      }
    }
  }
  
  // LEPARKING patterns
  if (url.includes('leparking')) {
    const leparkingRegex = /https:\/\/cloud\.leparking\.fr\/[^"'\s)>\]]+\.(?:jpg|jpeg|png|webp)/gi;
    const matches = html.match(leparkingRegex) || [];
    images.push(...matches);
    
    // Scalethumb URLs
    const scalethumbRegex = /https:\/\/scalethumb\.leparking\.fr\/unsafe\/\d+x\d+\/smart\/(https[^"'\s)>\]]+)/gi;
    let match;
    while ((match = scalethumbRegex.exec(html)) !== null) {
      try {
        const decoded = decodeURIComponent(match[1]);
        images.push(decoded);
      } catch (e) {}
    }
  }
  
  // AUTOSCOUT24 patterns
  if (url.includes('autoscout24')) {
    const as24Regex = /https:\/\/[^"'\s]+\.autoscout24[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi;
    const matches = html.match(as24Regex) || [];
    images.push(...matches);
    
    // Also check for images in JSON-LD
    const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1]);
        if (json.image) {
          if (Array.isArray(json.image)) {
            images.push(...json.image);
          } else if (typeof json.image === 'string') {
            images.push(json.image);
          }
        }
      } catch (e) {}
    }
  }
  
  // MOBILE.DE patterns
  if (url.includes('mobile.de')) {
    const mobileDeRegex = /https:\/\/[^"'\s]+i\.ebayimg\.com[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi;
    const matches = html.match(mobileDeRegex) || [];
    images.push(...matches);
    
    const mobileDeRegex2 = /https:\/\/[^"'\s]+mobile\.de[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi;
    const matches2 = html.match(mobileDeRegex2) || [];
    images.push(...matches2);
  }
  
  // General patterns for any site
  // OG image
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImageMatch) images.push(ogImageMatch[1]);
  
  // All img tags with full URLs
  const imgTagRegex = /<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  let imgMatch;
  while ((imgMatch = imgTagRegex.exec(html)) !== null) {
    images.push(imgMatch[1]);
  }
  
  // Data attributes with images
  const dataImgRegex = /data-(?:src|image|original|lazy|full|zoom|large|hires|big)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  while ((imgMatch = dataImgRegex.exec(html)) !== null) {
    images.push(imgMatch[1]);
  }
  
  // JSON image URLs
  const jsonImgRegex = /"(?:url|src|image|photo|img|picture|href)":\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  while ((imgMatch = jsonImgRegex.exec(html)) !== null) {
    images.push(imgMatch[1]);
  }
  
  console.log(`Raw extracted: ${images.length} image URLs`);
  
  return images;
}

function filterAndDedupeImages(images: string[]): string[] {
  const excludePatterns = [
    /logo/i, /icon/i, /flag/i, /avatar/i, /placeholder/i, /blank/i,
    /spinner/i, /loading/i, /banner/i, /ad[-_]/i, /\/ads\//i,
    /favicon/i, /button/i, /arrow/i, /social/i, /share/i,
    /facebook|twitter|instagram|linkedin|youtube|whatsapp/i,
    /1x1|pixel|tracking/i, /badge/i, /rating/i, /star/i,
  ];
  
  const seen = new Map<string, string>();
  
  for (const img of images) {
    if (!img || !img.startsWith('http')) continue;
    
    // Check exclude patterns
    let excluded = false;
    for (const pattern of excludePatterns) {
      if (pattern.test(img)) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;
    
    // Skip very short URLs (likely not real images)
    if (img.length < 50) continue;
    
    // Create a normalized key for deduplication (remove size variations)
    const normalizedKey = img
      .replace(/\/\d+x\d+\//g, '/SIZE/')
      .replace(/_\d+x\d+/g, '_SIZE')
      .replace(/\/cache\/picture\/\d+\//g, '/cache/picture/X/')
      .replace(/\?.*$/, ''); // Remove query params
    
    // Keep the larger version (higher cache size for schadeautos)
    const existingImg = seen.get(normalizedKey);
    if (existingImg) {
      const existingSize = existingImg.match(/\/cache\/picture\/(\d+)\//)?.[1] || '0';
      const currentSize = img.match(/\/cache\/picture\/(\d+)\//)?.[1] || '0';
      if (parseInt(currentSize) > parseInt(existingSize)) {
        seen.set(normalizedKey, img);
      }
    } else {
      seen.set(normalizedKey, img);
    }
  }
  
  // Sort by size (prefer larger images)
  const result = Array.from(seen.values()).sort((a, b) => {
    const aSize = parseInt(a.match(/\/cache\/picture\/(\d+)\//)?.[1] || '0');
    const bSize = parseInt(b.match(/\/cache\/picture\/(\d+)\//)?.[1] || '0');
    return bSize - aSize;
  });
  
  console.log(`After filtering: ${result.length} unique images`);
  
  return result.slice(0, 100); // Max 100 images
}

async function fetchWithFirecrawl(url: string): Promise<{ html: string; images: string[] } | null> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.log('Firecrawl API key not available, using standard fetch');
    return null;
  }
  
  try {
    console.log('Using Firecrawl to scrape:', url);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html', 'links', 'rawHtml'],
        onlyMainContent: false,
        waitFor: 2000, // Wait for JS to load images
      }),
    });
    
    if (!response.ok) {
      console.error('Firecrawl error:', response.status);
      return null;
    }
    
    const data = await response.json();
    console.log('Firecrawl response received');
    
    // Get HTML from response
    const html = data.data?.rawHtml || data.data?.html || data.rawHtml || data.html || '';
    
    // Extract images from links if available
    const links = data.data?.links || data.links || [];
    const imageLinks = links.filter((link: string) => 
      /\.(jpg|jpeg|png|webp)$/i.test(link)
    );
    
    return { html, images: imageLinks };
  } catch (error) {
    console.error('Firecrawl fetch error:', error);
    return null;
  }
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
    
    let html = '';
    let firecrawlImages: string[] = [];
    
    // Try Firecrawl first (better JS rendering)
    const firecrawlResult = await fetchWithFirecrawl(listingUrl);
    if (firecrawlResult) {
      html = firecrawlResult.html;
      firecrawlImages = firecrawlResult.images;
      console.log(`Firecrawl got ${html.length} bytes, ${firecrawlImages.length} image links`);
    }
    
    // Fallback to standard fetch if Firecrawl didn't work or returned empty
    if (!html || html.length < 1000) {
      console.log('Falling back to standard fetch');
      const response = await fetch(listingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5,nl;q=0.3',
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch page: ${response.status}`);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to fetch page: ${response.status}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      html = await response.text();
      console.log(`Standard fetch got ${html.length} bytes`);
    }

    // Extract details
    const details = extractDetailsFromHtml(html, listingUrl);
    console.log('Extracted details:', details);

    // Extract all images from HTML
    const htmlImages = extractAllImages(html, listingUrl);
    
    // Combine images from all sources
    const allImages = [...firecrawlImages, ...htmlImages];
    
    // Filter and dedupe
    const result = filterAndDedupeImages(allImages);
    
    console.log(`Final result: ${result.length} unique images`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        images: result,
        details,
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
