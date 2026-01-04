-- Create audit log table for public endpoint access
CREATE TABLE IF NOT EXISTS public.audit_public_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  endpoint_name TEXT NOT NULL,
  action TEXT NOT NULL,
  client_ip TEXT NOT NULL,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  request_metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for querying by IP (for detecting abuse)
CREATE INDEX idx_audit_public_endpoints_ip ON public.audit_public_endpoints(client_ip);
CREATE INDEX idx_audit_public_endpoints_created ON public.audit_public_endpoints(created_at DESC);
CREATE INDEX idx_audit_public_endpoints_endpoint ON public.audit_public_endpoints(endpoint_name);

-- Enable RLS - only service role can insert, admins can read
ALTER TABLE public.audit_public_endpoints ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to insert (Edge Functions use service role)
CREATE POLICY "Service role can manage audit logs"
ON public.audit_public_endpoints
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_public_endpoints
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'pastor')
  )
);

-- Create table for IP blocklist (repeat offenders)
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMPTZ DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  violation_count INTEGER DEFAULT 1,
  created_by TEXT DEFAULT 'system'
);

CREATE INDEX idx_blocked_ips_address ON public.blocked_ips(ip_address);
CREATE INDEX idx_blocked_ips_until ON public.blocked_ips(blocked_until);

ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage blocked IPs"
ON public.blocked_ips
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view blocked IPs"
ON public.blocked_ips
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'pastor')
  )
);

-- Function to check if an IP is blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_ips
    WHERE ip_address = p_ip
    AND (blocked_until IS NULL OR blocked_until > now())
  );
$$;

-- Function to log and auto-block repeat rate limit offenders
CREATE OR REPLACE FUNCTION public.log_rate_limit_violation(
  p_ip TEXT,
  p_endpoint TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_violation_count INTEGER;
BEGIN
  -- Log the violation
  INSERT INTO audit_public_endpoints (endpoint_name, action, client_ip, success, error_message)
  VALUES (p_endpoint, 'rate_limit_exceeded', p_ip, false, 'Rate limit exceeded');
  
  -- Count recent violations (last hour)
  SELECT COUNT(*) INTO v_violation_count
  FROM audit_public_endpoints
  WHERE client_ip = p_ip
  AND action = 'rate_limit_exceeded'
  AND created_at > now() - interval '1 hour';
  
  -- Auto-block if more than 5 violations in the last hour
  IF v_violation_count >= 5 THEN
    INSERT INTO blocked_ips (ip_address, reason, blocked_until, violation_count)
    VALUES (p_ip, 'Exceeded rate limit 5+ times in 1 hour', now() + interval '24 hours', v_violation_count)
    ON CONFLICT (ip_address) DO UPDATE SET
      blocked_until = now() + interval '24 hours',
      violation_count = blocked_ips.violation_count + 1;
  END IF;
END;
$$;