import { useAuthContext } from "@/contexts/AuthContextProvider";

/**
 * Hook simplificado que consome igrejaId do AuthContext
 * Mantém a mesma interface pública para retrocompatibilidade
 */
export function useIgrejaId() {
  const { igrejaId, loading } = useAuthContext();

  return {
    igrejaId,
    loading,
  };
}
