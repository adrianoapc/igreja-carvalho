import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Baby, Users, MapPin, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFilialId } from "@/hooks/useFilialId";

interface Sala {
  id: string;
  nome: string;
  capacidade: number;
  idade_min: number | null;
  idade_max: number | null;
  tipo: string;
  ativo: boolean;
}

interface SalaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sala: Sala | null;
  onSuccess: () => void;
}

export default function SalaDialog({ open, onOpenChange, sala, onSuccess }: SalaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [capacidade, setCapacidade] = useState("20");
  const [idadeMin, setIdadeMin] = useState("");
  const [idadeMax, setIdadeMax] = useState("");
  const [tipo, setTipo] = useState("adultos");
  const [ativo, setAtivo] = useState(true);
  const { igrejaId, filialId, isAllFiliais } = useFilialId();

  useEffect(() => {
    if (sala) {
      setNome(sala.nome);
      setCapacidade(sala.capacidade.toString());
      setIdadeMin(sala.idade_min?.toString() || "");
      setIdadeMax(sala.idade_max?.toString() || "");
      setTipo(sala.tipo);
      setAtivo(sala.ativo);
    } else {
      resetForm();
    }
  }, [sala, open]);

  const resetForm = () => {
    setNome("");
    setCapacidade("20");
    setIdadeMin("");
    setIdadeMax("");
    setTipo("adultos");
    setAtivo(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome da sala é obrigatório");
      return;
    }

    if (!igrejaId) {
      toast.error("Contexto da igreja não identificado");
      return;
    }

    setLoading(true);

    const salaData = {
      nome: nome.trim(),
      capacidade: parseInt(capacidade) || 20,
      idade_min: idadeMin ? parseInt(idadeMin) : null,
      idade_max: idadeMax ? parseInt(idadeMax) : null,
      tipo,
      ativo,
      igreja_id: igrejaId,
      filial_id: isAllFiliais ? null : filialId,
    };

    let error;

    if (sala) {
      const result = await supabase
        .from("salas")
        .update(salaData)
        .eq("id", sala.id);
      error = result.error;
    } else {
      const result = await supabase.from("salas").insert(salaData);
      error = result.error;
    }

    setLoading(false);

    if (error) {
      console.error("Erro ao salvar sala:", error);
      toast.error("Erro ao salvar sala");
      return;
    }

    toast.success(sala ? "Sala atualizada!" : "Sala criada!");
    onSuccess();
  };

  const handleDelete = async () => {
    if (!sala) return;
    
    if (!confirm("Tem certeza que deseja excluir esta sala?")) return;

    setLoading(true);

    const { error } = await supabase
      .from("salas")
      .delete()
      .eq("id", sala.id);

    setLoading(false);

    if (error) {
      console.error("Erro ao excluir sala:", error);
      toast.error("Erro ao excluir sala");
      return;
    }

    toast.success("Sala excluída!");
    onSuccess();
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      dialogContentProps={{ className: "sm:max-w-md p-0" }}
      drawerContentProps={{ className: "p-0" }}
    >
      <div className="flex flex-col h-full">
        <DialogTitle className="sr-only">
          {sala ? "Editar Sala" : "Nova Sala"}
        </DialogTitle>
        <div className="flex items-center gap-2 border-b px-6 pt-6 pb-4">
          <MapPin className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">
            {sala ? "Editar Sala" : "Nova Sala"}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-2">
            <Label>Nome da Sala *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Berçário, Auditório B"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kids">
                  <div className="flex items-center gap-2">
                    <Baby className="w-4 h-4 text-pink-500" />
                    Kids (Ministério Infantil)
                  </div>
                </SelectItem>
                <SelectItem value="adultos">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    Adultos
                  </div>
                </SelectItem>
                <SelectItem value="hibrido">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-500" />
                    Híbrido
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Capacidade</Label>
            <Input
              type="number"
              value={capacidade}
              onChange={(e) => setCapacidade(e.target.value)}
              placeholder="20"
              min="1"
            />
          </div>

          {tipo === "kids" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Idade Mínima</Label>
                <Input
                  type="number"
                  value={idadeMin}
                  onChange={(e) => setIdadeMin(e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Idade Máxima</Label>
                <Input
                  type="number"
                  value={idadeMax}
                  onChange={(e) => setIdadeMax(e.target.value)}
                  placeholder="12"
                  min="0"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
            <div>
              <p className="font-medium text-sm">Sala Ativa</p>
              <p className="text-xs text-muted-foreground">
                Salas inativas não aparecem nas opções
              </p>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <div className="border-t px-6 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {sala && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
