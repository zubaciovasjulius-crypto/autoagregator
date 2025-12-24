-- Create storage bucket for car listing images
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to listing images
CREATE POLICY "Public can view listing images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'listing-images');

-- Allow authenticated users to upload listing images
CREATE POLICY "Authenticated users can upload listing images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'listing-images' AND auth.role() = 'authenticated');

-- Allow service role to manage all images (for edge functions)
CREATE POLICY "Service role can manage listing images"
ON storage.objects
FOR ALL
USING (bucket_id = 'listing-images')
WITH CHECK (bucket_id = 'listing-images');