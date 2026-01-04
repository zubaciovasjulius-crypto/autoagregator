import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Portal detection
function detectPortal(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('autoplius.lt')) return 'autoplius';
  if (u.includes('theparking') || u.includes('leparking')) return 'theparking';
  if (u.includes('schadeautos.nl')) return 'schadeautos';
  if (u.includes('mobile.de')) return 'mobile';
  if (u.includes('autoscout24')) return 'autoscout24';
  if (u.includes('marktplaats.nl')) return 'marktplaats';
  if (u.includes('2dehands.be') || u.includes('2ememain.be')) return '2dehands';
  if (u.includes('kleinanzeigen')) return 'kleinanzeigen';
  if (u.includes('gaspedaal.nl')) return 'gaspedaal';
  if (u.includes('otomoto.pl')) return 'otomoto';
  if (u.includes('ss.lv') || u.includes('ss.com')) return 'ss';
  return 'generic';
}

// Extract listing ID from URL
function extractListingId(url: string, portal: string): string | null {
  try {
    if (portal === 'autoplius') {
      // Format: /skelbimai/...-29788369.html
      const match = url.match(/-(\d{6,12})\.html/i) || url.match(/\/(\d{6,12})(?:\.html|\/|$)/);
      return match ? match[1] : null;
    }
    if (portal === 'theparking') {
      const match = url.match(/_(\d{7,12})\.html/i) || url.match(/\/(\d{7,12})(?:\.html|\/|$)/);
      return match ? match[1] : null;
    }
    if (portal === 'schadeautos') {
      const match = url.match(/\/o\/(\d+)/);
      return match ? match[1] : null;
    }
    if (portal === 'mobile') {
      const match = url.match(/\/(\d{8,12})(?:\.html|\/|$)/);
      return match ? match[1] : null;
    }
    if (portal === 'autoscout24') {
      const match = url.match(/\/(\d{8,12})(?:\?|\/|$)/);
      return match ? match[1] : null;
    }
    if (portal === 'marktplaats' || portal === '2dehands') {
      const match = url.match(/[/-](\d{8,12})(?:\.html|\/|$)/);
      return match ? match[1] : null;
    }
    if (portal === 'otomoto') {
      const match = url.match(/ID([A-Za-z0-9]+)\.html/i);
      return match ? match[1] : null;
    }
  } catch (e) {
    console.error('Error extracting listing ID:', e);
  }
  return null;
}

// Clean and validate image URL
function cleanImageUrl(src: string, portal: string): string | null {
  if (!src || src.length < 10) return null;

  // Skip data URIs, SVGs, and tracking pixels
  if (src.startsWith('data:') || src.includes('.svg') || src.includes('1x1') || src.includes('pixel')) {
    return null;
  }

  // Skip common non-car images
  const skipPatterns = [
    '/gfx/', '/icons/', '/logo', '/banner', '/ads/', '/advertisement/',
    'carvertical', 'postaffiliate', 'tracking', 'analytics',
    'favicon', 'sprite', 'button', 'arrow', 'home.png', 'search.png',
    'id_categorie', 'modele.leparking.fr', '/visual/SA2-', 'build-year',
    'distance.png', 'fuel.png', 'gearbox.png', 'placeholder',
    'googleads', 'doubleclick', 'facebook', 'twitter', 'linkedin',
    'badge', 'flag', 'rating', 'star', 'check', 'verified',
    '/static/', '/assets/icons', 'loader', 'spinner', 'avatar',
    'profile', 'user-icon', 'dealer-logo', 'watermark'
  ];

  const srcLower = src.toLowerCase();
  if (skipPatterns.some(pattern => srcLower.includes(pattern))) {
    return null;
  }

  // Ensure absolute URL
  let cleanUrl = src;
  if (src.startsWith('//')) {
    cleanUrl = 'https:' + src;
  }

  // Portal-specific image URL upgrades
  if (portal === 'theparking' && cleanUrl.includes('cloud.leparking.fr')) {
    cleanUrl = cleanUrl.replace(/\/s\/\d+\//, '/s/2160/');
  }

  if (portal === 'schadeautos' && cleanUrl.includes('cache')) {
    cleanUrl = cleanUrl.replace(/\/cache\/\d+x\d+\//, '/cache/1200x900/');
  }

  if (portal === 'autoscout24') {
    cleanUrl = cleanUrl.replace(/\/thumbnails\//, '/images/');
    cleanUrl = cleanUrl.replace(/\?rule=.*$/, '');
  }

  if (portal === 'mobile') {
    cleanUrl = cleanUrl.replace(/\$_\d+\.JPG/, '$_86.JPG');
  }

  if (portal === 'autoplius') {
    // Autoplius uses different image sizes, get the largest
    cleanUrl = cleanUrl.replace(/\/s\d+x\d+\//, '/original/');
    cleanUrl = cleanUrl.replace(/\?.*$/, ''); // Remove query params
  }

  if (portal === 'otomoto') {
    // Otomoto image optimization
    cleanUrl = cleanUrl.replace(/;s=\d+x\d+/, ';s=1280x960');
  }

  return cleanUrl;
}

// Filter images by listing ID to exclude "similar cars"
function filterByListingId(images: string[], listingId: string | null, portal: string): string[] {
  if (!listingId) return images;

  // For autoplius, images often contain the listing ID
  if (portal === 'autoplius') {
    const filtered = images.filter(img => {
      // Keep images that contain our listing ID or don't have any ID
      if (img.includes(listingId)) return true;
      // Check if image has a different listing ID
      const idMatch = img.match(/\/(\d{6,12})\//);
      if (idMatch && idMatch[1] !== listingId) return false;
      return true;
    });
    return filtered.length > 0 ? filtered : images;
  }

  return images.filter(img => {
    const idMatch = img.match(/_(\d{7,12})\./);
    if (idMatch) {
      return idMatch[1] === listingId;
    }
    return true;
  });
}

// Extract car details from HTML
function extractCarDetails(html: string, url: string, portal: string): {
  title: string;
  brand: string;
  model: string;
  year: number | null;
  mileage: number | null;
  price: number | null;
} {
  let title = '';
  let brand = '';
  let model = '';
  let year: number | null = null;
  let mileage: number | null = null;
  let price: number | null = null;

  // Portal-specific extraction
  if (portal === 'autoplius') {
    // Autoplius specific patterns
    const titleMatch = html.match(/<h1[^>]*class="[^"]*announcement-title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Price: look for specific autoplius format
    const priceMatch = html.match(/(\d{1,3}[\s\u00a0]?\d{3})\s*€/i) ||
                       html.match(/class="[^"]*price[^"]*"[^>]*>[\s\S]*?(\d{1,3}[\s\u00a0]?\d{3})/i);
    if (priceMatch) {
      price = parseInt(priceMatch[1].replace(/[\s\u00a0]/g, ''));
    }

    // Year from URL or content
    const yearMatch = url.match(/-(\d{4})-/) || html.match(/(\d{4})\s*m\./i) ||
                      html.match(/Pagaminimo data[^<]*(\d{4})/i);
    if (yearMatch) {
      const y = parseInt(yearMatch[1]);
      if (y >= 1980 && y <= 2030) year = y;
    }

    // Mileage
    const mileageMatch = html.match(/(\d{1,3}[\s\u00a0]?\d{3})\s*km/i) ||
                         html.match(/Rida[^<]*?(\d{1,3}[\s\u00a0]?\d{3})/i);
    if (mileageMatch) {
      mileage = parseInt(mileageMatch[1].replace(/[\s\u00a0]/g, ''));
    }

    // Brand from URL
    const urlParts = url.split('/');
    const skelbimaiIndex = urlParts.findIndex(p => p === 'skelbimai');
    if (skelbimaiIndex >= 0 && urlParts[skelbimaiIndex + 1]) {
      const carPart = urlParts[skelbimaiIndex + 1];
      const brandMatch = carPart.match(/^([a-z]+)/i);
      if (brandMatch) {
        brand = brandMatch[1].charAt(0).toUpperCase() + brandMatch[1].slice(1);
      }
    }

    return { title, brand, model, year, mileage, price };
  }

  // Generic extraction for other portals
  const titlePatterns = [
    /<h1[^>]*>([^<]+)<\/h1>/i,
    /<title>([^<]+)<\/title>/i,
    /property="og:title"\s+content="([^"]+)"/i,
    /name="title"\s+content="([^"]+)"/i,
  ];

  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (!candidate.toLowerCase().includes('i found this') &&
          !candidate.toLowerCase().includes('schadeautos.nl') &&
          !candidate.toLowerCase().includes('theparking') &&
          candidate.length > 5) {
        title = candidate;
        break;
      }
    }
  }

  // Try to extract from URL if title not found
  if (!title && url) {
    const urlParts = url.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.html?$/i, '');
    if (urlParts && urlParts.length > 5) {
      title = urlParts;
    }
  }

  // Extract brand and model from title
  const carBrands = [
    'Audi', 'BMW', 'Mercedes', 'Mercedes-Benz', 'Volkswagen', 'VW', 'Opel',
    'Ford', 'Peugeot', 'Renault', 'Citroen', 'Citroën', 'Fiat', 'Toyota',
    'Honda', 'Mazda', 'Nissan', 'Hyundai', 'Kia', 'Skoda', 'Škoda', 'Seat',
    'Volvo', 'Porsche', 'Alfa Romeo', 'Jaguar', 'Land Rover', 'Range Rover',
    'Mini', 'Suzuki', 'Mitsubishi', 'Lexus', 'Infiniti', 'Jeep', 'Dodge',
    'Chevrolet', 'Tesla', 'Dacia', 'Smart', 'Cupra', 'DS', 'Genesis'
  ];

  const titleLower = title.toLowerCase();
  for (const b of carBrands) {
    if (titleLower.includes(b.toLowerCase())) {
      brand = b;
      const brandIndex = titleLower.indexOf(b.toLowerCase());
      const afterBrand = title.slice(brandIndex + b.length).trim();
      const modelMatch = afterBrand.match(/^[\s-]*([A-Za-z0-9]+)/);
      if (modelMatch) {
        model = modelMatch[1];
      }
      break;
    }
  }

  // Extract year
  const yearPatterns = [
    /\b(19[89]\d|20[0-2]\d)\b/,
    /Erstzulassung[:\s]+(\d{1,2})\/(\d{4})/i,
    /Bouwjaar[:\s]+(\d{4})/i,
    /Année[:\s]+(\d{4})/i,
    /Year[:\s]+(\d{4})/i,
    /<span>(\d{4})<\/span>/,
    /Jaar[:\s]+(\d{4})/i,
  ];

  for (const pattern of yearPatterns) {
    const match = html.match(pattern);
    if (match) {
      const y = parseInt(match[match.length === 3 ? 2 : 1]);
      if (y >= 1980 && y <= 2030) {
        year = y;
        break;
      }
    }
  }

  // Extract mileage
  const mileagePatterns = [
    /(\d{1,3}[.,]\d{3})\s*km/i,
    /(\d{4,6})\s*km/i,
    /<span>Kilometer<\/span>\s*<span>([^<]+)<\/span>/i,
    /Kilometerstand[:\s]+(\d{1,3}[.,]?\d{3})/i,
    /Kilométrage[:\s]+(\d{1,3}[.,]?\d{3})/i,
    /Mileage[:\s]+(\d{1,3}[.,]?\d{3})/i,
    /Stand[:\s]+(\d{1,3}[.,]?\d{3})\s*km/i,
  ];

  for (const pattern of mileagePatterns) {
    const match = html.match(pattern);
    if (match) {
      const numStr = match[1].replace(/[.,]/g, '');
      const num = parseInt(numStr);
      if (num >= 100 && num <= 999999) {
        mileage = num;
        break;
      }
    }
  }

  // Extract price
  const pricePatterns = [
    /€\s*(\d{1,3}[.,]?\d{3})/,
    /(\d{1,3}[.,]?\d{3})\s*€/,
    /EUR\s*(\d{1,3}[.,]?\d{3})/i,
    /Preis[:\s]+(\d{1,3}[.,]?\d{3})/i,
    /Prix[:\s]+(\d{1,3}[.,]?\d{3})/i,
    /Price[:\s]+(\d{1,3}[.,]?\d{3})/i,
    /"price"[:\s]*"?(\d{1,3}[.,]?\d{3})/i,
    /Prijs[:\s]+(\d{1,3}[.,]?\d{3})/i,
  ];

  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (match) {
      const numStr = match[1].replace(/[.,]/g, '');
      const num = parseInt(numStr);
      if (num >= 100 && num <= 9999999) {
        price = num;
        break;
      }
    }
  }

  return { title, brand, model, year, mileage, price };
}

// Extract images from HTML
function extractImages(html: string, portal: string, listingId: string | null): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  // Portal-specific image extraction
  if (portal === 'autoplius') {
    // Autoplius gallery images - look for specific patterns
    const galleryPatterns = [
      /data-src="([^"]+autoplius[^"]+\.jpg[^"]*)"/gi,
      /src="([^"]+autoplius[^"]+\.jpg[^"]*)"/gi,
      /"big":"([^"]+)"/gi,
      /"original":"([^"]+)"/gi,
      /data-full="([^"]+)"/gi,
    ];

    for (const pattern of galleryPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let imgUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
        const cleaned = cleanImageUrl(imgUrl, portal);
        if (cleaned && !seen.has(cleaned)) {
          seen.add(cleaned);
          images.push(cleaned);
        }
      }
    }
  }

  // Generic image extraction
  // Pattern 1: Standard img src
  const imgSrcPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgSrcPattern.exec(html)) !== null) {
    const cleaned = cleanImageUrl(match[1], portal);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  // Pattern 2: data-src (lazy loading)
  const dataSrcPattern = /data-src=["']([^"']+)["']/gi;
  while ((match = dataSrcPattern.exec(html)) !== null) {
    const cleaned = cleanImageUrl(match[1], portal);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  // Pattern 3: srcset
  const srcsetPattern = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetPattern.exec(html)) !== null) {
    const srcset = match[1];
    const srcsetParts = srcset.split(',');
    for (const part of srcsetParts) {
      const src = part.trim().split(' ')[0];
      const cleaned = cleanImageUrl(src, portal);
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        images.push(cleaned);
      }
    }
  }

  // Pattern 4: JSON-LD structured data
  const jsonLdPattern = /"image"\s*:\s*\[([^\]]+)\]/gi;
  while ((match = jsonLdPattern.exec(html)) !== null) {
    const urls = match[1].match(/"([^"]+)"/g);
    if (urls) {
      for (const urlStr of urls) {
        const url = urlStr.replace(/"/g, '');
        const cleaned = cleanImageUrl(url, portal);
        if (cleaned && !seen.has(cleaned)) {
          seen.add(cleaned);
          images.push(cleaned);
        }
      }
    }
  }

  // Pattern 5: Background images in style
  const bgPattern = /background(?:-image)?:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
  while ((match = bgPattern.exec(html)) !== null) {
    const cleaned = cleanImageUrl(match[1], portal);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  // Pattern 6: data-lazy-src
  const lazyPattern = /data-lazy-src=["']([^"']+)["']/gi;
  while ((match = lazyPattern.exec(html)) !== null) {
    const cleaned = cleanImageUrl(match[1], portal);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  // Filter by listing ID to remove "similar cars" images
  let filteredImages = filterByListingId(images, listingId, portal);

  // Sort by quality (prefer larger images)
  filteredImages.sort((a, b) => {
    const aHasSize = a.match(/\/(\d{3,4})\//);
    const bHasSize = b.match(/\/(\d{3,4})\//);
    const aSize = aHasSize ? parseInt(aHasSize[1]) : 500;
    const bSize = bHasSize ? parseInt(bHasSize[1]) : 500;
    return bSize - aSize;
  });

  // Limit to reasonable number
  return filteredImages.slice(0, 30);
}

// Get Firecrawl options based on portal
function getFirecrawlOptions(portal: string, url: string) {
  const baseOptions = {
    url,
    formats: ['html'],
    waitFor: 3000,
    timeout: 30000,
  };

  // Portals that need extra protection bypass
  const protectedPortals = ['autoplius', 'mobile', 'autoscout24', 'kleinanzeigen'];

  if (protectedPortals.includes(portal)) {
    return {
      ...baseOptions,
      waitFor: 5000,
      timeout: 45000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'lt-LT,lt;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6,nl;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      // Try to use proxy/residential IP if available
      actions: [
        { type: 'wait', milliseconds: 2000 },
        { type: 'scroll', direction: 'down', amount: 500 },
        { type: 'wait', milliseconds: 1000 },
      ],
    };
  }

  return {
    ...baseOptions,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5,nl;q=0.3,de;q=0.2',
    },
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { listingUrl } = await req.json();

    if (!listingUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing listingUrl parameter' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Processing URL:', listingUrl);

    const portal = detectPortal(listingUrl);
    const listingId = extractListingId(listingUrl, portal);

    console.log('Detected portal:', portal, 'Listing ID:', listingId);

    // Get Firecrawl API key
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY') || Deno.env.get('FIRECRAWL_API_KEY_1');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get portal-specific options
    const firecrawlOptions = getFirecrawlOptions(portal, listingUrl);

    // Call Firecrawl API
    console.log('Calling Firecrawl API with options:', JSON.stringify(firecrawlOptions, null, 2));

    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(firecrawlOptions),
    });

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      console.error('Firecrawl error:', errorText);

      return new Response(
        JSON.stringify({
          success: true,
          images: [],
          title: '',
          brand: '',
          model: '',
          year: null,
          mileage: null,
          price: null,
          warning: 'Could not fetch page content: ' + errorText.substring(0, 100),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlData = await firecrawlResponse.json();
    const html = firecrawlData.data?.html || '';

    console.log('Got HTML, length:', html.length);

    // Check for blocking patterns
    const blockingPatterns: Record<string, string[]> = {
      schadeautos: ['Vind jouw schadeauto', 'Welkom bij Schadeautos.nl'],
      mobile: ['Zugriff verweigert', 'Access Denied', 'captcha'],
      autoplius: ['Prašome palaukti', 'captcha', 'robot'],
      autoscout24: ['Access Denied', 'captcha'],
    };

    const patterns = blockingPatterns[portal] || [];
    const isBlocked = patterns.some(p => html.toLowerCase().includes(p.toLowerCase())) || html.length < 2000;

    if (isBlocked && portal !== 'generic') {
      console.log(`${portal} appears to be blocked`);
      return new Response(
        JSON.stringify({
          success: true,
          images: [],
          title: '',
          brand: '',
          model: '',
          year: null,
          mileage: null,
          price: null,
          warning: `${portal} blokuoja automatinę prieigą. Pridėkite nuotraukas rankiniu būdu.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract data
    const images = extractImages(html, portal, listingId);
    const details = extractCarDetails(html, listingUrl, portal);

    console.log('Extracted', images.length, 'images');
    console.log('Details:', JSON.stringify(details));

    return new Response(
      JSON.stringify({
        success: true,
        images,
        ...details,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);

    return new Response(
      JSON.stringify({
        success: true,
        images: [],
        title: '',
        brand: '',
        model: '',
        year: null,
        mileage: null,
        price: null,
        warning: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
