import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useSuperAdmin, type Igreja } from "@/hooks/useSuperAdmin";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NovaIgrejaDialog } from "@/components/superadmin/NovaIgrejaDialog";
import { IgrejaRowExpandable } from "@/components/superadmin/IgrejaRowExpandable";

export default function SuperAdminIgrejas() {
  const { toast } = useToast();
  const {
    isSuperAdmin,
    loading,
    igrejas,
    loadIgrejas,
    atualizarStatusIgreja,
  } = useSuperAdmin();

  const [novaIgrejaOpen, setNovaIgrejaOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIgreja, setSelectedIgreja] = useState<Igreja | null>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      loadIgrejas();
    }
  }, [isSuperAdmin, loadIgrejas]);

  const handleStatusChange = async (igrejaId: string, newStatus: string) => {
    setProcessing(true);
    const success = await atualizarStatusIgreja(igrejaId, newStatus);
    if (success) {
      toast({ title: `Status alterado para ${newStatus}` });
    } else {
      toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
    setProcessing(false);
  };

  const handleViewMetricas = (igreja: Igreja) => {
    setSelectedIgreja(igreja);
    // Navegar para métricas ou abrir modal
  };

  const filteredIgrejas = igrejas.filter(
    (igreja) =>
      igreja.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      igreja.cidade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      igreja.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Igrejas</h1>
          <p className="text-muted-foreground">
            Gerencie todas as igrejas cadastradas na plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadIgrejas} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={() => setNovaIgrejaOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nova Igreja
          </Button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, cidade ou email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Igrejas Cadastradas ({filteredIgrejas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIgrejas.map((igreja) => (
                <IgrejaRowExpandable
                  key={igreja.id}
                  igreja={igreja}
                  onViewMetricas={handleViewMetricas}
                  onStatusChange={handleStatusChange}
                  onIgrejaUpdated={loadIgrejas}
                  processing={processing}
                />
              ))}
              {filteredIgrejas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-12"
                  >
                    {searchTerm
                      ? "Nenhuma igreja encontrada com esses critérios"
                      : "Nenhuma igreja cadastrada"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Nova Igreja */}
      <NovaIgrejaDialog
        open={novaIgrejaOpen}
        onOpenChange={setNovaIgrejaOpen}
        onSuccess={loadIgrejas}
      />
    </div>
  );
}
