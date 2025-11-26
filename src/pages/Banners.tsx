import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Eye, EyeOff, Megaphone } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Banner {
  id: number;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "urgent";
  active: boolean;
  createdAt: string;
  expiresAt?: string;
}

const mockBanners: Banner[] = [
  {
    id: 1,
    title: "Culto Especial de Ação de Graças",
    message: "Junte-se a nós neste domingo para um culto especial de ação de graças. Teremos louvor, testemunhos e uma palavra poderosa!",
    type: "success",
    active: true,
    createdAt: "2025-01-15",
    expiresAt: "2025-01-25"
  },
  {
    id: 2,
    title: "Atualização Sistema de Dízimos",
    message: "Nosso sistema de contribuições online está temporariamente indisponível. Use os envelopes físicos neste domingo.",
    type: "warning",
    active: true,
    createdAt: "2025-01-18"
  },
  {
    id: 3,
    title: "Retiro de Carnaval - Inscrições Abertas",
    message: "Já estão abertas as inscrições para o retiro de carnaval 2025! Vagas limitadas. Inscreva-se na secretaria.",
    type: "info",
    active: false,
    createdAt: "2025-01-10",
    expiresAt: "2025-02-01"
  }
];

export default function Banners() {
  const [banners, setBanners] = useState<Banner[]>(mockBanners);
  const [isCreating, setIsCreating] = useState(false);
  const [newBanner, setNewBanner] = useState({
    title: "",
    message: "",
    type: "info" as Banner["type"],
    expiresAt: ""
  });

  const handleCreate = () => {
    if (!newBanner.title || !newBanner.message) {
      toast({
        title: "Erro",
        description: "Preencha título e mensagem",
        variant: "destructive"
      });
      return;
    }

    const banner: Banner = {
      id: Date.now(),
      title: newBanner.title,
      message: newBanner.message,
      type: newBanner.type,
      active: true,
      createdAt: new Date().toISOString().split('T')[0],
      expiresAt: newBanner.expiresAt || undefined
    };

    setBanners([banner, ...banners]);
    setIsCreating(false);
    setNewBanner({ title: "", message: "", type: "info", expiresAt: "" });
    
    toast({
      title: "Banner criado!",
      description: "O banner está ativo e visível para todos os membros."
    });
  };

  const toggleActive = (id: number) => {
    setBanners(banners.map(b => 
      b.id === id ? { ...b, active: !b.active } : b
    ));
    toast({
      title: "Status atualizado",
      description: "Banner atualizado com sucesso."
    });
  };

  const deleteBanner = (id: number) => {
    setBanners(banners.filter(b => b.id !== id));
    toast({
      title: "Banner removido",
      description: "Banner excluído permanentemente."
    });
  };

  const getTypeColor = (type: Banner["type"]) => {
    switch (type) {
      case "urgent": return "destructive";
      case "warning": return "default";
      case "success": return "default";
      default: return "secondary";
    }
  };

  const getTypeLabel = (type: Banner["type"]) => {
    switch (type) {
      case "urgent": return "Urgente";
      case "warning": return "Aviso";
      case "success": return "Sucesso";
      default: return "Info";
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Banners e Avisos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie comunicações importantes para os membros
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Banner
        </Button>
      </div>

      {isCreating && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Criar Novo Banner</CardTitle>
            <CardDescription>Preencha as informações do banner</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Título</label>
              <Input
                value={newBanner.title}
                onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                placeholder="Ex: Culto Especial de Domingo"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground">Mensagem</label>
              <Textarea
                value={newBanner.message}
                onChange={(e) => setNewBanner({ ...newBanner, message: e.target.value })}
                placeholder="Digite a mensagem completa do banner..."
                className="mt-1 min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Tipo</label>
                <select
                  value={newBanner.type}
                  onChange={(e) => setNewBanner({ ...newBanner, type: e.target.value as Banner["type"] })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                >
                  <option value="info">Informação</option>
                  <option value="success">Sucesso</option>
                  <option value="warning">Aviso</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Data de Expiração</label>
                <Input
                  type="date"
                  value={newBanner.expiresAt}
                  onChange={(e) => setNewBanner({ ...newBanner, expiresAt: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate}>
                Criar Banner
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {banners.map((banner) => (
          <Card key={banner.id} className={banner.active ? "" : "opacity-60"}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Megaphone className="w-5 h-5 text-primary" />
                    <CardTitle className="text-xl">{banner.title}</CardTitle>
                    <Badge variant={getTypeColor(banner.type)}>
                      {getTypeLabel(banner.type)}
                    </Badge>
                    {banner.active ? (
                      <Badge variant="outline" className="gap-1">
                        <Eye className="w-3 h-3" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <EyeOff className="w-3 h-3" />
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{banner.message}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleActive(banner.id)}
                  >
                    {banner.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteBanner(banner.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Criado: {new Date(banner.createdAt).toLocaleDateString('pt-BR')}</span>
                {banner.expiresAt && (
                  <span>Expira: {new Date(banner.expiresAt).toLocaleDateString('pt-BR')}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
