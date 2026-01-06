import { useAuthContext } from "@/contexts/AuthContextProvider";

/**
 * Hook simplificado que consome dados do AuthContext
 * Mantém a mesma interface pública para retrocompatibilidade
 */
export function useFilialId() {
  const { filialId, igrejaId, isAllFiliais, loading } = useAuthContext();

  return {
    filialId,
    igrejaId,
    isAllFiliais,
    loading,
  };
}
