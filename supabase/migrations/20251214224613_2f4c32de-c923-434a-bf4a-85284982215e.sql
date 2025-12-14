-- Add min_year and max_price columns to saved_cars
ALTER TABLE public.saved_cars 
ADD COLUMN IF NOT EXISTS min_year integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_price integer DEFAULT NULL;