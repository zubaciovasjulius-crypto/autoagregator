-- Create table for cached car listings
CREATE TABLE public.car_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  price INTEGER NOT NULL,
  mileage INTEGER,
  fuel TEXT,
  transmission TEXT,
  location TEXT,
  country TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  listing_url TEXT,
  image TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(external_id, source)
);

-- Enable RLS
ALTER TABLE public.car_listings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read listings (public data)
CREATE POLICY "Anyone can read car listings" 
ON public.car_listings 
FOR SELECT 
USING (true);

-- Only service role can insert/update (edge function)
CREATE POLICY "Service role can insert listings" 
ON public.car_listings 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can update listings" 
ON public.car_listings 
FOR UPDATE 
USING (true);

CREATE POLICY "Service role can delete listings" 
ON public.car_listings 
FOR DELETE 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_car_listings_source ON public.car_listings(source);
CREATE INDEX idx_car_listings_brand ON public.car_listings(brand);
CREATE INDEX idx_car_listings_country ON public.car_listings(country);
CREATE INDEX idx_car_listings_scraped_at ON public.car_listings(scraped_at DESC);

-- Create table to track scrape status
CREATE TABLE public.scrape_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL UNIQUE,
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'idle',
  error_message TEXT,
  listings_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.scrape_status ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read status
CREATE POLICY "Anyone can read scrape status" 
ON public.scrape_status 
FOR SELECT 
USING (true);

-- Service role can manage status
CREATE POLICY "Service role can manage scrape status" 
ON public.scrape_status 
FOR ALL 
USING (true);

-- Insert initial status for each source
INSERT INTO public.scrape_status (source) VALUES 
  ('mobile.de'),
  ('autoscout24'),
  ('autoplius'),
  ('kleinanzeigen'),
  ('marktplaats');