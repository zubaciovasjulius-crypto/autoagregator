const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CarListing {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuel: string;
  transmission: string;
  location: string;
  country: string;
  source: string;
  sourceUrl: string;
  image: string;
  power: number;
}

interface ScrapeRequest {
  source: 'mobile.de' | 'autoscout24' | 'autoplius';
  brand?: string;
  model?: string;
  maxPrice?: number;
  minYear?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { source, brand, model, maxPrice, minYear } = await req.json() as ScrapeRequest;
    
    // Build search URL based on source
    let searchUrl = '';
    
    switch (source) {
      case 'mobile.de':
        searchUrl = buildMobileDeUrl(brand, model, maxPrice, minYear);
        break;
      case 'autoscout24':
        searchUrl = buildAutoScout24Url(brand, model, maxPrice, minYear);
        break;
      case 'autoplius':
        searchUrl = buildAutopliusUrl(brand, model, maxPrice, minYear);
        break;
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown source' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Scraping ${source}: ${searchUrl}`);

    // Use Firecrawl to scrape the page
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error('Firecrawl API error:', scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: scrapeData.error || 'Scraping failed' }),
        { status: scrapeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the scraped content to extract car listings
    const listings = parseListings(scrapeData, source);

    console.log(`Found ${listings.length} listings from ${source}`);

    return new Response(
      JSON.stringify({ success: true, data: listings, source }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping cars:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildMobileDeUrl(brand?: string, model?: string, maxPrice?: number, minYear?: number): string {
  const params = new URLSearchParams();
  params.set('s', 'Car');
  params.set('vc', 'Car');
  if (brand) params.set('ms', brand);
  if (maxPrice) params.set('prt', maxPrice.toString());
  if (minYear) params.set('fr', minYear.toString());
  return `https://suchen.mobile.de/fahrzeuge/search.html?${params.toString()}`;
}

function buildAutoScout24Url(brand?: string, model?: string, maxPrice?: number, minYear?: number): string {
  let url = 'https://www.autoscout24.de/lst';
  if (brand) url += `/${brand.toLowerCase()}`;
  if (model) url += `/${model.toLowerCase()}`;
  
  const params = new URLSearchParams();
  params.set('sort', 'standard');
  params.set('desc', '0');
  if (maxPrice) params.set('priceto', maxPrice.toString());
  if (minYear) params.set('fregfrom', minYear.toString());
  
  return `${url}?${params.toString()}`;
}

function buildAutopliusUrl(brand?: string, model?: string, maxPrice?: number, minYear?: number): string {
  const params = new URLSearchParams();
  params.set('category_id', '2'); // Cars category
  if (brand) params.set('make_id_list', brand);
  if (maxPrice) params.set('sell_price_to', maxPrice.toString());
  if (minYear) params.set('make_date_from', minYear.toString());
  return `https://autoplius.lt/skelbimai/naudoti-automobiliai?${params.toString()}`;
}

function parseListings(scrapeData: any, source: string): CarListing[] {
  const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
  const listings: CarListing[] = [];
  
  // Basic parsing - extract what we can from markdown
  // This is a simplified parser - real implementation would need more sophisticated parsing
  const lines = markdown.split('\n').filter((l: string) => l.trim());
  
  let currentListing: Partial<CarListing> | null = null;
  
  for (const line of lines) {
    // Try to extract price patterns
    const priceMatch = line.match(/(\d{1,3}[.,]?\d{3})\s*€/);
    const yearMatch = line.match(/\b(20[0-2]\d|19\d{2})\b/);
    const kmMatch = line.match(/(\d{1,3}[.,]?\d{3})\s*km/i);
    
    // Look for car brand/model patterns
    const carBrands = ['BMW', 'Mercedes', 'Audi', 'Volkswagen', 'VW', 'Toyota', 'Porsche', 'Tesla', 'Volvo', 'Skoda'];
    const foundBrand = carBrands.find(b => line.toUpperCase().includes(b));
    
    if (foundBrand && !currentListing) {
      currentListing = {
        id: `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: line.slice(0, 100).trim(),
        brand: foundBrand === 'VW' ? 'Volkswagen' : foundBrand,
        source: source,
        sourceUrl: getSourceUrl(source),
        country: getCountryFromSource(source),
        location: getLocationFromSource(source),
        fuel: 'Dyzelinas',
        transmission: 'Automatinė',
        image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80',
      };
    }
    
    if (currentListing) {
      if (priceMatch) currentListing.price = parseInt(priceMatch[1].replace(/[.,]/g, ''));
      if (yearMatch) currentListing.year = parseInt(yearMatch[1]);
      if (kmMatch) currentListing.mileage = parseInt(kmMatch[1].replace(/[.,]/g, ''));
      
      // Check if we have enough data to save this listing
      if (currentListing.price && currentListing.year && currentListing.brand) {
        currentListing.model = currentListing.model || 'Modelis';
        currentListing.power = currentListing.power || 150;
        listings.push(currentListing as CarListing);
        currentListing = null;
        
        // Limit to 20 listings per source
        if (listings.length >= 20) break;
      }
    }
  }
  
  return listings;
}

function getSourceUrl(source: string): string {
  switch (source) {
    case 'mobile.de': return 'https://mobile.de';
    case 'autoscout24': return 'https://autoscout24.de';
    case 'autoplius': return 'https://autoplius.lt';
    default: return '';
  }
}

function getCountryFromSource(source: string): string {
  switch (source) {
    case 'mobile.de': return 'Vokietija';
    case 'autoscout24': return 'Vokietija';
    case 'autoplius': return 'Lietuva';
    default: return 'Nežinoma';
  }
}

function getLocationFromSource(source: string): string {
  switch (source) {
    case 'mobile.de': return 'Vokietija';
    case 'autoscout24': return 'Vokietija';
    case 'autoplius': return 'Lietuva';
    default: return 'Nežinoma';
  }
}
