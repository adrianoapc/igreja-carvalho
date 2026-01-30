import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Pencil,
  AlertTriangle,
  Image as ImageIcon,
  Building2,
  Tag,
  FolderOpen,
  MapPin,
} from "lucide-react";
import { TransacaoDocumentViewer } from "./TransacaoDocumentViewer";
import { ItemReembolsoEditDialog } from "./ItemReembolsoEditDialog";
import { Database } from "@/integrations/supabase/types";

type SolicitacaoReembolso =
  Database["public"]["Views"]["view_solicitacoes_reembolso"]["Row"];

interface ItemReembolsoDetalhado {
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
  categoria_nome: string | null;
  subcategoria_nome: string | null;
  fornecedor_nome: string | null;
  centro_custo_nome: string | null;
  base_ministerial_nome: string | null;
}

interface ReembolsoDetalhesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitacao: SolicitacaoReembolso | null;
  canEdit: boolean;
  onItemUpdated: () => void;
}

export function ReembolsoDetalhesDialog({
  open,
  onOpenChange,
  solicitacao,
  canEdit,
  onItemUpdated,
}: ReembolsoDetalhesDialogProps) {
  const [fotoViewerOpen, setFotoViewerOpen] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemReembolsoDetalhado | null>(null);

  // Buscar itens do reembolso com relacionamentos
  const { data: itens = [], isLoading, refetch } = useQuery({
    queryKey: ["itens-reembolso", solicitacao?.id],
    queryFn: async () => {
      if (!solicitacao?.id) return [];

      // Buscar itens com JOINs manuais usando select
      const { data: itensBase, error } = await supabase
        .from("itens_reembolso")
        .select(`
          id,
          solicitacao_id,
          descricao,
          valor,
          data_item,
          foto_url,
          categoria_id,
          subcategoria_id,
          fornecedor_id,
          centro_custo_id,
          base_ministerial_id
        `)
        .eq("solicitacao_id", solicitacao.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Buscar nomes das relações
      const categoriasIds = [...new Set((itensBase || []).map(i => i.categoria_id).filter(Boolean))];
      const subcategoriasIds = [...new Set((itensBase || []).map(i => i.subcategoria_id).filter(Boolean))];
      const fornecedoresIds = [...new Set((itensBase || []).map(i => i.fornecedor_id).filter(Boolean))];
      const centrosCustoIds = [...new Set((itensBase || []).map(i => i.centro_custo_id).filter(Boolean))];
      const basesMinisteriaisIds = [...new Set((itensBase || []).map(i => i.base_ministerial_id).filter(Boolean))];

      // Buscar categorias
      const { data: categorias } = categoriasIds.length > 0
        ? await supabase.from("categorias_financeiras").select("id, nome").in("id", categoriasIds)
        : { data: [] };

      // Buscar subcategorias
      const { data: subcategorias } = subcategoriasIds.length > 0
        ? await supabase.from("subcategorias_financeiras").select("id, nome").in("id", subcategoriasIds)
        : { data: [] };

      // Buscar fornecedores
      const { data: fornecedores } = fornecedoresIds.length > 0
        ? await supabase.from("fornecedores").select("id, nome").in("id", fornecedoresIds)
        : { data: [] };

      // Buscar centros de custo
      const { data: centrosCusto } = centrosCustoIds.length > 0
        ? await supabase.from("centros_custo").select("id, nome").in("id", centrosCustoIds)
        : { data: [] };

      // Buscar bases ministeriais
      const { data: basesMinisteriais } = basesMinisteriaisIds.length > 0
        ? await supabase.from("bases_ministeriais").select("id, titulo").in("id", basesMinisteriaisIds)
        : { data: [] };

      // Mapear nomes
      const categoriasMap = new Map((categorias || []).map(c => [c.id, c.nome]));
      const subcategoriasMap = new Map((subcategorias || []).map(s => [s.id, s.nome]));
      const fornecedoresMap = new Map((fornecedores || []).map(f => [f.id, f.nome]));
      const centrosCustoMap = new Map((centrosCusto || []).map(cc => [cc.id, cc.nome]));
      const basesMinisteriaisMap = new Map((basesMinisteriais || []).map(bm => [bm.id, bm.titulo]));

      return (itensBase || []).map(item => ({
        ...item,
        categoria_nome: item.categoria_id ? categoriasMap.get(item.categoria_id) || null : null,
        subcategoria_nome: item.subcategoria_id ? subcategoriasMap.get(item.subcategoria_id) || null : null,
        fornecedor_nome: item.fornecedor_id ? fornecedoresMap.get(item.fornecedor_id) || null : null,
        centro_custo_nome: item.centro_custo_id ? centrosCustoMap.get(item.centro_custo_id) || null : null,
        base_ministerial_nome: item.base_ministerial_id ? basesMinisteriaisMap.get(item.base_ministerial_id) || null : null,
      })) as ItemReembolsoDetalhado[];
    },
    enabled: open && !!solicitacao?.id,
  });

  const handleOpenFoto = (url: string | null) => {
    if (!url) return;
    setFotoUrl(url);
    setImageZoom(1);
    setFotoViewerOpen(true);
  };

  const handleEditItem = (item: ItemReembolsoDetalhado) => {
    setSelectedItem(item);
    setEditItemOpen(true);
  };

  const handleItemSaved = () => {
    refetch();
    onItemUpdated();
    setEditItemOpen(false);
    setSelectedItem(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive"; label: string; icon: typeof Clock }> = {
      rascunho: { variant: "secondary", label: "Rascunho", icon: FileText },
      pendente: { variant: "default", label: "Pendente", icon: Clock },
      aprovado: { variant: "default", label: "Aprovado", icon: CheckCircle },
      pago: { variant: "default", label: "Pago", icon: CheckCircle },
      rejeitado: { variant: "destructive", label: "Rejeitado", icon: XCircle },
    };

    const config = variants[status] || variants.pendente;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const isDateSuspect = (dateStr: string | null) => {
    if (!dateStr) return false;
    const year = new Date(dateStr).getFullYear();
    const currentYear = new Date().getFullYear();
    return year < currentYear - 1 || year > currentYear + 1;
  };

  if (!solicitacao) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">
                  Solicitação #{solicitacao.id.slice(0, 8).toUpperCase()}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <span>
                    {format(new Date(solicitacao.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  <span>•</span>
                  <span className="font-semibold">
                    R$ {solicitacao.valor_total?.toFixed(2) || "0,00"}
                  </span>
                </DialogDescription>
              </div>
              {getStatusBadge(solicitacao.status)}
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            {/* Informações do Solicitante */}
            {solicitacao.solicitante_nome && (
              <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Solicitante</p>
                <p className="font-medium">{solicitacao.solicitante_nome}</p>
              </div>
            )}

            {/* Lista de Itens */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Itens do Reembolso ({itens.length})
              </h3>

              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-32 bg-muted/30 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : itens.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum item encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {itens.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
                    >
                      {/* Miniatura da Foto */}
                      <div
                        className={`w-20 h-20 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${
                          item.foto_url 
                            ? "cursor-pointer hover:opacity-80 transition-opacity" 
                            : "bg-muted"
                        }`}
                        onClick={() => item.foto_url && handleOpenFoto(item.foto_url)}
                      >
                        {item.foto_url ? (
                          <img
                            src={item.foto_url}
                            alt="Comprovante"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              e.currentTarget.parentElement?.classList.add("bg-muted");
                            }}
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                        )}
                      </div>

                      {/* Detalhes do Item */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-medium text-sm leading-tight line-clamp-2">
                              {item.descricao || "Item sem descrição"}
                            </h4>
                            <p className="text-lg font-semibold text-primary mt-1">
                              R$ {item.valor?.toFixed(2) || "0,00"}
                            </p>
                          </div>
                          {canEdit && solicitacao.status !== "pago" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditItem(item)}
                              className="shrink-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {/* Data */}
                        {item.data_item && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className={isDateSuspect(item.data_item) ? "text-amber-600 font-medium" : ""}>
                              {format(new Date(item.data_item), "dd/MM/yyyy")}
                            </span>
                            {isDateSuspect(item.data_item) && (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            )}
                          </div>
                        )}

                        {/* Classificações */}
                        <div className="flex flex-wrap gap-2 text-xs">
                          {item.fornecedor_nome && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
                              <Building2 className="w-3 h-3" />
                              {item.fornecedor_nome}
                            </span>
                          )}
                          {item.categoria_nome && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
                              <Tag className="w-3 h-3" />
                              {item.categoria_nome}
                              {item.subcategoria_nome && ` > ${item.subcategoria_nome}`}
                            </span>
                          )}
                          {item.centro_custo_nome && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
                              <FolderOpen className="w-3 h-3" />
                              {item.centro_custo_nome}
                            </span>
                          )}
                          {item.base_ministerial_nome && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
                              <MapPin className="w-3 h-3" />
                              {item.base_ministerial_nome}
                            </span>
                          )}
                        </div>

                        {/* Aviso se não houver classificações */}
                        {!item.categoria_nome && !item.fornecedor_nome && (
                          <p className="text-xs text-muted-foreground italic">
                            Sem classificações definidas
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Observações */}
            {solicitacao.observacoes && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Observações</p>
                <p className="text-sm">{solicitacao.observacoes}</p>
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visualizador de Foto */}
      <TransacaoDocumentViewer
        open={fotoViewerOpen}
        onOpenChange={setFotoViewerOpen}
        url={fotoUrl}
        imageZoom={imageZoom}
        setImageZoom={setImageZoom}
      />

      {/* Modal de Edição de Item */}
      <ItemReembolsoEditDialog
        open={editItemOpen}
        onOpenChange={setEditItemOpen}
        item={selectedItem}
        igrejaId={solicitacao.igreja_id}
        filialId={solicitacao.filial_id}
        onSaved={handleItemSaved}
      />
    </>
  );
}
