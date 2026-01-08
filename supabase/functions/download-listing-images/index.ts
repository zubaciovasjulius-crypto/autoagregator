import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Download image and save to storage, return public URL
async function saveImageToStorage(imageUrl: string, index: number): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    
    // Fetch the image with proper headers
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': new URL(imageUrl).origin + '/',
      },
    });

    if (!imageResponse.ok) {
      console.error(`Failed to fetch image ${index}: ${imageResponse.status}`);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Skip tiny images (likely icons/placeholders)
    if (imageBuffer.byteLength < 5000) {
      console.log(`Skipping tiny image ${index}: ${imageBuffer.byteLength} bytes`);
      return null;
    }
    
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Determine file extension
    let extension = 'jpg';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('webp')) extension = 'webp';

    // Create unique filename
    const filename = `scraped/${Date.now()}_${index}_${Math.random().toString(36).substring(7)}.${extension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('listing-images')
      .upload(filename, imageBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`Upload error for image ${index}:`, uploadError.message);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('listing-images')
      .getPublicUrl(filename);

    console.log(`Saved image ${index}: ${urlData.publicUrl} (${imageBuffer.byteLength} bytes)`);
    return urlData.publicUrl;
  } catch (error) {
    console.error(`Error saving image ${index}:`, error);
    return null;
  }
}

// ========== PORTAL DETECTION ==========
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
  if (u.includes('autogidas.lt')) return 'autogidas';
  if (u.includes('autoweek.nl')) return 'autoweek';
  return 'generic';
}

// ========== LISTING ID EXTRACTION ==========
function extractListingId(url: string, portal: string): string | null {
  try {
    switch (portal) {
      case 'autoplius':
        // Format: /skelbimai/...-29788369.html or /-1234567890.html
        const autopliusMatch = url.match(/-(\d{6,12})\.html/i) || url.match(/\/(\d{6,12})(?:\.html|\/|$)/);
        return autopliusMatch ? autopliusMatch[1] : null;

      case 'theparking':
        // Format: /...._9462997149.html
        const theparkingMatch = url.match(/_(\d{7,15})\.html/i) || url.match(/\/(\d{7,15})(?:\.html|\/|$)/);
        return theparkingMatch ? theparkingMatch[1] : null;

      case 'schadeautos':
        // Format: /o/1234567 or /car/1234567
        const schadeautosMatch = url.match(/\/(?:o|car)\/(\d+)/);
        return schadeautosMatch ? schadeautosMatch[1] : null;

      case 'mobile':
        // Format: /..../123456789.html
        const mobileMatch = url.match(/\/(\d{8,12})(?:\.html|\/|$)/);
        return mobileMatch ? mobileMatch[1] : null;

      case 'autoscout24':
        // Format: /offers/...-uuid or /...?id=123
        const autoscoutMatch = url.match(/\/offers\/[^\/]+-([a-f0-9-]+)$/i) || url.match(/[?&]id=(\d+)/);
        return autoscoutMatch ? autoscoutMatch[1] : null;

      case 'marktplaats':
      case '2dehands':
        // Format: /a/.../m1234567890.html
        const marktplaatsMatch = url.match(/[/m-](\d{8,12})(?:\.html|\/|$)/);
        return marktplaatsMatch ? marktplaatsMatch[1] : null;

      case 'otomoto':
        // Format: /oferta/...-ID123abc.html
        const otomotoMatch = url.match(/ID([A-Za-z0-9]+)\.html/i);
        return otomotoMatch ? otomotoMatch[1] : null;

      case 'autogidas':
        // Format: /skelbimai/...-123456.html
        const autogidasMatch = url.match(/-(\d{5,10})\.html/i);
        return autogidasMatch ? autogidasMatch[1] : null;

      default:
        // Generic ID extraction
        const genericMatch = url.match(/[/-](\d{6,15})(?:\.html|\/|$)/);
        return genericMatch ? genericMatch[1] : null;
    }
  } catch (e) {
    console.error('Error extracting listing ID:', e);
  }
  return null;
}

// ========== IMAGE URL CLEANING & VALIDATION ==========
function isValidCarImage(src: string): boolean {
  if (!src || src.length < 10) return false;

  const srcLower = src.toLowerCase();

  // Skip data URIs, SVGs, tracking pixels
  if (src.startsWith('data:') || srcLower.includes('.svg') || srcLower.includes('1x1') || srcLower.includes('pixel')) {
    return false;
  }

  // Skip non-image extensions
  if (srcLower.includes('.gif') && !srcLower.includes('photos') && !srcLower.includes('image')) {
    return false;
  }

  // Skip common non-car image patterns
  const skipPatterns = [
    // Icons and UI elements
    '/gfx/', '/icons/', '/icon/', 'icon.', 'icons.', '/logo', 'logo.', 'logo-', '-logo',
    '/banner', 'banner.', '/ads/', '/ad/', '/advertisement/', 'advert.',
    'favicon', 'sprite', 'button', 'arrow', 'search.png', 'home.png',
    'loader', 'spinner', 'avatar', 'profile', 'user-icon', 'user.',
    'badge', 'flag', 'rating', 'star', 'check', 'verified', 'tick',
    '/static/icons', '/assets/icons', '/img/icons', '/images/icons',
    'placeholder', 'default.', 'noimage', 'no-image', 'no_image', 'missing',

    // Tracking and analytics
    'carvertical', 'postaffiliate', 'tracking', 'analytics', 'pixel.',
    'googleads', 'doubleclick', 'facebook.com', 'twitter.com', 'linkedin.com',
    'fbcdn', 'cdninstagram', 'gravatar',

    // Portal-specific junk
    'id_categorie', 'modele.leparking.fr', '/visual/SA2-', 'visual/sa2',
    'build-year', 'distance.png', 'fuel.png', 'gearbox.png', 'car-type',
    'dealer-logo', 'dealer_logo', 'watermark', 'brand-logo', 'make-logo',
    '/gfx/build', '/gfx/distance', '/gfx/fuel', '/gfx/gearbox',
    'similar-cars', 'related-ads', 'recommended',

    // Social/sharing
    'share.', 'sharing.', 'whatsapp', 'telegram', 'viber',
    'apple-touch', 'opengraph', 'og-image',

    // Size indicators for tiny images
    '/16/', '/16x', '/20/', '/20x', '/24/', '/24x', '/32/', '/32x',
    '/40/', '/40x', '/48/', '/48x', '/50x', '/60x', '/64x',
    'w=16', 'w=20', 'w=24', 'w=32', 'w=40', 'w=48', 'w=50', 'w=60',
    'h=16', 'h=20', 'h=24', 'h=32', 'h=40', 'h=48', 'h=50', 'h=60',
  ];

  if (skipPatterns.some(pattern => srcLower.includes(pattern))) {
    return false;
  }

  // Must be a likely image URL
  const isLikelyImage = srcLower.includes('.jpg') || srcLower.includes('.jpeg') ||
    srcLower.includes('.png') || srcLower.includes('.webp') ||
    srcLower.includes('/photos/') || srcLower.includes('/images/') ||
    srcLower.includes('/image/') || srcLower.includes('/photo/') ||
    srcLower.includes('/pictures/') || srcLower.includes('/picture/') ||
    srcLower.includes('/gallery/') || srcLower.includes('/cache/') ||
    srcLower.includes('imgix') || srcLower.includes('cloudinary') ||
    srcLower.includes('s3.') || srcLower.includes('cdn.') ||
    srcLower.includes('cloud.') || srcLower.includes('media.');

  return isLikelyImage;
}

function cleanImageUrl(src: string, portal: string, baseUrl?: string): string | null {
  if (!isValidCarImage(src)) return null;

  let cleanUrl = src.trim();

  // Handle relative URLs
  if (cleanUrl.startsWith('//')) {
    cleanUrl = 'https:' + cleanUrl;
  } else if (cleanUrl.startsWith('/') && baseUrl) {
    try {
      const base = new URL(baseUrl);
      cleanUrl = base.origin + cleanUrl;
    } catch {
      return null;
    }
  }

  // Portal-specific URL optimizations for highest quality
  switch (portal) {
    case 'theparking':
      // Upgrade to 2160px version (highest available)
      if (cleanUrl.includes('cloud.leparking.fr')) {
        cleanUrl = cleanUrl.replace(/\/s\/\d+\//, '/s/2160/');
        cleanUrl = cleanUrl.replace(/\/t\/\d+\//, '/s/2160/');
      }
      break;

    case 'schadeautos':
      // Use medium resolution that works with hotlinking
      // Schadeautos blocks very large images but allows smaller cache sizes
      if (cleanUrl.includes('schadeautos.nl/cache')) {
        // Use 640 which is allowed and still decent quality
        cleanUrl = cleanUrl.replace(/\/cache\/picture\/\d+\//, '/cache/picture/640/');
        cleanUrl = cleanUrl.replace(/\/cache\/\d+x\d+\//, '/cache/640x480/');
        cleanUrl = cleanUrl.replace(/\/cache\/(\d{2,3})\//, '/cache/640/');
      }
      break;

    case 'autoplius':
      // Get original size
      cleanUrl = cleanUrl.replace(/\/s\d+x\d+\//, '/original/');
      cleanUrl = cleanUrl.replace(/\/big\//, '/original/');
      cleanUrl = cleanUrl.replace(/\/thumb\//, '/original/');
      cleanUrl = cleanUrl.replace(/\?.*$/, ''); // Remove query params
      break;

    case 'autoscout24':
      // Get full size image
      cleanUrl = cleanUrl.replace(/\/thumbnails\//, '/images/');
      cleanUrl = cleanUrl.replace(/\?rule=.*$/, '');
      cleanUrl = cleanUrl.replace(/\/\d+x\d+\//, '/');
      break;

    case 'mobile':
      // Get largest mobile.de version
      cleanUrl = cleanUrl.replace(/\$_\d+\.JPG/, '$_86.JPG');
      cleanUrl = cleanUrl.replace(/\$_\d+\.jpg/, '$_86.jpg');
      break;

    case 'otomoto':
      // Get 1280x960 version
      cleanUrl = cleanUrl.replace(/;s=\d+x\d+/, ';s=1280x960');
      break;

    case 'marktplaats':
    case '2dehands':
      // Get largest version
      cleanUrl = cleanUrl.replace(/\$_\d+\.JPG/, '$_86.JPG');
      cleanUrl = cleanUrl.replace(/\/\d+x\d+\//, '/');
      break;

    case 'autogidas':
      // Get original size
      cleanUrl = cleanUrl.replace(/\/thumb\//, '/big/');
      cleanUrl = cleanUrl.replace(/\/small\//, '/big/');
      break;
  }

  return cleanUrl;
}

// ========== PORTAL-SPECIFIC IMAGE EXTRACTORS ==========

function extractAutopliusImages(html: string, listingId: string | null): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  console.log('Extracting Autoplius images...');

  // Pattern 1: Gallery JSON data
  const jsonPatterns = [
    /"original"\s*:\s*"([^"]+)"/gi,
    /"big"\s*:\s*"([^"]+)"/gi,
    /"large"\s*:\s*"([^"]+)"/gi,
    /data-full=["']([^"']+autoplius[^"']+)["']/gi,
    /data-original=["']([^"']+autoplius[^"']+)["']/gi,
  ];

  for (const pattern of jsonPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let imgUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
      if (imgUrl.includes('autoplius') && !seen.has(imgUrl)) {
        const cleaned = cleanImageUrl(imgUrl, 'autoplius');
        if (cleaned) {
          seen.add(imgUrl);
          images.push(cleaned);
        }
      }
    }
  }

  // Pattern 2: Direct img tags
  const imgPattern = /(?:src|data-src)=["']([^"']*autoplius[^"']*\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  let match;
  while ((match = imgPattern.exec(html)) !== null) {
    const cleaned = cleanImageUrl(match[1], 'autoplius');
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  // Filter by listing ID if available
  if (listingId && images.length > 0) {
    const filtered = images.filter(img => {
      // Keep images that contain our listing ID or don't have any listing ID in path
      if (img.includes(listingId)) return true;
      const imgIdMatch = img.match(/\/(\d{7,12})\//);
      if (imgIdMatch && imgIdMatch[1] !== listingId) return false;
      return true;
    });
    if (filtered.length > 0) return filtered;
  }

  console.log(`Found ${images.length} Autoplius images`);
  return images;
}

function extractTheParkingImages(html: string, listingId: string | null): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  console.log('Extracting TheParking images, listing ID:', listingId);

  // Pattern 1: cloud.leparking.fr images (main source)
  const cloudPattern = /https?:\/\/cloud\.leparking\.fr\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi;
  let match;
  while ((match = cloudPattern.exec(html)) !== null) {
    const imgUrl = match[0];
    // Skip modele (model example images)
    if (imgUrl.includes('modele.leparking')) continue;

    const cleaned = cleanImageUrl(imgUrl, 'theparking');
    if (cleaned && !seen.has(cleaned)) {
      // Filter by listing ID to exclude "similar cars"
      if (listingId) {
        const imgIdMatch = cleaned.match(/_(\d{7,15})\./);
        if (imgIdMatch && imgIdMatch[1] !== listingId) {
          continue; // Skip images from other listings
        }
      }
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  // Pattern 2: JSON gallery data
  const jsonPattern = /"(?:src|url|image)"\s*:\s*"([^"]*cloud\.leparking\.fr[^"]*)"/gi;
  while ((match = jsonPattern.exec(html)) !== null) {
    const imgUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
    if (!imgUrl.includes('modele.leparking')) {
      const cleaned = cleanImageUrl(imgUrl, 'theparking');
      if (cleaned && !seen.has(cleaned)) {
        if (listingId) {
          const imgIdMatch = cleaned.match(/_(\d{7,15})\./);
          if (imgIdMatch && imgIdMatch[1] !== listingId) continue;
        }
        seen.add(cleaned);
        images.push(cleaned);
      }
    }
  }

  console.log(`Found ${images.length} TheParking images`);
  return images;
}

function extractSchadeautosImages(html: string, listingId: string | null): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  console.log('Extracting Schadeautos images...');

  // Pattern: schadeautos CDN images
  const cdnPattern = /https?:\/\/(?:www\.)?schadeautos\.nl\/cache\/(?:picture\/)?[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi;
  let match;
  while ((match = cdnPattern.exec(html)) !== null) {
    const imgUrl = match[0];
    // Skip visual elements (SA2- is for site graphics)
    if (imgUrl.includes('/visual/') || imgUrl.includes('SA2-')) continue;

    const cleaned = cleanImageUrl(imgUrl, 'schadeautos');
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  // Pattern 2: Relative cache URLs
  const relPattern = /(?:src|data-src)=["']([^"']*\/cache\/[^"']+\.(?:jpg|jpeg|png|webp))["']/gi;
  while ((match = relPattern.exec(html)) !== null) {
    let imgUrl = match[1];
    if (imgUrl.startsWith('/')) {
      imgUrl = 'https://www.schadeautos.nl' + imgUrl;
    }
    if (!imgUrl.includes('/visual/') && !imgUrl.includes('SA2-')) {
      const cleaned = cleanImageUrl(imgUrl, 'schadeautos');
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        images.push(cleaned);
      }
    }
  }

  // Deduplicate by base image hash (keeping highest resolution)
  const imageMap = new Map<string, { url: string; size: number }>();
  for (const img of images) {
    const hashMatch = img.match(/([a-f0-9]{20,})(?:~v\d+)?\.jpg/i);
    if (hashMatch) {
      const hash = hashMatch[1];
      const sizeMatch = img.match(/\/(\d+)(?:x\d+)?\/[a-f0-9]/);
      const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
      const existing = imageMap.get(hash);
      if (!existing || size > existing.size) {
        imageMap.set(hash, { url: img, size });
      }
    } else {
      imageMap.set(img, { url: img, size: 0 });
    }
  }

  const result = [...imageMap.values()].map(v => v.url);
  console.log(`Found ${result.length} Schadeautos images`);
  return result;
}

function extractMobileDeImages(html: string, listingId: string | null): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  console.log('Extracting Mobile.de images...');

  // Pattern 1: i.ebayimg.com (eBay CDN used by mobile.de)
  const ebayPattern = /https?:\/\/i\.ebayimg\.com\/[^"'\s)>]+\.\w{3,4}/gi;
  let match;
  while ((match = ebayPattern.exec(html)) !== null) {
    const cleaned = cleanImageUrl(match[0], 'mobile');
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  // Pattern 2: mobile.de image servers
  const mobilePattern = /https?:\/\/[^"'\s]*mobile\.de[^"'\s]*\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi;
  while ((match = mobilePattern.exec(html)) !== null) {
    const cleaned = cleanImageUrl(match[0], 'mobile');
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  // Pattern 3: JSON gallery data
  const jsonPattern = /"(?:src|url|image(?:Url)?)":\s*"([^"]+(?:ebayimg|mobile\.de)[^"]+)"/gi;
  while ((match = jsonPattern.exec(html)) !== null) {
    const imgUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
    const cleaned = cleanImageUrl(imgUrl, 'mobile');
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  console.log(`Found ${images.length} Mobile.de images`);
  return images;
}

function extractAutoscout24Images(html: string, listingId: string | null): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  console.log('Extracting AutoScout24 images...');

  // Pattern 1: AutoScout24 image CDN
  const cdnPatterns = [
    /https?:\/\/[^"'\s]*autoscout24[^"'\s]*\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
    /https?:\/\/[^"'\s]*as24cdn[^"'\s]*\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
    /https?:\/\/[^"'\s]*prod\.pictures[^"'\s]*\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi,
  ];

  for (const pattern of cdnPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const cleaned = cleanImageUrl(match[0], 'autoscout24');
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        images.push(cleaned);
      }
    }
  }

  // Pattern 2: JSON data
  const jsonPattern = /"(?:src|url|imageUrl|image)":\s*"([^"]*(?:autoscout|as24cdn|prod\.pictures)[^"]*)"/gi;
  let match;
  while ((match = jsonPattern.exec(html)) !== null) {
    const imgUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
    const cleaned = cleanImageUrl(imgUrl, 'autoscout24');
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  console.log(`Found ${images.length} AutoScout24 images`);
  return images;
}

function extractOtomotoImages(html: string, listingId: string | null): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  console.log('Extracting Otomoto images...');

  // Otomoto uses ireland.apollo.olxcdn.com
  const cdnPattern = /https?:\/\/[^"'\s]*olxcdn\.com[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi;
  let match;
  while ((match = cdnPattern.exec(html)) !== null) {
    const cleaned = cleanImageUrl(match[0], 'otomoto');
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  // JSON pattern
  const jsonPattern = /"(?:src|url|image(?:Url)?)":\s*"([^"]*olxcdn\.com[^"]*)"/gi;
  while ((match = jsonPattern.exec(html)) !== null) {
    const imgUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
    const cleaned = cleanImageUrl(imgUrl, 'otomoto');
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  console.log(`Found ${images.length} Otomoto images`);
  return images;
}

function extractGenericImages(html: string, url: string, listingId: string | null): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  console.log('Extracting generic images...');

  // Pattern 1: Standard img src
  const imgSrcPattern = /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgSrcPattern.exec(html)) !== null) {
    const cleaned = cleanImageUrl(match[1], 'generic', url);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  // Pattern 2: srcset (get largest)
  const srcsetPattern = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetPattern.exec(html)) !== null) {
    const srcset = match[1];
    const parts = srcset.split(',').map(p => p.trim().split(' '));
    // Sort by size (if available) and get the largest
    const sorted = parts
      .filter(p => p[0])
      .sort((a, b) => {
        const aSize = a[1] ? parseInt(a[1]) : 0;
        const bSize = b[1] ? parseInt(b[1]) : 0;
        return bSize - aSize;
      });

    if (sorted.length > 0) {
      const cleaned = cleanImageUrl(sorted[0][0], 'generic', url);
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        images.push(cleaned);
      }
    }
  }

  // Pattern 3: JSON-LD images
  const jsonLdPattern = /"image"\s*:\s*(?:\[([^\]]+)\]|"([^"]+)")/gi;
  while ((match = jsonLdPattern.exec(html)) !== null) {
    const content = match[1] || match[2];
    const urls = content.match(/"([^"]+)"/g) || [content];
    for (const urlStr of urls) {
      const imgUrl = urlStr.replace(/"/g, '');
      const cleaned = cleanImageUrl(imgUrl, 'generic', url);
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        images.push(cleaned);
      }
    }
  }

  // Pattern 4: Background images
  const bgPattern = /background(?:-image)?:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
  while ((match = bgPattern.exec(html)) !== null) {
    const cleaned = cleanImageUrl(match[1], 'generic', url);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      images.push(cleaned);
    }
  }

  console.log(`Found ${images.length} generic images`);
  return images;
}

// ========== MAIN IMAGE EXTRACTION ==========
function extractImages(html: string, portal: string, listingId: string | null, url: string): string[] {
  let images: string[] = [];

  switch (portal) {
    case 'autoplius':
      images = extractAutopliusImages(html, listingId);
      break;
    case 'theparking':
      images = extractTheParkingImages(html, listingId);
      break;
    case 'schadeautos':
      images = extractSchadeautosImages(html, listingId);
      break;
    case 'mobile':
      images = extractMobileDeImages(html, listingId);
      break;
    case 'autoscout24':
      images = extractAutoscout24Images(html, listingId);
      break;
    case 'otomoto':
      images = extractOtomotoImages(html, listingId);
      break;
    default:
      images = extractGenericImages(html, url, listingId);
  }

  // Fallback to generic extraction if portal-specific found nothing
  if (images.length === 0) {
    console.log('No images from portal-specific extractor, trying generic...');
    images = extractGenericImages(html, url, listingId);
  }

  // Remove duplicates and limit
  const unique = [...new Set(images)];

  // Sort by quality (prefer larger sizes in URL)
  unique.sort((a, b) => {
    const aSize = extractImageSize(a);
    const bSize = extractImageSize(b);
    return bSize - aSize;
  });

  return unique.slice(0, 30);
}

function extractImageSize(url: string): number {
  // Try to extract size from URL
  const sizePatterns = [
    /\/(\d{3,4})x(\d{3,4})\//,
    /\/s\/(\d{3,4})\//,
    /\/(\d{3,4})\//,
    /[?&]w=(\d{3,4})/,
    /[?&]width=(\d{3,4})/,
  ];

  for (const pattern of sizePatterns) {
    const match = url.match(pattern);
    if (match) {
      return parseInt(match[1]) || 0;
    }
  }
  return 500; // Default medium size
}

// ========== CAR DETAILS EXTRACTION ==========

const CAR_BRANDS = [
  'Abarth', 'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW',
  'Bugatti', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Citroen', 'Citroën', 'Cupra',
  'Dacia', 'Daewoo', 'Daihatsu', 'Dodge', 'DS', 'Ferrari', 'Fiat', 'Ford',
  'Genesis', 'GMC', 'Honda', 'Hummer', 'Hyundai', 'Infiniti', 'Isuzu',
  'Jaguar', 'Jeep', 'Kia', 'Koenigsegg', 'Lada', 'Lamborghini', 'Lancia',
  'Land Rover', 'Lexus', 'Lincoln', 'Lotus', 'Maserati', 'Maybach', 'Mazda',
  'McLaren', 'Mercedes', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan',
  'Opel', 'Pagani', 'Peugeot', 'Plymouth', 'Polestar', 'Pontiac', 'Porsche',
  'RAM', 'Range Rover', 'Renault', 'Rolls-Royce', 'Saab', 'Seat', 'SEAT',
  'Skoda', 'Škoda', 'Smart', 'SsangYong', 'Subaru', 'Suzuki', 'Tesla', 'Toyota',
  'Vauxhall', 'Volkswagen', 'VW', 'Volvo'
];

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

  // ===== PORTAL-SPECIFIC EXTRACTION =====

  if (portal === 'autoplius') {
    // Autoplius specific patterns
    const titlePatterns = [
      /<h1[^>]*class="[^"]*announcement-title[^"]*"[^>]*>([^<]+)<\/h1>/i,
      /<h1[^>]*>([^<]+)<\/h1>/i,
      /property="og:title"\s+content="([^"]+)"/i,
    ];

    for (const pattern of titlePatterns) {
      const match = html.match(pattern);
      if (match && match[1] && !match[1].toLowerCase().includes('autoplius')) {
        title = match[1].trim();
        break;
      }
    }

    // Price: specific autoplius format
    const pricePatterns = [
      /class="[^"]*price[^"]*"[^>]*>[\s\S]*?(\d{1,3}[\s\u00a0]?\d{3})\s*€/i,
      /(\d{1,3}[\s\u00a0]?\d{3})\s*€/i,
      /€\s*(\d{1,3}[\s\u00a0]?\d{3})/i,
    ];

    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match) {
        const p = parseInt(match[1].replace(/[\s\u00a0]/g, ''));
        if (p >= 100 && p <= 500000) {
          price = p;
          break;
        }
      }
    }

    // Year from URL or content
    const yearPatterns = [
      /-(\d{4})-metai/i,
      /-(\d{4})-m\./i,
      /-(\d{4})-/,
      /(\d{4})\s*m\./i,
      /Pagaminimo data[^<]*(\d{4})/i,
      /Metai[:\s]+(\d{4})/i,
    ];

    for (const pattern of yearPatterns) {
      const match = url.match(pattern) || html.match(pattern);
      if (match) {
        const y = parseInt(match[1]);
        if (y >= 1980 && y <= 2030) {
          year = y;
          break;
        }
      }
    }

    // Mileage
    const mileagePatterns = [
      /Rida[^<]*?(\d{1,3}[\s\u00a0]?\d{3})\s*km/i,
      /(\d{1,3}[\s\u00a0]?\d{3})\s*km/i,
    ];

    for (const pattern of mileagePatterns) {
      const match = html.match(pattern);
      if (match) {
        const m = parseInt(match[1].replace(/[\s\u00a0]/g, ''));
        if (m >= 100 && m <= 999999) {
          mileage = m;
          break;
        }
      }
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
  }

  else if (portal === 'theparking') {
    // TheParking specific patterns
    const titlePatterns = [
      /<h1[^>]*>([^<]+)<\/h1>/i,
      /property="og:title"\s+content="([^"]+)"/i,
      /<title>([^<]+)<\/title>/i,
    ];

    for (const pattern of titlePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim();
        // Skip sharing/meta titles
        if (!candidate.toLowerCase().includes('i found this') &&
            !candidate.toLowerCase().includes('theparking') &&
            !candidate.toLowerCase().includes('leparking') &&
            candidate.length > 5) {
          title = candidate;
          break;
        }
      }
    }

    // Price
    const priceMatch = html.match(/€\s*(\d{1,3}[.,\s]?\d{3})/) ||
                       html.match(/(\d{1,3}[.,\s]?\d{3})\s*€/);
    if (priceMatch) {
      const p = parseInt(priceMatch[1].replace(/[.,\s]/g, ''));
      if (p >= 100 && p <= 500000) {
        price = p;
      }
    }

    // Year - look for 4-digit year
    const yearMatch = html.match(/<span>(\d{4})<\/span>/) ||
                      html.match(/\b(19[89]\d|20[0-2]\d)\b/);
    if (yearMatch) {
      const y = parseInt(yearMatch[1]);
      if (y >= 1980 && y <= 2030) {
        year = y;
      }
    }

    // Mileage - TheParking format: <span>Kilometer</span><span>112,000</span>
    const mileagePatterns = [
      /<span>Kilometer<\/span>\s*<span>([^<]+)<\/span>/i,
      /<span>Kilomètres<\/span>\s*<span>([^<]+)<\/span>/i,
      /Kilometer[:\s]+([0-9,.\s]+)/i,
      /(\d{1,3}[.,]\d{3})\s*km/i,
    ];

    for (const pattern of mileagePatterns) {
      const match = html.match(pattern);
      if (match) {
        const m = parseInt(match[1].replace(/[.,\s]/g, ''));
        if (m >= 100 && m <= 999999) {
          mileage = m;
          break;
        }
      }
    }
  }

  else if (portal === 'schadeautos') {
    // Schadeautos specific patterns
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch && !titleMatch[1].toLowerCase().includes('schadeautos')) {
      title = titleMatch[1].trim();
    }

    // Price
    const priceMatch = html.match(/€\s*(\d{1,3}[.,]?\d{3})/) ||
                       html.match(/(\d{1,3}[.,]\d{3})\s*€/);
    if (priceMatch) {
      const p = parseInt(priceMatch[1].replace(/[.,]/g, ''));
      if (p >= 100 && p <= 200000) {
        price = p;
      }
    }

    // Year
    const yearMatch = html.match(/Bouwjaar[:\s]+(\d{4})/i) ||
                      html.match(/Jaar[:\s]+(\d{4})/i) ||
                      html.match(/<span>(\d{4})<\/span>/);
    if (yearMatch) {
      const y = parseInt(yearMatch[1]);
      if (y >= 1980 && y <= 2030) {
        year = y;
      }
    }

    // Mileage
    const mileageMatch = html.match(/Kilometerstand[:\s]+([0-9.,]+)/i) ||
                         html.match(/(\d{1,3}[.,]?\d{3})\s*km/i);
    if (mileageMatch) {
      const m = parseInt(mileageMatch[1].replace(/[.,]/g, ''));
      if (m >= 100 && m <= 999999) {
        mileage = m;
      }
    }
  }

  else if (portal === 'mobile') {
    // Mobile.de specific
    const titleMatch = html.match(/<h1[^>]*id="ad-title"[^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Price
    const priceMatch = html.match(/(\d{1,3}[.,]\d{3})\s*€/) ||
                       html.match(/€\s*(\d{1,3}[.,]?\d{3})/);
    if (priceMatch) {
      const p = parseInt(priceMatch[1].replace(/[.,]/g, ''));
      if (p >= 100 && p <= 500000) {
        price = p;
      }
    }

    // Year (Erstzulassung = first registration)
    const yearMatch = html.match(/Erstzulassung[:\s]+(\d{1,2})\/(\d{4})/i) ||
                      html.match(/EZ[:\s]+(\d{1,2})\/(\d{4})/i) ||
                      html.match(/\b(20[0-2]\d|19[89]\d)\b/);
    if (yearMatch) {
      const y = parseInt(yearMatch[yearMatch.length === 3 ? 2 : 1]);
      if (y >= 1980 && y <= 2030) {
        year = y;
      }
    }

    // Mileage
    const mileageMatch = html.match(/Kilometerstand[:\s]+([0-9.,]+)/i) ||
                         html.match(/(\d{1,3}[.,]\d{3})\s*km/i);
    if (mileageMatch) {
      const m = parseInt(mileageMatch[1].replace(/[.,]/g, ''));
      if (m >= 100 && m <= 999999) {
        mileage = m;
      }
    }
  }

  else if (portal === 'autoscout24') {
    // AutoScout24 specific
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Price
    const priceMatch = html.match(/(\d{1,3}[.,'\s]?\d{3})\s*€/) ||
                       html.match(/€\s*(\d{1,3}[.,'\s]?\d{3})/);
    if (priceMatch) {
      const p = parseInt(priceMatch[1].replace(/[.,'\s]/g, ''));
      if (p >= 100 && p <= 500000) {
        price = p;
      }
    }

    // Year
    const yearMatch = html.match(/Erstzulassung[:\s]+(\d{1,2})\/(\d{4})/i) ||
                      html.match(/\b(20[0-2]\d|19[89]\d)\b/);
    if (yearMatch) {
      const y = parseInt(yearMatch[yearMatch.length === 3 ? 2 : 1]);
      if (y >= 1980 && y <= 2030) {
        year = y;
      }
    }

    // Mileage
    const mileageMatch = html.match(/(\d{1,3}[.,'\s]?\d{3})\s*km/i);
    if (mileageMatch) {
      const m = parseInt(mileageMatch[1].replace(/[.,'\s]/g, ''));
      if (m >= 100 && m <= 999999) {
        mileage = m;
      }
    }
  }

  // ===== GENERIC FALLBACK EXTRACTION =====
  if (!title) {
    const genericTitlePatterns = [
      /<h1[^>]*>([^<]+)<\/h1>/i,
      /property="og:title"\s+content="([^"]+)"/i,
      /name="title"\s+content="([^"]+)"/i,
      /<title>([^<]+)<\/title>/i,
    ];

    for (const pattern of genericTitlePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim()
          .replace(/ - .*$/, '')  // Remove site name suffix
          .replace(/ \| .*$/, ''); // Remove site name suffix

        if (candidate.length > 5 &&
            !candidate.toLowerCase().includes('home') &&
            !candidate.toLowerCase().includes('search') &&
            !candidate.toLowerCase().includes('404')) {
          title = candidate;
          break;
        }
      }
    }
  }

  // Extract from URL if title still not found
  if (!title) {
    const urlParts = url.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.html?$/i, '');
    if (urlParts && urlParts.length > 5) {
      title = urlParts.split(/\d{6,}/).join(' ').trim();
    }
  }

  // ===== BRAND AND MODEL FROM TITLE =====
  if (title && !brand) {
    const titleLower = title.toLowerCase();
    for (const b of CAR_BRANDS) {
      if (titleLower.includes(b.toLowerCase())) {
        brand = b;
        const brandIndex = titleLower.indexOf(b.toLowerCase());
        const afterBrand = title.slice(brandIndex + b.length).trim();
        const modelMatch = afterBrand.match(/^[\s-]*([A-Za-z0-9]+(?:[-\s][A-Za-z0-9]+)?)/);
        if (modelMatch && modelMatch[1].length <= 20) {
          model = modelMatch[1].trim();
        }
        break;
      }
    }
  }

  // Normalize VW -> Volkswagen
  if (brand.toUpperCase() === 'VW') {
    brand = 'Volkswagen';
  }
  if (brand.toUpperCase() === 'MERCEDES-BENZ') {
    brand = 'Mercedes';
  }

  // ===== FALLBACK YEAR/MILEAGE/PRICE =====
  if (!year) {
    const yearMatch = html.match(/\b(19[89]\d|20[0-2]\d)\b/);
    if (yearMatch) {
      const y = parseInt(yearMatch[1]);
      if (y >= 1985 && y <= 2030) {
        year = y;
      }
    }
  }

  if (!mileage) {
    const mileageMatch = html.match(/(\d{1,3}[.,\s]?\d{3})\s*km/i);
    if (mileageMatch) {
      const m = parseInt(mileageMatch[1].replace(/[.,\s]/g, ''));
      if (m >= 100 && m <= 999999) {
        mileage = m;
      }
    }
  }

  if (!price) {
    const priceMatch = html.match(/€\s*(\d{1,3}[.,\s]?\d{3})/) ||
                       html.match(/(\d{1,3}[.,\s]?\d{3})\s*€/);
    if (priceMatch) {
      const p = parseInt(priceMatch[1].replace(/[.,\s]/g, ''));
      if (p >= 100 && p <= 500000) {
        price = p;
      }
    }
  }

  console.log('Extracted details:', { title, brand, model, year, mileage, price });

  return { title, brand, model, year, mileage, price };
}

// ========== FIRECRAWL OPTIONS ==========
function getFirecrawlOptions(portal: string, url: string) {
  const baseOptions = {
    url,
    formats: ['html'],
    waitFor: 3000,
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'lt-LT,lt;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6,nl;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  };

  // Protected portals need extra options
  const protectedPortals = ['autoplius', 'mobile', 'autoscout24', 'kleinanzeigen', 'otomoto'];

  if (protectedPortals.includes(portal)) {
    return {
      ...baseOptions,
      waitFor: 5000,
      timeout: 60000,
      headers: {
        ...baseOptions.headers,
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
      actions: [
        { type: 'wait', milliseconds: 2000 },
        { type: 'scroll', direction: 'down', amount: 1000 },
        { type: 'wait', milliseconds: 1500 },
        { type: 'scroll', direction: 'down', amount: 1000 },
        { type: 'wait', milliseconds: 1000 },
      ],
    };
  }

  return baseOptions;
}

// ========== DIRECT FETCH FALLBACK (FREE) ==========
async function scrapeWithDirectFetch(url: string, portal: string): Promise<string | null> {
  try {
    console.log('Trying direct fetch for:', url);

    // Use mobile URL for autoplius if not already mobile
    let fetchUrl = url;
    if (portal === 'autoplius' && !url.includes('m.autoplius')) {
      fetchUrl = url.replace('://autoplius.lt', '://m.autoplius.lt')
                    .replace('://www.autoplius.lt', '://m.autoplius.lt');
    }

    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'lt-LT,lt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      console.error('Direct fetch error:', response.status);
      return null;
    }

    const html = await response.text();
    console.log('Direct fetch got', html.length, 'bytes');
    return html;
  } catch (error) {
    console.error('Direct fetch error:', error);
    return null;
  }
}

// ========== SCRAPINGBEE PROXY FALLBACK ==========
async function scrapeWithScrapingBee(url: string, portal: string): Promise<string | null> {
  const apiKey = Deno.env.get('SCRAPINGBEE_API_KEY');
  if (!apiKey) {
    console.log('ScrapingBee API key not configured, skipping proxy fallback');
    return null;
  }

  try {
    console.log('Trying ScrapingBee proxy for:', url);

    const params = new URLSearchParams({
      api_key: apiKey,
      url: url,
      render_js: 'true',
      premium_proxy: 'true',
      country_code: portal === 'autoplius' ? 'lt' : 'de',
      wait: '5000',
      wait_for: 'img',
    });

    const response = await fetch(`https://app.scrapingbee.com/api/v1?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      console.error('ScrapingBee error:', response.status, await response.text());
      return null;
    }

    const html = await response.text();
    console.log('ScrapingBee got', html.length, 'bytes');
    return html;
  } catch (error) {
    console.error('ScrapingBee error:', error);
    return null;
  }
}

// ========== BLOCKING DETECTION ==========
function isBlockedResponse(html: string, portal: string): boolean {
  if (html.length < 500) return true;

  // For schadeautos, check if we have actual car images in the HTML
  if (portal === 'schadeautos') {
    // If we have cache images, it's not blocked
    if (html.includes('/cache/') && html.includes('.jpg')) {
      return false;
    }
    // If redirected to home page
    if (html.includes('<body class="home') || (html.includes('Vind jouw schadeauto') && !html.includes('/o/'))) {
      return true;
    }
    return false;
  }

  const blockingPatterns: Record<string, string[]> = {
    mobile: ['Zugriff verweigert', 'Access Denied', 'captcha', 'blocked', 'robot'],
    autoplius: ['Prašome palaukti', 'captcha', 'robot', 'Draudžiama prieiga'],
    autoscout24: ['Access Denied', 'captcha', 'blocked', 'robot'],
    otomoto: ['captcha', 'robot', 'blocked'],
    kleinanzeigen: ['captcha', 'robot', 'blocked', 'Zugriff verweigert'],
  };

  const patterns = blockingPatterns[portal];
  if (!patterns) return false;

  const htmlLower = html.toLowerCase();
  return patterns.some(p => htmlLower.includes(p.toLowerCase()));
}

// ========== MAIN HANDLER ==========
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

    console.log('='.repeat(60));
    console.log('Processing URL:', listingUrl);

    const portal = detectPortal(listingUrl);
    const listingId = extractListingId(listingUrl, portal);

    console.log('Portal:', portal, '| Listing ID:', listingId);

    // Get Firecrawl API key
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY') || Deno.env.get('FIRECRAWL_API_KEY_1');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    let html = '';
    let usedProxy = false;
    let fetchMethod = '';

    // Strategy 1: Try direct fetch first (FREE!)
    console.log('Strategy 1: Trying direct fetch (free)...');
    const directHtml = await scrapeWithDirectFetch(listingUrl, portal);
    if (directHtml && !isBlockedResponse(directHtml, portal)) {
      html = directHtml;
      fetchMethod = 'direct';
      console.log('Direct fetch successful!');
    }

    // Strategy 2: Try Firecrawl if direct fetch failed (only if we have API key and credits)
    if (!html && apiKey) {
      console.log('Strategy 2: Trying Firecrawl...');
      const firecrawlOptions = getFirecrawlOptions(portal, listingUrl);

      try {
        const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(firecrawlOptions),
        });

        const firecrawlData = await firecrawlResponse.json();
        
        // Check if it's a credits error - log but don't fail
        if (!firecrawlResponse.ok) {
          const errorMsg = firecrawlData?.error || 'Unknown error';
          console.error('Firecrawl error:', errorMsg);
          // If credits issue, continue to next strategy
          if (errorMsg.includes('credits') || errorMsg.includes('insufficient')) {
            console.log('Firecrawl credits exhausted, skipping to next strategy...');
          }
        } else {
          const firecrawlHtml = firecrawlData.data?.html || firecrawlData.data?.rawHtml || '';
          if (firecrawlHtml && !isBlockedResponse(firecrawlHtml, portal)) {
            html = firecrawlHtml;
            fetchMethod = 'firecrawl';
            console.log('Firecrawl got', html.length, 'bytes');
          }
        }
      } catch (e) {
        console.error('Firecrawl error:', e);
      }
    }

    // Strategy 3: Try ScrapingBee proxy as last resort
    if (!html || isBlockedResponse(html, portal)) {
      console.log('Strategy 3: Trying ScrapingBee proxy...');
      const proxyHtml = await scrapeWithScrapingBee(listingUrl, portal);
      if (proxyHtml && !isBlockedResponse(proxyHtml, portal)) {
        html = proxyHtml;
        usedProxy = true;
        fetchMethod = 'scrapingbee';
        console.log('ScrapingBee successful');
      }
    }

    // If still blocked or empty, return gracefully
    if (!html || isBlockedResponse(html, portal)) {
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
    const images = extractImages(html, portal, listingId, listingUrl);
    const details = extractCarDetails(html, listingUrl, portal);

    console.log('Extracted', images.length, 'images');
    console.log('Details:', JSON.stringify(details));

    // Download and save images to storage (max 30 images)
    const imagesToSave = images.slice(0, 30);
    console.log(`Saving ${imagesToSave.length} images to storage...`);
    
    const savedImages: string[] = [];
    for (let i = 0; i < imagesToSave.length; i++) {
      const savedUrl = await saveImageToStorage(imagesToSave[i], i);
      if (savedUrl) {
        savedImages.push(savedUrl);
      }
      // Small delay to avoid overwhelming the server
      if (i < imagesToSave.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Successfully saved ${savedImages.length} images to storage`);
    console.log('='.repeat(60));

    return new Response(
      JSON.stringify({
        success: true,
        images: savedImages,
        ...details,
        fetchMethod,
        usedProxy,
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
