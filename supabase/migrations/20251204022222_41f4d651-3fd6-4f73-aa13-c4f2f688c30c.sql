-- Fix Security Definer View warning by setting security_invoker=true on views
-- This ensures RLS policies of the querying user are applied, not the view creator

ALTER VIEW public.view_room_occupancy SET (security_invoker = true);
ALTER VIEW public.view_absent_kids SET (security_invoker = true);