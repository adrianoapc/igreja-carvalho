import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type Pessoa = { id: string; nome: string };

export function PessoaCombobox({ value, onChange, placeholder }: { value?: string | null; onChange: (v: string | null) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        let query = supabase.from("profiles").select("id, nome").order("nome");
        if (search) query = query.ilike("nome", `%${search}%`);
        const { data } = await query;
        if (!active) return;
        setItems(data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { active = false };
  }, [search]);

  const selected = useMemo(() => items.find(i => i.id === value)?.nome, [items, value]);

  return (
    <div className="relative">
      <button type="button" className="w-full h-10 rounded-md border px-3 text-left text-sm" onClick={() => setOpen(true)}>
        {selected || placeholder || "Selecione"}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <Command>
            <CommandInput placeholder="Buscar pessoa..." value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{loading ? "Carregando..." : "Nenhum resultado"}</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={() => { onChange(null); setOpen(false); }}>
                  Oferta Solta / Anônimo
                </CommandItem>
                {items.map((p) => (
                  <CommandItem key={p.id} onSelect={() => { onChange(p.id); setOpen(false); }}>
                    {p.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
