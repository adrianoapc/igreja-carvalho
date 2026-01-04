import { FilialManager } from "@/components/shared/FilialManager";
import { useFilialId } from "@/hooks/useFilialId";
import { useFilialInfo } from "@/hooks/useFilialInfo";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FiliaisConfigProps {
  onBack?: () => void;
}

/**
 * Tela de configuração de Filiais para Admin da Igreja.
 * Permite criar, editar e excluir filiais da igreja do usuário.
 */
export default function FiliaisConfig({ onBack }: FiliaisConfigProps) {
  const { igrejaId, loading: filialLoading } = useFilialId();
  const { igrejaNome, loading: infoLoading } = useFilialInfo();

  const loading = filialLoading || infoLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        )}
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!igrejaId) {
    return (
      <div className="space-y-6">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        )}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>
            Não foi possível identificar sua igreja. Por favor, entre em contato com o suporte.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {onBack && (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Filiais</h1>
            <p className="text-muted-foreground">
              Gerencie as filiais da sua igreja
            </p>
          </div>
        </div>
      )}

      <FilialManager
        igrejaId={igrejaId}
        igrejaNome={igrejaNome || undefined}
        showHeader={!onBack}
      />
    </div>
  );
}
