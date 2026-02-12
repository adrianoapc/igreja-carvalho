import { useQuery } from "@tanstack/react-query";
import { supabase } from "../integrations/supabase/client";

export function useDuplicatasSuspeitas() {
  return useQuery({
    queryKey: ["duplicatas-suspeitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas_duplicatas_suspeitas")
        .select("*, pessoa_id_1:profiles!pessoas_duplicatas_suspeitas_pessoa_id_1_fkey(id, nome), pessoa_id_2:profiles!pessoas_duplicatas_suspeitas_pessoa_id_2_fkey(id, nome)")
        .eq("status", "pendente");
      if (error) throw error;
      return data;
    },
  });
}
