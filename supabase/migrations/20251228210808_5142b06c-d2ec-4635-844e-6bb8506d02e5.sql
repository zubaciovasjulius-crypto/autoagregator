-- Add approved field to profiles
ALTER TABLE public.profiles 
ADD COLUMN approved boolean NOT NULL DEFAULT false;

-- Update existing users to be approved (so current admin works)
UPDATE public.profiles SET approved = true WHERE email = 'aivaras@autokopers.lt';

-- Create function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved(user_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE email = user_email AND approved = true
  )
$$;

-- Allow admins to update profiles (for approval)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_admin());

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (is_admin());