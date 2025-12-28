import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, QrCode, Link2, Heart, Users, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function LinksExternosCard() {
  const { toast } = useToast();
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<{ title: string; url: string } | null>(null);
  
  const baseUrl = window.location.origin;
  
  const links = [
    {
      title: "Link Geral",
      description: "Página inicial de cadastro (membro ou visitante)",
      url: `${baseUrl}/cadastro`,
      icon: Link2,
      color: "bg-primary/10 text-primary",
    },
    {
      title: "Link para Visitantes",
      description: "Cadastro direto de visitantes do culto",
      url: `${baseUrl}/cadastro/visitante`,
      icon: UserPlus,
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    },
    {
      title: "Link para quem aceitou Jesus",
      description: "Cadastro especial para novos convertidos",
      url: `${baseUrl}/cadastro?aceitou=true`,
      icon: Heart,
      color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    },
    {
      title: "Link para Membros",
      description: "Atualização de cadastro de membros",
      url: `${baseUrl}/cadastro/membro`,
      icon: Users,
      color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
    },
  ];

  const copyToClipboard = async (url: string, title: string) => {
    try {
      // Tenta API moderna (requer HTTPS e gesto do usuário)
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback amplo para navegadores sem clipboard API (iOS Safari, WebViews)
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.setAttribute("readonly", "");
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, url.length);
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!ok) throw new Error("execCommand copy failed");
      }

      toast({
        title: "Link copiado!",
        description: `O link "${title}" foi copiado para a área de transferência.`,
      });
    } catch (error) {
      // Último recurso: oferecer compartilhamento nativo quando possível
      if (navigator.share) {
        try {
          await navigator.share({ title, text: title, url });
          return;
        } catch {
          // Usuário cancelou o compartilhamento
        }
      }
      toast({
        title: "Erro",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const showQrCode = (title: string, url: string) => {
    setSelectedLink({ title, url });
    setQrDialogOpen(true);
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
            Compartilhe estes links para que membros e visitantes possam se cadastrar ou atualizar seus dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="space-y-3">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <div
                  key={link.title}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border"
                >
                  <div className={`p-2 rounded-full ${link.color} flex-shrink-0 w-fit`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{link.title}</h3>
                    <p className="text-xs text-muted-foreground">{link.description}</p>
                    <p className="text-xs text-primary truncate mt-1">{link.url}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(link.url, link.title)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copiar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => showQrCode(link.title, link.url)}
                    >
                      <QrCode className="w-4 h-4 mr-1" />
                      QR Code
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>💡 Dica:</strong> Você pode criar um banner ou notícia com estes links para que os membros da igreja possam atualizar seus dados pelo app/site!
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code - {selectedLink?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {selectedLink && (
              <>
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
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
