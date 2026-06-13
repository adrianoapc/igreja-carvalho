import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, QrCode, Link2, Heart, Users, UserPlus, Coffee } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { supabase } from "@/integrations/supabase/client";

type LinkType = "visitante" | "aceitou" | "membro" | "cafe_vp";

interface LinkDef {
  linkType: LinkType;
  title: string;
  path: string;
  params?: Record<string, string | boolean>;
  icon: typeof Link2;
  color: string;
}

const LINKS: LinkDef[] = [
  {
    linkType: "visitante",
    title: "Visitante",
    path: "/cadastro/visitante",
    icon: UserPlus,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  },
  {
    linkType: "aceitou",
    title: "Aceitou Jesus",
    path: "/cadastro/visitante",
    params: { aceitou: "true" },
    icon: Heart,
    color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  },
  {
    linkType: "membro",
    title: "Membros",
    path: "/cadastro/membro",
    icon: Users,
    color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  },
  {
    linkType: "cafe_vp",
    title: "Café V&P",
    path: "/cadastro/cafe-vp",
    icon: Coffee,
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  },
];

function generateSlug(): string {
  return Math.random().toString(36).substring(2, 9).toUpperCase();
}

export function LinksExternosCard() {
  const { toast } = useToast();
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<{ title: string; url: string } | null>(null);
  const { igrejaId, filialId, isAllFiliais, loading } = useAuthContext();
  const [slugs, setSlugs] = useState<Partial<Record<LinkType, string>>>({});
  const [loadingSlugs, setLoadingSlugs] = useState(false);

  const baseUrl = window.location.origin;

  const buildFullUrl = useCallback(
    (path: string, extra?: Record<string, string | boolean | string>) => {
      const params = new URLSearchParams();
      if (igrejaId) params.set("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) params.set("filial_id", filialId);
      if (isAllFiliais) params.set("todas_filiais", "true");
      if (extra) {
        Object.entries(extra).forEach(([k, v]) => params.set(k, String(v)));
      }
      const q = params.toString();
      return q ? `${baseUrl}${path}?${q}` : `${baseUrl}${path}`;
    },
    [baseUrl, igrejaId, filialId, isAllFiliais],
  );

  const longUrls = useMemo(
    () =>
      Object.fromEntries(
        LINKS.map((l) => [l.linkType, buildFullUrl(l.path, l.params)]),
      ) as Record<LinkType, string>,
    [buildFullUrl],
  );

  useEffect(() => {
    if (loading || isAllFiliais || !igrejaId || !filialId) return;

    const fetchOrCreate = async () => {
      setLoadingSlugs(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const targetUrls = LINKS.map((l) => longUrls[l.linkType]);

        const { data: existing } = await supabase
          .from("short_links")
          .select("slug, target_url")
          .eq("igreja_id", igrejaId)
          .in("target_url", targetUrls);

        const found: Partial<Record<LinkType, string>> = {};
        existing?.forEach((row) => {
          const link = LINKS.find((l) => longUrls[l.linkType] === row.target_url);
          if (link) found[link.linkType] = row.slug;
        });

        const missing = LINKS.filter((l) => !found[l.linkType]);
        if (missing.length > 0) {
          const inserts = missing.map((l) => ({
            slug: generateSlug(),
            target_url: longUrls[l.linkType],
            igreja_id: igrejaId,
            filial_id: filialId,
            created_by: user.id,
          }));

          const { data: created } = await supabase
            .from("short_links")
            .insert(inserts)
            .select("slug, target_url");

          created?.forEach((row) => {
            const link = LINKS.find((l) => longUrls[l.linkType] === row.target_url);
            if (link) found[link.linkType] = row.slug;
          });
        }

        setSlugs(found);
      } finally {
        setLoadingSlugs(false);
      }
    };

    fetchOrCreate();
  }, [igrejaId, filialId, isAllFiliais, loading, longUrls]);

  const getUrl = (linkType: LinkType) => {
    const slug = slugs[linkType];
    return slug ? `${baseUrl}/s/${slug}` : longUrls[linkType];
  };

  const copyToClipboard = async (url: string, title: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.setAttribute("readonly", "");
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, url.length);
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("copy failed");
      }
      toast({ title: "Link copiado!", description: `"${title}" na área de transferência.` });
    } catch {
      if (navigator.share) {
        try { await navigator.share({ title, url }); return; } catch { /* cancelado */ }
      }
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Links Externos de Cadastro
          </CardTitle>
          <CardDescription>
            Compartilhe estes links com membros e visitantes.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
              Carregando contexto da igreja...
            </p>
          ) : isAllFiliais || !igrejaId || !filialId ? (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>⚠️ Selecione uma filial</strong> para gerar os links de cadastro.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {LINKS.map((link) => {
                const Icon = link.icon;
                const url = getUrl(link.linkType);
                const busy = loadingSlugs && !slugs[link.linkType];
                return (
                  <div
                    key={link.linkType}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border text-center"
                  >
                    <div className={`p-2 rounded-full ${link.color} flex-shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold leading-tight">{link.title}</span>
                    <div className="flex gap-1.5 w-full">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 px-0"
                        disabled={busy}
                        onClick={() => copyToClipboard(url, link.title)}
                        title="Copiar link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 px-0"
                        disabled={busy}
                        onClick={() => {
                          setSelectedLink({ title: link.title, url });
                          setQrDialogOpen(true);
                        }}
                        title="Ver QR Code"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code — {selectedLink?.title}</DialogTitle>
          </DialogHeader>
          {selectedLink && (
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedLink.url)}`}
                  alt={`QR Code para ${selectedLink.title}`}
                  className="w-48 h-48"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center break-all">
                {selectedLink.url}
              </p>
              <Button
                className="w-full"
                onClick={() => copyToClipboard(selectedLink.url, selectedLink.title)}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar Link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
