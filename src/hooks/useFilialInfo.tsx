import { useAuthContext } from "@/contexts/AuthContextProvider";

interface FilialInfo {
  filialId: string | null;
  filialNome: string | null;
  igrejaId: string | null;
  igrejaNome: string | null;
  filiais: Array<{ id: string; nome: string }>;
  isAllFiliais: boolean;
  loading: boolean;
}

/**
 * Hook simplificado que consome dados do AuthContext
 * Mantém a mesma interface pública para retrocompatibilidade
 */
export function useFilialInfo(): FilialInfo {
  const {
    filialId,
    filialNome,
    igrejaId,
    igrejaNome,
    filiais,
    isAllFiliais,
    loading,
  } = useAuthContext();

  return {
    filialId,
    filialNome,
    igrejaId,
    igrejaNome,
    filiais,
    isAllFiliais,
    loading,
  };
}
