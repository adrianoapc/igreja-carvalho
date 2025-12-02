import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Smartphone, Share, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
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
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/public")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Instalar App</h1>
            <p className="text-muted-foreground">Adicione o app à sua tela inicial</p>
          </div>
        </div>

        {isInstallable && (
          <Card className="shadow-soft mb-6 bg-primary/10 border-primary">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Download className="w-8 h-8 text-primary" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">App Instalável Detectado</h3>
                  <p className="text-sm text-muted-foreground">
                    Clique no botão abaixo para instalar
                  </p>
                </div>
                <Button onClick={handleInstallClick} className="bg-gradient-primary">
                  Instalar Agora
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-soft mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-primary" />
              <CardTitle>Como Instalar no iPhone</CardTitle>
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
                    Certifique-se de estar usando o navegador Safari
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  2
                </span>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Toque no botão</p>
                  <Share className="w-5 h-5 text-primary" />
                  <p className="font-medium">Compartilhar</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  3
                </span>
                <div>
                  <p className="font-medium">Selecione "Adicionar à Tela de Início"</p>
                  <p className="text-sm text-muted-foreground">
                    Role para baixo no menu e toque na opção
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  4
                </span>
                <div>
                  <p className="font-medium">Confirme a instalação</p>
                  <p className="text-sm text-muted-foreground">
                    Toque em "Adicionar" no canto superior direito
                  </p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-primary" />
              <CardTitle>Como Instalar no Android</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  1
                </span>
                <div>
                  <p className="font-medium">Abra no Chrome ou Firefox</p>
                  <p className="text-sm text-muted-foreground">
                    Use Chrome, Firefox ou outro navegador compatível
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  2
                </span>
                <div>
                  <p className="font-medium">Toque no menu (três pontos)</p>
                  <p className="text-sm text-muted-foreground">
                    No canto superior direito do navegador
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  3
                </span>
                <div>
                  <p className="font-medium">Selecione "Adicionar à tela inicial"</p>
                  <p className="text-sm text-muted-foreground">
                    Ou "Instalar app" se a opção aparecer
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  4
                </span>
                <div>
                  <p className="font-medium">Confirme a instalação</p>
                  <p className="text-sm text-muted-foreground">
                    Toque em "Adicionar" ou "Instalar"
                  </p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-secondary rounded-lg">
          <h3 className="font-semibold mb-2">Benefícios do App Instalado</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Acesso rápido direto da tela inicial</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Funciona offline após carregamento inicial</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Experiência de app nativo</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Menor consumo de dados</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
