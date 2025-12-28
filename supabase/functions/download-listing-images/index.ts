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

async function getSchadeautosImages(listingId: string, html: string): Promise<string[]> {
  const images: string[] = [];
  
  // Extract the main image hash pattern from the page
  const mainImgMatch = html.match(/\/cache\/picture\/\d+\/(\d+)\/([a-f0-9~v]+\.jpg)/i);
  
  if (mainImgMatch) {
    const id = mainImgMatch[1];
    const hash = mainImgMatch[2];
    
    // Get the base hash (without version suffix)
    const baseHash = hash.split('~')[0];
    
    // Add the main image in different sizes
    images.push(`https://www.schadeautos.nl/cache/picture/1200/${id}/${hash}`);
    images.push(`https://www.schadeautos.nl/cache/picture/707/${id}/${hash}`);
  }
  
  // Extract ALL image URLs from HTML with various patterns
  const patterns = [
    // Direct image URLs in HTML
    /https:\/\/www\.schadeautos\.nl\/cache\/picture\/\d+\/\d+\/[a-f0-9~v\.]+\.jpg/gi,
    // In srcset
    /srcset="([^"]+schadeautos\.nl[^"]+)"/gi,
    // In data attributes
    /data-(?:src|image|large|zoom|original)="([^"]+schadeautos\.nl[^"]+\.jpg)"/gi,
    // In JSON/JavaScript
    /"(https?:\\?\/\\?\/[^"]*schadeautos\.nl[^"]*\.jpg)"/gi,
    // Background images
    /url\(['"]?(https:\/\/www\.schadeautos\.nl[^'")\s]+\.jpg)['"]?\)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(html)) !== null) {
      let url = match[1] || match[0];
      // Unescape if needed
      url = url.replace(/\\\//g, '/');
      if (url.includes('schadeautos.nl') && url.includes('.jpg')) {
        images.push(url);
      }
    }
  }
  
  // Try to find more images by modifying the hash slightly (common pattern)
  // Schadeautos often uses sequential image hashes
  if (mainImgMatch) {
    const id = mainImgMatch[1];
    
    // Look for all unique hashes in the HTML
    const hashPattern = new RegExp(`/cache/picture/\\d+/${id}/([a-f0-9]+)(?:~v\\d+)?\\.jpg`, 'gi');
    const foundHashes = new Set<string>();
    let hashMatch;
    while ((hashMatch = hashPattern.exec(html)) !== null) {
      foundHashes.add(hashMatch[1]);
    }
    
    console.log(`Found ${foundHashes.size} unique image hashes for listing ${id}`);
    
    // Generate URLs for all found hashes in high resolution
    for (const hash of foundHashes) {
      images.push(`https://www.schadeautos.nl/cache/picture/1200/${id}/${hash}.jpg`);
      images.push(`https://www.schadeautos.nl/cache/picture/707/${id}/${hash}.jpg`);
    }
  }
  
  return images;
}

function extractAllImages(html: string, url: string): string[] {
  const images: string[] = [];
  
  console.log('Extracting images from URL:', url);
  
  // LEPARKING patterns
  if (url.includes('leparking')) {
    const leparkingRegex = /https:\/\/cloud\.leparking\.fr\/[^"'\s)>\]]+\.(?:jpg|jpeg|png|webp)/gi;
    const matches = html.match(leparkingRegex) || [];
    images.push(...matches);
    
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
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImageMatch) images.push(ogImageMatch[1]);
  
  const imgTagRegex = /<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  let imgMatch;
  while ((imgMatch = imgTagRegex.exec(html)) !== null) {
    images.push(imgMatch[1]);
  }
  
  const dataImgRegex = /data-(?:src|image|original|lazy|full|zoom|large|hires|big)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  while ((imgMatch = dataImgRegex.exec(html)) !== null) {
    images.push(imgMatch[1]);
  }
  
  const jsonImgRegex = /"(?:url|src|image|photo|img|picture|href)":\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  while ((imgMatch = jsonImgRegex.exec(html)) !== null) {
    images.push(imgMatch[1]);
  }
  
  console.log(`General extraction found: ${images.length} image URLs`);
  
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
    
    let excluded = false;
    for (const pattern of excludePatterns) {
      if (pattern.test(img)) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;
    
    if (img.length < 50) continue;
    
    // Create normalized key - prefer larger images
    let normalizedKey = img
      .replace(/\/\d+x\d+\//g, '/SIZE/')
      .replace(/_\d+x\d+/g, '_SIZE')
      .replace(/\/cache\/picture\/\d+\//g, '/cache/picture/X/')
      .replace(/~v\d+/g, '') // Remove version suffix
      .replace(/\?.*$/, '');
    
    const existingImg = seen.get(normalizedKey);
    if (existingImg) {
      // Prefer larger cache size
      const existingSize = parseInt(existingImg.match(/\/cache\/picture\/(\d+)\//)?.[1] || '0');
      const currentSize = parseInt(img.match(/\/cache\/picture\/(\d+)\//)?.[1] || '0');
      if (currentSize > existingSize) {
        seen.set(normalizedKey, img);
      }
    } else {
      seen.set(normalizedKey, img);
    }
  }
  
  const result = Array.from(seen.values()).sort((a, b) => {
    const aSize = parseInt(a.match(/\/cache\/picture\/(\d+)\//)?.[1] || '0');
    const bSize = parseInt(b.match(/\/cache\/picture\/(\d+)\//)?.[1] || '0');
    return bSize - aSize;
  });
  
  console.log(`After filtering: ${result.length} unique images`);
  
  return result.slice(0, 100);
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
    
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY_1') || Deno.env.get('FIRECRAWL_API_KEY');
    
    let html = '';
    
    // Try Firecrawl first for better JavaScript rendering
    if (firecrawlKey) {
      try {
        console.log('Using Firecrawl for scraping...');
        const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: listingUrl,
            formats: ['html', 'links'],
            waitFor: 3000,
          }),
        });
        
        if (firecrawlResponse.ok) {
          const firecrawlData = await firecrawlResponse.json();
          html = firecrawlData.data?.html || firecrawlData.html || '';
          console.log(`Firecrawl fetched ${html.length} bytes`);
        } else {
          const errorData = await firecrawlResponse.json();
          console.log('Firecrawl failed, falling back to direct fetch:', errorData.error);
        }
      } catch (e) {
        console.log('Firecrawl error, falling back to direct fetch:', e);
      }
    }
    
    // Fallback to direct fetch if Firecrawl didn't work
    if (!html) {
      const response = await fetch(listingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5,nl;q=0.3',
          'Cache-Control': 'no-cache',
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
    }
    console.log(`Fetched ${html.length} bytes`);

    // Extract details
    const details = extractDetailsFromHtml(html, listingUrl);
    console.log('Extracted details:', details);

    let allImages: string[] = [];

    // SCHADEAUTOS.NL - special handling
    if (listingUrl.includes('schadeautos.nl')) {
      // Extract listing ID from URL
      const listingIdMatch = listingUrl.match(/\/o\/(\d+)/);
      const listingId = listingIdMatch?.[1] || '';
      
      console.log(`Schadeautos listing ID: ${listingId}`);
      
      // Get images using specialized function
      const schadeautosImages = await getSchadeautosImages(listingId, html);
      allImages.push(...schadeautosImages);
      
      // Also try the gallery API endpoint
      if (listingId) {
        try {
          const galleryUrl = `https://www.schadeautos.nl/api/listing/${listingId}/gallery`;
          console.log(`Trying gallery API: ${galleryUrl}`);
          
          const galleryResponse = await fetch(galleryUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
              'Referer': listingUrl,
            },
          });
          
          if (galleryResponse.ok) {
            const galleryData = await galleryResponse.json();
            console.log('Gallery API response:', JSON.stringify(galleryData).substring(0, 500));
            
            // Try to extract images from various possible response formats
            if (Array.isArray(galleryData)) {
              for (const item of galleryData) {
                if (typeof item === 'string') allImages.push(item);
                else if (item.url) allImages.push(item.url);
                else if (item.src) allImages.push(item.src);
                else if (item.image) allImages.push(item.image);
              }
            } else if (galleryData.images) {
              allImages.push(...galleryData.images);
            } else if (galleryData.data?.images) {
              allImages.push(...galleryData.data.images);
            }
          }
        } catch (e) {
          console.log('Gallery API not available');
        }
        
        // Try another possible endpoint
        try {
          const photosUrl = `https://www.schadeautos.nl/listing/${listingId}/photos.json`;
          const photosResponse = await fetch(photosUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
          });
          
          if (photosResponse.ok) {
            const photosData = await photosResponse.json();
            console.log('Photos API response:', JSON.stringify(photosData).substring(0, 500));
            
            if (Array.isArray(photosData)) {
              allImages.push(...photosData.filter((p: any) => typeof p === 'string'));
            }
          }
        } catch (e) {
          console.log('Photos API not available');
        }
      }
    }
    
    // General image extraction for all sites
    const generalImages = extractAllImages(html, listingUrl);
    allImages.push(...generalImages);
    
    console.log(`Total raw images found: ${allImages.length}`);
    
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
