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

    // Extract all car images from HTML
    const images: string[] = [];

    // TheParking image patterns (high quality)
    const imagePatterns = [
      /https:\/\/cloud\.leparking\.fr\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
      /https:\/\/scalethumb\.leparking\.fr\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
      /https:\/\/[^"'\s)>]*leparking[^"'\s)>]*\.(?:jpg|jpeg|png|webp)/gi,
      /https:\/\/[^"'\s)>]*schadeautos[^"'\s)>]*\.(?:jpg|jpeg|png|webp)/gi,
      /https:\/\/[^"'\s)>]*cloudinary[^"'\s)>]*\.(?:jpg|jpeg|png|webp)/gi,
    ];

    // Apply patterns
    for (const pattern of imagePatterns) {
      const matches = html.match(pattern) || [];
      images.push(...matches);
    }

    // Extract from img src attributes
    const imgSrcRegex = /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
    const dataSrcRegex = /data-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
    const dataLargeSrcRegex = /data-large(?:-src)?=["']([^"']+)["']/gi;
    const dataOriginalRegex = /data-original=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
    const backgroundRegex = /background(?:-image)?:\s*url\(['"]?([^"')]+\.(?:jpg|jpeg|png|webp)[^"')]*)/gi;

    let match;
    while ((match = imgSrcRegex.exec(html)) !== null) {
      if (match[1]) images.push(match[1]);
    }
    while ((match = dataSrcRegex.exec(html)) !== null) {
      if (match[1]) images.push(match[1]);
    }
    while ((match = dataLargeSrcRegex.exec(html)) !== null) {
      if (match[1]) images.push(match[1]);
    }
    while ((match = dataOriginalRegex.exec(html)) !== null) {
      if (match[1]) images.push(match[1]);
    }
    while ((match = backgroundRegex.exec(html)) !== null) {
      if (match[1]) images.push(match[1]);
    }

    // Filter and dedupe
    const uniqueImages = [...new Set(images)]
      .filter(img => {
        const lower = img.toLowerCase();
        return !lower.includes('logo') && 
               !lower.includes('icon') && 
               !lower.includes('flag') && 
               !lower.includes('avatar') &&
               !lower.includes('placeholder') &&
               !lower.includes('blank') &&
               !lower.includes('spinner') &&
               !lower.includes('loading') &&
               img.length > 30;
      })
      .map(img => {
        if (img.startsWith('//')) return `https:${img}`;
        return img;
      });

    // Extract original URLs from scalethumb URLs (get full resolution)
    const finalImages: string[] = [];
    for (const img of uniqueImages) {
      if (img.includes('scalethumb') && img.includes('/smart/')) {
        const originalMatch = img.match(/\/smart\/(https?.+)$/);
        if (originalMatch && originalMatch[1]) {
          finalImages.push(decodeURIComponent(originalMatch[1]));
          continue;
        }
      }
      finalImages.push(img);
    }

    // Dedupe and filter only http(s) URLs
    const result = [...new Set(finalImages)]
      .filter(img => img.startsWith('http'))
      .slice(0, 50);

    console.log(`Found ${result.length} images`);

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
