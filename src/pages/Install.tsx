import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Share, Download, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showBackButton title="Instalar App" subtitle="Adicione à sua tela inicial" />

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {isInstallable && (
          <Card className="mb-6 bg-primary/5 border-primary/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Download className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">App Disponível</h3>
                  <p className="text-sm text-muted-foreground">
                    Clique para instalar diretamente
                  </p>
                </div>
                <Button onClick={handleInstallClick} className="bg-primary hover:bg-primary/90">
                  Instalar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">iPhone (Safari)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  1
                </span>
                <div>
                  <p className="font-medium">Abra no Safari</p>
                  <p className="text-sm text-muted-foreground">
                    Use o navegador Safari para esta página
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  2
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">Toque em</p>
                  <Share className="w-5 h-5 text-primary" />
                  <p className="font-medium">(Compartilhar)</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  3
                </span>
                <div>
                  <p className="font-medium">"Adicionar à Tela de Início"</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  4
                </span>
                <div>
                  <p className="font-medium">Confirme tocando "Adicionar"</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Android (Chrome)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  1
                </span>
                <div>
                  <p className="font-medium">Abra no Chrome</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  2
                </span>
                <div>
                  <p className="font-medium">Toque no menu (⋮)</p>
                  <p className="text-sm text-muted-foreground">
                    Três pontos no canto superior
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  3
                </span>
                <div>
                  <p className="font-medium">"Adicionar à tela inicial"</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  4
                </span>
                <div>
                  <p className="font-medium">Confirme a instalação</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card className="bg-accent/30 border-accent">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Benefícios</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {[
                "Acesso rápido da tela inicial",
                "Funciona offline após carregar",
                "Experiência de app nativo",
                "Menor consumo de dados"
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
