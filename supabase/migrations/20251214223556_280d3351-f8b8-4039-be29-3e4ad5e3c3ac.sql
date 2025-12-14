-- Create table to store found listings per user
CREATE TABLE public.found_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  external_id text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  title text NOT NULL,
  year integer NOT NULL,
  price integer NOT NULL,
  mileage integer,
  fuel text,
  transmission text,
  location text,
  country text NOT NULL,
  source text NOT NULL,
  source_url text NOT NULL,
  listing_url text,
  image text,
  found_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '3 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.found_listings ENABLE ROW LEVEL SECURITY;

-- Users can view their own found listings
CREATE POLICY "Users can view own found listings"
ON public.found_listings
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own found listings
CREATE POLICY "Users can insert own found listings"
ON public.found_listings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own found listings
CREATE POLICY "Users can delete own found listings"
ON public.found_listings
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_found_listings_user_id ON public.found_listings(user_id);
CREATE INDEX idx_found_listings_expires_at ON public.found_listings(expires_at);
CREATE UNIQUE INDEX idx_found_listings_unique ON public.found_listings(user_id, external_id);