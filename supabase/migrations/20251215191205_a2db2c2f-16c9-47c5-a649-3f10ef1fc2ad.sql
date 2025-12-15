-- Add min_price and max_year columns to saved_cars
ALTER TABLE public.saved_cars 
ADD COLUMN IF NOT EXISTS min_price integer,
ADD COLUMN IF NOT EXISTS max_year integer;