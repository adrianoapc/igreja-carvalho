import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Membro {
  id: string;
  nome: string;
}

interface LiturgiaItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cultoId: string;
  membros: Membro[];
  onSaved: () => void;
}

const TIPOS_LITURGIA = [
  "Abertura", "Louvor", "Adoração", "Oração", "Leitura Bíblica",
  "Pregação", "Oferta", "Santa Ceia", "Anúncios", "Encerramento", "Outro"
];

export function LiturgiaItemDialog({ 
  open, 
  onOpenChange, 
  cultoId, 
  membros, 
  onSaved 
}: LiturgiaItemDialogProps) {
  const [tipo, setTipo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [isConvidadoExterno, setIsConvidadoExterno] = useState(false);
  const [nomeConvidadoExterno, setNomeConvidadoExterno] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setTipo("");
    setTitulo("");
    setDescricao("");
    setDuracaoMinutos("");
    setResponsavelId("");
    setIsConvidadoExterno(false);
    setNomeConvidadoExterno("");
  };

  const handleSave = async () => {
    if (!tipo || !titulo) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      // Buscar a maior ordem atual
      const { data: itensData } = await supabase
        .from("liturgia_culto")
        .select("ordem")
        .eq("culto_id", cultoId)
        .order("ordem", { ascending: false })
        .limit(1);

      const novaOrdem = itensData && itensData.length > 0 ? itensData[0].ordem + 1 : 1;

      const { error } = await supabase
        .from("liturgia_culto")
        .insert({
          culto_id: cultoId,
          tipo,
          titulo,
          descricao: descricao || null,
          duracao_minutos: duracaoMinutos ? parseInt(duracaoMinutos) : null,
          responsavel_id: isConvidadoExterno ? null : (responsavelId || null),
          responsavel_externo: isConvidadoExterno ? nomeConvidadoExterno.trim() : null,
          ordem: novaOrdem,
        });

      if (error) throw error;
      
      toast.success("Item adicionado com sucesso!");
      resetForm();
      onSaved();
    } catch (error: any) {
      toast.error("Erro ao adicionar item", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Item à Liturgia</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_LITURGIA.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duração (min)</Label>
              <Input
                type="number"
                value={duracaoMinutos}
                onChange={(e) => setDuracaoMinutos(e.target.value)}
                placeholder="Ex: 10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Título *</Label>
            <Input 
              value={titulo} 
              onChange={(e) => setTitulo(e.target.value)} 
              placeholder="Ex: Momento de Louvor"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea 
              value={descricao} 
              onChange={(e) => setDescricao(e.target.value)} 
              rows={2}
              placeholder="Detalhes adicionais..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="convidado-add"
              checked={isConvidadoExterno}
              onCheckedChange={(checked) => setIsConvidadoExterno(!!checked)}
            />
            <Label htmlFor="convidado-add">Convidado externo</Label>
          </div>

          {isConvidadoExterno ? (
            <div className="space-y-2">
              <Label>Nome do Convidado</Label>
              <Input
                value={nomeConvidadoExterno}
                onChange={(e) => setNomeConvidadoExterno(e.target.value)}
                placeholder="Nome do convidado"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um membro..." />
                </SelectTrigger>
                <SelectContent>
                  {membros.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
