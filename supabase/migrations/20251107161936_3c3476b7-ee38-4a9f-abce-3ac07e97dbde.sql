-- Create members table
CREATE TABLE public.members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  meals integer DEFAULT 0,
  deposit integer DEFAULT 0,
  guest integer DEFAULT 0,
  fine integer DEFAULT 0,
  rice integer DEFAULT 0,
  marketing integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create bills table
CREATE TABLE public.bills (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month text NOT NULL,
  member_data jsonb NOT NULL,
  calculation_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Public can read members (for bill calculation)
CREATE POLICY "Anyone can read members"
ON public.members
FOR SELECT
USING (true);

-- Public can read bills
CREATE POLICY "Anyone can read bills"
ON public.bills
FOR SELECT
USING (true);

-- Create user roles table for admin
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Only admin can insert/update/delete members
CREATE POLICY "Admin can insert members"
ON public.members
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update members"
ON public.members
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete members"
ON public.members
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can insert bills (for auto-save)
CREATE POLICY "Anyone can insert bills"
ON public.bills
FOR INSERT
WITH CHECK (true);

-- Only admin can update/delete bills
CREATE POLICY "Admin can update bills"
ON public.bills
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete bills"
ON public.bills
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_members_updated_at
BEFORE UPDATE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();