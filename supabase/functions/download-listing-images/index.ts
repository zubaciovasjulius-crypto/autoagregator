import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching images from: ${listingUrl}`);

    // Scrape the listing page
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: listingUrl,
        formats: ['html'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error('Firecrawl error:', scrapeData.error);
      return new Response(
        JSON.stringify({ success: false, error: scrapeData.error || 'Failed to scrape listing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = scrapeData.data?.html || scrapeData.html || '';

    // Extract all car images from HTML
    const images: string[] = [];

    // TheParking image patterns
    const theParkingPatterns = [
      /https:\/\/cloud\.leparking\.fr\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
      /https:\/\/scalethumb\.leparking\.fr\/[^"'\s)>]+\.(?:jpg|jpeg|png|webp)/gi,
    ];

    // Schadeautos patterns
    const schadeautosPatterns = [
      /https:\/\/[^"'\s)>]*schadeautos[^"'\s)>]*\.(?:jpg|jpeg|png|webp)/gi,
      /https:\/\/[^"'\s)>]*cloudinary[^"'\s)>]*car[^"'\s)>]*\.(?:jpg|jpeg|png|webp)/gi,
    ];

    // General car image patterns
    const generalPatterns = [
      /https:\/\/[^"'\s)>]+(?:\/car\/|\/auto\/|\/vehicle\/|\/gallery\/)[^"'\s)>]*\.(?:jpg|jpeg|png|webp)/gi,
    ];

    // Also extract from img src attributes (high resolution versions)
    const imgSrcRegex = /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
    const dataSrcRegex = /data-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
    const dataLargeSrcRegex = /data-large-src=["']([^"']+)["']/gi;
    const dataOriginalRegex = /data-original=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;

    // Apply all patterns
    const allPatterns = [...theParkingPatterns, ...schadeautosPatterns, ...generalPatterns];
    for (const pattern of allPatterns) {
      const matches = html.match(pattern) || [];
      images.push(...matches);
    }

    // Extract from img tags
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

    // Filter and dedupe
    const uniqueImages = [...new Set(images)]
      .filter(img => {
        // Filter out logos, icons, flags, avatars
        const lower = img.toLowerCase();
        return !lower.includes('logo') && 
               !lower.includes('icon') && 
               !lower.includes('flag') && 
               !lower.includes('avatar') &&
               !lower.includes('placeholder') &&
               !lower.includes('thumbnail') &&
               img.length > 30;
      })
      .map(img => {
        // Convert to full URL if needed
        if (img.startsWith('//')) return `https:${img}`;
        return img;
      })
      // Prefer full-size images (filter out small thumbnails)
      .filter(img => {
        // Keep scalethumb if it's the only option, but prefer cloud.leparking
        if (img.includes('scalethumb') && img.includes('/unsafe/')) {
          // Extract the original URL from scalethumb
          const originalMatch = img.match(/\/smart\/(.+)$/);
          if (originalMatch && originalMatch[1]) {
            return false; // We'll add the original URL instead
          }
        }
        return true;
      });

    // Also try to extract original URLs from scalethumb URLs
    const originalUrls: string[] = [];
    for (const img of images) {
      if (img.includes('scalethumb') && img.includes('/smart/')) {
        const originalMatch = img.match(/\/smart\/(https?.+)$/);
        if (originalMatch && originalMatch[1]) {
          originalUrls.push(decodeURIComponent(originalMatch[1]));
        }
      }
    }

    // Combine and dedupe final list
    const finalImages = [...new Set([...uniqueImages, ...originalUrls])]
      .filter(img => img.startsWith('http'))
      .slice(0, 50); // Limit to 50 images max

    console.log(`Found ${finalImages.length} images`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        images: finalImages,
        count: finalImages.length 
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
