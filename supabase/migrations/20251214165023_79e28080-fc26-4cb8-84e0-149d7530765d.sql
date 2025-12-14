-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create saved_cars table for user favorites
CREATE TABLE public.saved_cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, external_id)
);

-- Enable RLS
ALTER TABLE public.saved_cars ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved cars
CREATE POLICY "Users can view own saved cars" 
ON public.saved_cars 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own saved cars
CREATE POLICY "Users can insert own saved cars" 
ON public.saved_cars 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own saved cars
CREATE POLICY "Users can delete own saved cars" 
ON public.saved_cars 
FOR DELETE 
USING (auth.uid() = user_id);

-- Enable realtime for saved_cars and car_listings
ALTER TABLE public.saved_cars REPLICA IDENTITY FULL;
ALTER TABLE public.car_listings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.car_listings;