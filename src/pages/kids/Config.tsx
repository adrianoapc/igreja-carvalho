import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Baby,
  Users,
  Settings,
  ArrowLeft
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import SalaDialog from "@/components/ensino/SalaDialog";

interface Sala {
  id: string;
  nome: string;
  capacidade: number;
  idade_min: number | null;
  idade_max: number | null;
  tipo: string;
  ativo: boolean;
}

export default function KidsConfig() {
  const navigate = useNavigate();
  const [salas, setSalas] = useState<Sala[]>([]);
  const [loading, setLoading] = useState(true);
  const [salaDialogOpen, setSalaDialogOpen] = useState(false);
  const [selectedSala, setSelectedSala] = useState<Sala | null>(null);

  useEffect(() => {
    fetchSalas();
  }, []);

  const fetchSalas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("salas")
      .select("*")
      .eq("tipo", "kids")
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro ao carregar salas:", error);
    } else {
      setSalas(data || []);
    }
    setLoading(false);
  };

  const handleNewSala = () => {
    setSelectedSala(null);
    setSalaDialogOpen(true);
  };

  const handleEditSala = (sala: Sala) => {
    setSelectedSala(sala);
    setSalaDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate("/kids/dashboard")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="w-8 h-8 text-primary" />
            Configurar Salas Kids
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerenciar salas do Ministério Infantil
          </p>
        </div>
        <Button onClick={handleNewSala} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Sala
        </Button>
      </div>

      {/* Lista de Salas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Baby className="w-5 h-5" />
            Salas do Ministério Kids
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : salas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Baby className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhuma sala cadastrada</p>
              <p className="text-sm mt-1">Clique em "Nova Sala" para começar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {salas.map((sala) => (
                <div
                  key={sala.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => handleEditSala(sala)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400">
                      <Baby className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-base">{sala.nome}</h4>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {sala.capacidade} lugares
                        </span>
                        {sala.idade_min !== null && sala.idade_max !== null && (
                          <span>
                            {sala.idade_min}-{sala.idade_max} anos
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={sala.ativo ? "default" : "secondary"} className="capitalize">
                    {sala.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <SalaDialog
        open={salaDialogOpen}
        onOpenChange={setSalaDialogOpen}
        sala={selectedSala}
        onSuccess={() => {
          fetchSalas();
          setSalaDialogOpen(false);
        }}
      />
    </div>
  );
}
