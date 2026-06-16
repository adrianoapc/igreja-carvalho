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
      .rpc("resolve_short_link", { _slug: slug })
      .then(({ data }) => {
        const target = typeof data === "string" ? data : null;
        window.location.replace(target ?? "/");
      });
  }, [slug]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground animate-pulse">Redirecionando...</p>
    </div>
  );
}
