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

function extractDetails(html: string, url: string): ScrapedData['details'] {
  const details: ScrapedData['details'] = {};
  
  // Try to extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    details.title = titleMatch[1].trim();
  }

  // Try to extract from Open Graph or meta tags
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitle) {
    details.title = ogTitle[1].trim();
  }

  // Schadeautos.nl specific patterns
  if (url.includes('schadeautos.nl')) {
    // Title usually contains brand and model
    const h1Match = html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                    html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      const title = h1Match[1].trim();
      details.title = title;
      
      // Try to extract brand (first word usually)
      const words = title.split(/[\s-]+/);
      if (words.length > 0) {
        details.brand = words[0].toUpperCase();
        if (words.length > 1) {
          details.model = words.slice(1, 3).join(' ');
        }
      }
    }
    
    // Look for year pattern
    const yearMatch = html.match(/\b(20[0-2][0-9]|19[9][0-9])\b/);
    if (yearMatch) {
      details.year = yearMatch[1];
    }
    
    // Look for mileage
    const mileageMatch = html.match(/(\d{1,3}[.,]?\d{3})\s*km/i) ||
                         html.match(/mileage[^>]*>([^<]*\d+[^<]*)</i);
    if (mileageMatch) {
      details.mileage = mileageMatch[1].replace(/[.,]/g, '');
    }
    
    // Look for price
    const priceMatch = html.match(/€\s*([\d.,]+)/i) ||
                       html.match(/([\d.,]+)\s*€/i) ||
                       html.match(/price[^>]*>.*?€?\s*([\d.,]+)/i);
    if (priceMatch) {
      details.price = priceMatch[1].replace(/[.,]/g, '');
    }
  }
  
  // LeParking specific
  if (url.includes('leparking')) {
    const brandMatch = html.match(/itemprop="brand"[^>]*>([^<]+)</i) ||
                       html.match(/data-brand="([^"]+)"/i);
    if (brandMatch) details.brand = brandMatch[1].trim().toUpperCase();
    
    const modelMatch = html.match(/itemprop="model"[^>]*>([^<]+)</i) ||
                       html.match(/data-model="([^"]+)"/i);
    if (modelMatch) details.model = modelMatch[1].trim();
    
    const yearMatch = html.match(/itemprop="releaseDate"[^>]*>(\d{4})/i) ||
                      html.match(/"year":\s*"?(\d{4})"?/i);
    if (yearMatch) details.year = yearMatch[1];
    
    const mileageMatch = html.match(/itemprop="mileage"[^>]*>([^<]+)</i) ||
                         html.match(/"mileage":\s*"?(\d+)"?/i);
    if (mileageMatch) details.mileage = mileageMatch[1].replace(/\D/g, '');
    
    const priceMatch = html.match(/itemprop="price"[^>]*content="(\d+)"/i) ||
                       html.match(/"price":\s*"?(\d+)"?/i);
    if (priceMatch) details.price = priceMatch[1];
  }

  // AutoScout24 specific
  if (url.includes('autoscout24')) {
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonContent = match.replace(/<[^>]+>/g, '');
          const data = JSON.parse(jsonContent);
          if (data['@type'] === 'Car' || data['@type'] === 'Vehicle') {
            if (data.brand?.name) details.brand = data.brand.name.toUpperCase();
            if (data.model) details.model = data.model;
            if (data.vehicleModelDate) details.year = data.vehicleModelDate;
            if (data.mileageFromOdometer?.value) details.mileage = String(data.mileageFromOdometer.value);
            if (data.offers?.price) details.price = String(data.offers.price);
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    }
  }

  // Mobile.de specific
  if (url.includes('mobile.de')) {
    const brandMatch = html.match(/"make":\s*"([^"]+)"/i);
    if (brandMatch) details.brand = brandMatch[1].toUpperCase();
    
    const modelMatch = html.match(/"model":\s*"([^"]+)"/i);
    if (modelMatch) details.model = modelMatch[1];
    
    const yearMatch = html.match(/"firstRegistration":\s*"(\d{4})/i);
    if (yearMatch) details.year = yearMatch[1];
    
    const mileageMatch = html.match(/"mileage":\s*(\d+)/i);
    if (mileageMatch) details.mileage = mileageMatch[1];
    
    const priceMatch = html.match(/"price":\s*(\d+)/i);
    if (priceMatch) details.price = priceMatch[1];
  }

  return details;
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

    console.log(`Fetching images from: ${listingUrl}`);

    const response = await fetch(listingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch page: ${response.status}`);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch page: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    console.log(`Fetched ${html.length} bytes of HTML`);

    // Extract car details
    const details = extractDetails(html, listingUrl);
    console.log('Extracted details:', details);

    // Extract all images
    const images: string[] = [];

    // Schadeautos.nl specific - get all images from the gallery
    if (listingUrl.includes('schadeautos.nl')) {
      // Main gallery images
      const galleryRegex = /https:\/\/www\.schadeautos\.nl\/cache\/picture\/\d+\/\d+\/[^"'\s]+\.jpg/gi;
      const galleryMatches = html.match(galleryRegex) || [];
      images.push(...galleryMatches);
      
      // Also look for srcset images
      const srcsetRegex = /srcset="([^"]+)"/gi;
      let srcsetMatch;
      while ((srcsetMatch = srcsetRegex.exec(html)) !== null) {
        const srcset = srcsetMatch[1];
        const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
        for (const url of urls) {
          if (url.includes('schadeautos.nl') && url.includes('.jpg')) {
            images.push(url);
          }
        }
      }

      // Look for data-src attributes (lazy loaded images)
      const dataSrcRegex = /data-src="(https:\/\/www\.schadeautos\.nl[^"]+\.jpg)"/gi;
      let dataSrcMatch;
      while ((dataSrcMatch = dataSrcRegex.exec(html)) !== null) {
        images.push(dataSrcMatch[1]);
      }

      // Look for any img src with schadeautos
      const imgSrcRegex = /<img[^>]+src="(https:\/\/www\.schadeautos\.nl[^"]+\.jpg)"/gi;
      let imgMatch;
      while ((imgMatch = imgSrcRegex.exec(html)) !== null) {
        images.push(imgMatch[1]);
      }
      
      // Also look in JavaScript data
      const jsImageRegex = /"(https:\/\/www\.schadeautos\.nl\/cache\/picture\/[^"]+\.jpg)"/gi;
      let jsMatch;
      while ((jsMatch = jsImageRegex.exec(html)) !== null) {
        images.push(jsMatch[1]);
      }
    }

    // High-quality cloud.leparking URLs
    const cloudLeparkingRegex = /https:\/\/cloud\.leparking\.fr\/[^"'\s)>\]]+\.(?:jpg|jpeg|png|webp)/gi;
    const cloudMatches = html.match(cloudLeparkingRegex) || [];
    images.push(...cloudMatches);

    // Scalethumb URLs - extract original
    const scalethumbRegex = /https:\/\/scalethumb\.leparking\.fr\/unsafe\/\d+x\d+\/smart\/(https[^"'\s)>\]]+)/gi;
    let match;
    while ((match = scalethumbRegex.exec(html)) !== null) {
      if (match[1]) {
        try {
          const decoded = decodeURIComponent(match[1]);
          if (decoded.includes('cloud.leparking.fr')) {
            images.push(decoded);
          }
        } catch (e) {
          // ignore decode errors
        }
      }
    }

    // AutoScout24 patterns
    const autoscoutRegex = /https:\/\/[^"'\s]+autoscout24[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi;
    const autoscoutMatches = html.match(autoscoutRegex) || [];
    images.push(...autoscoutMatches);

    // Mobile.de patterns
    const mobileDeRegex = /https:\/\/[^"'\s]+mobile\.de[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi;
    const mobileDeMatches = html.match(mobileDeRegex) || [];
    images.push(...mobileDeMatches);

    // General image patterns
    const generalPatterns = [
      /https:\/\/res\.cloudinary\.com\/[^"'\s)>\]]+\.(?:jpg|jpeg|png|webp)/gi,
      /<img[^>]+src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi,
    ];
    
    for (const pattern of generalPatterns) {
      const matches = html.match(pattern) || [];
      for (const m of matches) {
        // Extract URL from img tag if needed
        const urlMatch = m.match(/src="([^"]+)"/);
        if (urlMatch) {
          images.push(urlMatch[1]);
        } else if (m.startsWith('http')) {
          images.push(m);
        }
      }
    }

    // Extract from data attributes
    const dataLargeRegex = /data-(?:large|full|original|zoom|hires|highres|big)(?:-src)?=["']([^"']+)["']/gi;
    while ((match = dataLargeRegex.exec(html)) !== null) {
      if (match[1] && (match[1].includes('.jpg') || match[1].includes('.jpeg') || match[1].includes('.png') || match[1].includes('.webp'))) {
        let url = match[1];
        if (url.startsWith('//')) url = 'https:' + url;
        if (url.startsWith('http')) images.push(url);
      }
    }

    // Extract from gallery JavaScript data
    const jsonImageRegex = /"(?:url|src|image|photo|img|href)":\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
    while ((match = jsonImageRegex.exec(html)) !== null) {
      if (match[1]) images.push(match[1]);
    }

    // Filter and dedupe
    const uniqueImages = [...new Set(images)]
      .filter(img => {
        const lower = img.toLowerCase();
        if (lower.includes('logo')) return false;
        if (lower.includes('icon')) return false;
        if (lower.includes('flag')) return false;
        if (lower.includes('avatar')) return false;
        if (lower.includes('placeholder')) return false;
        if (lower.includes('blank')) return false;
        if (lower.includes('spinner')) return false;
        if (lower.includes('loading')) return false;
        if (lower.includes('banner')) return false;
        if (lower.includes('ad-')) return false;
        if (lower.includes('/ads/')) return false;
        if (lower.includes('thumbnail') && !lower.includes('schadeautos')) return false;
        if (img.length < 40) return false;
        return true;
      })
      .map(img => {
        if (img.startsWith('//')) return `https:${img}`;
        return img;
      })
      // Prefer larger images (higher resolution indicators in URL)
      .sort((a, b) => {
        // Prefer schadeautos images with larger cache sizes
        const aSize = a.match(/\/cache\/picture\/(\d+)\//)?.[1] || '0';
        const bSize = b.match(/\/cache\/picture\/(\d+)\//)?.[1] || '0';
        return parseInt(bSize) - parseInt(aSize);
      });

    // Deduplicate by removing size variations
    const seen = new Set<string>();
    const result: string[] = [];
    
    for (const img of uniqueImages) {
      const key = img
        .replace(/\/\d+x\d+\//g, '/')
        .replace(/_\d+x\d+/g, '')
        .replace(/\/cache\/picture\/\d+\//g, '/cache/picture/X/');
      
      if (!seen.has(key) && img.startsWith('http')) {
        seen.add(key);
        result.push(img);
      }
      if (result.length >= 30) break;
    }

    console.log(`Found ${result.length} unique high-quality images`);

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
