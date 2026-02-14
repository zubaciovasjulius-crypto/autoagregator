
-- Proposals table for client offers
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  images text[] DEFAULT '{}',
  car_price integer NOT NULL DEFAULT 0,
  transport_price integer NOT NULL DEFAULT 0,
  repair_price integer NOT NULL DEFAULT 0,
  total_price integer GENERATED ALWAYS AS (car_price + transport_price + repair_price) STORED,
  share_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  client_name text,
  client_email text,
  status text NOT NULL DEFAULT 'draft',
  listing_id uuid REFERENCES public.car_listings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage proposals" ON public.proposals FOR ALL USING (public.is_admin());
CREATE POLICY "Public can view by token" ON public.proposals FOR SELECT USING (true);

-- Client search requests / wishes
CREATE TABLE public.client_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  brand text NOT NULL,
  model text NOT NULL,
  min_year integer,
  max_year integer,
  min_price integer,
  max_price integer,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client requests" ON public.client_requests FOR ALL USING (public.is_admin());

-- Table to track matched listings for client requests
CREATE TABLE public.client_request_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.client_requests(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.car_listings(id) ON DELETE CASCADE,
  seen boolean NOT NULL DEFAULT false,
  proposal_created boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, listing_id)
);

ALTER TABLE public.client_request_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage matches" ON public.client_request_matches FOR ALL USING (public.is_admin());
