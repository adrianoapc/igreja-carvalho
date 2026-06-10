import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ShortLinkRedirect() {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (!slug) {
      window.location.replace("/");
      return;
    }
    supabase
      .from("short_links")
      .select("target_url")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        window.location.replace(data?.target_url ?? "/");
      });
  }, [slug]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground animate-pulse">Redirecionando...</p>
    </div>
  );
}
