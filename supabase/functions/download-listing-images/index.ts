const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Try to fetch the page directly
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

    // Extract all images
    const images: string[] = [];

    // High-quality cloud.leparking URLs (prefer these)
    const cloudLeparkingRegex = /https:\/\/cloud\.leparking\.fr\/[^"'\s)>\]]+\.(?:jpg|jpeg|png|webp)/gi;
    const cloudMatches = html.match(cloudLeparkingRegex) || [];
    images.push(...cloudMatches);

    // Also get from scalethumb and extract original URLs
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

    // Schadeautos patterns
    const schadeautosPatterns = [
      /https:\/\/[^"'\s)>\]]*schadeautos[^"'\s)>\]]*\.(?:jpg|jpeg|png|webp)/gi,
      /https:\/\/res\.cloudinary\.com\/[^"'\s)>\]]+\.(?:jpg|jpeg|png|webp)/gi,
    ];
    
    for (const pattern of schadeautosPatterns) {
      const matches = html.match(pattern) || [];
      images.push(...matches);
    }

    // Extract from data attributes (often contain high-res versions)
    const dataLargeRegex = /data-(?:large|full|original|zoom|hires|highres|big)(?:-src)?=["']([^"']+)["']/gi;
    while ((match = dataLargeRegex.exec(html)) !== null) {
      if (match[1] && (match[1].includes('.jpg') || match[1].includes('.jpeg') || match[1].includes('.png') || match[1].includes('.webp'))) {
        let url = match[1];
        if (url.startsWith('//')) url = 'https:' + url;
        if (url.startsWith('http')) images.push(url);
      }
    }

    // Extract from gallery/slider JavaScript data
    const jsonImageRegex = /"(?:url|src|image|photo|img)":\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
    while ((match = jsonImageRegex.exec(html)) !== null) {
      if (match[1]) images.push(match[1]);
    }

    // Filter and dedupe - prefer high resolution
    const uniqueImages = [...new Set(images)]
      .filter(img => {
        const lower = img.toLowerCase();
        // Filter out non-car images
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
        if (img.length < 40) return false;
        return true;
      })
      .map(img => {
        // Clean up URL
        if (img.startsWith('//')) return `https:${img}`;
        // Remove any trailing parameters that might reduce quality
        return img.split('?')[0];
      })
      // Prefer cloud.leparking.fr (full resolution)
      .sort((a, b) => {
        const aIsCloud = a.includes('cloud.leparking.fr') ? 0 : 1;
        const bIsCloud = b.includes('cloud.leparking.fr') ? 0 : 1;
        return aIsCloud - bIsCloud;
      });

    // Final dedupe and limit
    const seen = new Set<string>();
    const result: string[] = [];
    
    for (const img of uniqueImages) {
      // Create a simplified key for deduplication (remove size variations)
      const key = img.replace(/\/\d+x\d+\//g, '/').replace(/_\d+x\d+/g, '');
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
