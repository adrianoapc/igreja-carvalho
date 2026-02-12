import { useQuery } from "@tanstack/react-query";
import { supabase } from "../integrations/supabase/client";

export function useDuplicatasSuspeitas() {
  return useQuery({
    queryKey: ["duplicatas-suspeitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas_duplicatas_suspeitas")
        .select("*, pessoa_id_1(*), pessoa_id_2(*)")
        .eq("status", "pendente");
      if (error) throw error;
      return data;
    },
  });
}
