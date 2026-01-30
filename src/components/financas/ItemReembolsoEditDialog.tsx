import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ItemReembolso {
  id: string;
  solicitacao_id: string;
  descricao: string;
  valor: number;
  data_item: string | null;
  foto_url: string | null;
  categoria_id: string | null;
  subcategoria_id: string | null;
  fornecedor_id: string | null;
  centro_custo_id: string | null;
  base_ministerial_id: string | null;
}

interface ItemReembolsoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemReembolso | null;
  igrejaId: string | null;
  filialId: string | null;
  onSaved: () => void;
}

export function ItemReembolsoEditDialog({
  open,
  onOpenChange,
  item,
  igrejaId,
  filialId,
  onSaved,
}: ItemReembolsoEditDialogProps) {
  const queryClient = useQueryClient();

  // Form state
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataItem, setDataItem] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [subcategoriaId, setSubcategoriaId] = useState<string>("");
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [centroCustoId, setCentroCustoId] = useState<string>("");
  const [baseMinisterialId, setBaseMinisterialId] = useState<string>("");

  // Populate form when item changes
  useEffect(() => {
    if (item) {
      setDescricao(item.descricao || "");
      setValor(item.valor?.toString() || "");
      setDataItem(item.data_item || "");
      setCategoriaId(item.categoria_id || "");
      setSubcategoriaId(item.subcategoria_id || "");
      setFornecedorId(item.fornecedor_id || "");
      setCentroCustoId(item.centro_custo_id || "");
      setBaseMinisterialId(item.base_ministerial_id || "");
    }
  }, [item]);

  // Reset subcategoria when categoria changes
  useEffect(() => {
    if (item?.categoria_id !== categoriaId) {
      setSubcategoriaId("");
    }
  }, [categoriaId, item?.categoria_id]);

  // Query: Categorias (saída)
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-saida", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("tipo", "saida")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!igrejaId,
  });

  // Query: Subcategorias
  const { data: subcategorias = [] } = useQuery({
    queryKey: ["subcategorias", igrejaId, categoriaId],
    queryFn: async () => {
      if (!categoriaId || !igrejaId) return [];
      const { data, error } = await supabase
        .from("subcategorias_financeiras")
        .select("id, nome")
        .eq("categoria_id", categoriaId)
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!categoriaId && !!igrejaId,
  });

  // Query: Fornecedores
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-ativos", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!igrejaId,
  });

  // Query: Centros de Custo
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["centros-custo-ativos", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from("centros_custo")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!igrejaId,
  });

  // Query: Bases Ministeriais
  const { data: basesMinisteriais = [] } = useQuery({
    queryKey: ["bases-ministeriais-ativas", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from("bases_ministeriais")
        .select("id, titulo")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("titulo");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!igrejaId,
  });

  // Mutation: Atualizar item
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!item?.id) throw new Error("Item não encontrado");

      const { error } = await supabase
        .from("itens_reembolso")
        .update({
          descricao,
          valor: parseFloat(valor) || 0,
          data_item: dataItem || null,
          categoria_id: categoriaId || null,
          subcategoria_id: subcategoriaId || null,
          fornecedor_id: fornecedorId || null,
          centro_custo_id: centroCustoId || null,
          base_ministerial_id: baseMinisterialId || null,
        })
        .eq("id", item.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["itens-reembolso"] });
      onSaved();
    },
    onError: (error) => {
      console.error("Erro ao atualizar item:", error);
      toast.error("Erro ao atualizar item");
    },
  });

  const handleSave = () => {
    if (!descricao.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    if (!valor || parseFloat(valor) <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }
    updateMutation.mutate();
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Item do Reembolso</DialogTitle>
          <DialogDescription>
            Corrija os dados extraídos automaticamente ou adicione classificações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição do item"
              rows={2}
            />
          </div>

          {/* Valor e Data em linha */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataItem">Data do Comprovante</Label>
              <Input
                id="dataItem"
                type="date"
                value={dataItem}
                onChange={(e) => setDataItem(e.target.value)}
              />
            </div>
          </div>

          {/* Fornecedor */}
          <div className="space-y-2">
            <Label htmlFor="fornecedor">Fornecedor</Label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoria e Subcategoria */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcategoria">Subcategoria</Label>
              <Select
                value={subcategoriaId}
                onValueChange={setSubcategoriaId}
                disabled={!categoriaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {subcategorias.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Centro de Custo */}
          <div className="space-y-2">
            <Label htmlFor="centroCusto">Centro de Custo</Label>
            <Select value={centroCustoId} onValueChange={setCentroCustoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o centro de custo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {centrosCusto.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Base Ministerial */}
          <div className="space-y-2">
            <Label htmlFor="baseMinisterial">Base Ministerial</Label>
            <Select value={baseMinisterialId} onValueChange={setBaseMinisterialId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a base ministerial" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhuma</SelectItem>
                {basesMinisteriais.map((bm) => (
                  <SelectItem key={bm.id} value={bm.id}>
                    {bm.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
