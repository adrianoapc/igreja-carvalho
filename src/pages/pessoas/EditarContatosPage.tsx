import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { maskTelefone } from "@/components/pessoas/maskTelefone";
import { Star, Zap, Key, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Contato {
  tipo: string;
  valor: string;
  rotulo: string;
  is_primary: boolean;
  is_whatsapp: boolean;
  is_login: boolean;
}

const TIPOS = [
  { value: "celular", label: "Celular" },
  { value: "fixo", label: "Fixo" },
  { value: "email", label: "E-mail" },
  { value: "instagram", label: "Instagram" },
];

const initialFormData = {
  cep: "",
  cidade: "",
  bairro: "",
  estado: "SP",
  endereco: "",
  numero: "",
  complemento: "",
};

export default function EditarContatosPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState(initialFormData);
  const [contatos, setContatos] = useState<Contato[]>([
    { tipo: "celular", valor: "", rotulo: "Pessoal", is_primary: true, is_whatsapp: false, is_login: false },
  ]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Carregar dados da pessoa ao abrir a página
  useEffect(() => {
    const fetchPessoa = async () => {
      if (!id) return;
      try {
        // Buscar dados de endereço do perfil
        const { data: perfilData, error: perfilError } = await supabase
          .from("profiles")
          .select("cep, cidade, bairro, estado, endereco, numero, complemento")
          .eq("id", id)
          .single();

        if (perfilError) throw perfilError;

        if (perfilData) {
          setFormData({
            cep: perfilData.cep || "",
            cidade: perfilData.cidade || "",
            bairro: perfilData.bairro || "",
            estado: perfilData.estado || "SP",
            endereco: perfilData.endereco || "",
            numero: perfilData.numero || "",
            complemento: perfilData.complemento || "",
          });
        }

        // Buscar contatos da tabela profile_contatos
        const { data: contatosData, error: contatosError } = await supabase
          .from("profile_contatos")
          .select("*")
          .eq("profile_id", id)
          .order("created_at", { ascending: true });

        if (contatosError) throw contatosError;

        if (contatosData && contatosData.length > 0) {
          const contatosCarregados = contatosData.map((c) => ({
            tipo: c.tipo || "celular",
            valor: c.valor || "",
            rotulo: c.rotulo || "Pessoal",
            is_primary: c.is_primary || false,
            is_whatsapp: c.is_whatsapp || false,
            is_login: c.is_login || false,
          }));
          setContatos(contatosCarregados);
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast({ title: "Erro", description: "Não foi possível carregar os dados", variant: "destructive" });
      } finally {
        setLoadingData(false);
      }
    };

    fetchPessoa();
  }, [id]);

  const handleAddContato = () => {
    setContatos([...contatos, { tipo: "celular", valor: "", rotulo: "Pessoal", is_primary: false, is_whatsapp: false, is_login: false }]);
  };

  const handleRemoveContato = (idx: number) => {
    setContatos(contatos.filter((_, i) => i !== idx));
  };

  const handleContatoChange = (idx: number, field: keyof Contato, value: string | boolean) => {
    const updated = [...contatos];
    updated[idx] = { ...updated[idx], [field]: value };
    setContatos(updated);
  };

  const handleTogglePrimary = (idx: number) => {
    const updated = contatos.map((c, i) => ({
      ...c,
      is_primary: i === idx ? !c.is_primary : false,
    }));
    setContatos(updated);
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // TODO: Salvar dados (API call com supabase)
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Sucesso", description: "Dados salvos com sucesso!" });
      navigate(-1);
    }, 1200);
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-6">
            <h1 className="text-3xl font-bold mb-8">Editar Contatos e Endereço</h1>
        {/* Endereço */}
        <section className="bg-card rounded-xl shadow p-6 space-y-6 border">
          <h2 className="font-semibold text-lg mb-2 text-primary">Endereço</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={e => setFormData({
                  ...formData,
                  cep: e.target.value
                    .replace(/\D/g, '')
                    .replace(/(\d{5})(\d{0,3})/, (m, d1, d2) => { return d2 ? `${d1}-${d2}` : d1; })
                })}
                placeholder="00000-000"
                maxLength={9}
              />
            </div>
            <div>
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" value={formData.cidade} onChange={e => setFormData({ ...formData, cidade: e.target.value })} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" value={formData.bairro} onChange={e => setFormData({ ...formData, bairro: e.target.value })} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="estado">Estado</Label>
              <Input id="estado" value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value })} maxLength={2} placeholder="SP" />
            </div>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-4 col-span-1">
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" value={formData.endereco} onChange={e => setFormData({ ...formData, endereco: e.target.value })} maxLength={255} placeholder="Rua, avenida, etc." />
              </div>
              <div className="md:col-span-1 col-span-1">
                <Label htmlFor="numero">Número</Label>
                <Input id="numero" value={formData.numero || ""} onChange={e => setFormData({ ...formData, numero: e.target.value })} maxLength={10} placeholder="Nº" />
              </div>
              <div className="md:col-span-1 col-span-1">
                <Label htmlFor="complemento">Complemento</Label>
                <Input id="complemento" value={formData.complemento || ""} onChange={e => setFormData({ ...formData, complemento: e.target.value })} maxLength={50} placeholder="Compl." />
              </div>
            </div>
          </div>
        </section>
        {/* Contatos */}
        <section className="bg-card rounded-xl shadow p-6 space-y-6 border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-lg text-primary">Contatos</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setContatos([...contatos, { tipo: "celular", valor: "", rotulo: "Pessoal", is_primary: false, is_whatsapp: false, is_login: false }])}>
              + Adicionar Contato
            </Button>
          </div>
          <div className="space-y-6 max-h-[340px] md:max-h-[420px] overflow-y-auto pr-1">
            {contatos.map((contato, idx) => (
              <div key={idx} className="border rounded-xl p-4 bg-muted/50 shadow-sm flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 items-end">
                  <div>
                    <select
                      className="w-full border rounded px-2 py-1"
                      value={contato.tipo}
                      onChange={e => handleContatoChange(idx, "tipo", e.target.value)}
                    >
                      {TIPOS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    {contato.tipo === "celular" || contato.tipo === "fixo" ? (
                      <Input
                        value={contato.valor}
                        onChange={e => handleContatoChange(idx, "valor", maskTelefone(e.target.value, contato.tipo))}
                        placeholder={contato.tipo === "celular" ? "Celular" : "Fixo"}
                        inputMode="tel"
                        maxLength={contato.tipo === "celular" ? 15 : 14}
                      />
                    ) : (
                      <Input
                        value={contato.valor}
                        onChange={e => handleContatoChange(idx, "valor", e.target.value)}
                        placeholder={contato.tipo === "email" ? "E-mail" : "Instagram"}
                      />
                    )}
                  </div>
                  <div>
                    <select
                      className="w-full border rounded px-2 py-1"
                      value={contato.rotulo}
                      onChange={e => handleContatoChange(idx, "rotulo", e.target.value)}
                    >
                      <option value="Pessoal">Pessoal</option>
                      <option value="Trabalho">Trabalho</option>
                      <option value="Recado">Recado</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Button
                    type="button"
                    variant={contato.is_primary ? "default" : "outline"}
                    size="icon"
                    onClick={() => handleTogglePrimary(idx)}
                    title="Principal"
                  >
                    <Star className={cn("w-4 h-4", contato.is_primary ? "text-yellow-500" : "text-muted-foreground")} />
                  </Button>
                  {(contato.tipo === "celular" || contato.tipo === "fixo") && (
                    <Button
                      type="button"
                      variant={contato.is_whatsapp ? "default" : "outline"}
                      size="icon"
                      onClick={() => handleContatoChange(idx, "is_whatsapp", !contato.is_whatsapp)}
                      title="WhatsApp"
                    >
                      <Zap className={cn("w-4 h-4", contato.is_whatsapp ? "text-green-500" : "text-muted-foreground")} />
                    </Button>
                  )}
                  {(contato.tipo === "email" || contato.tipo === "celular") && (
                    <Button
                      type="button"
                      variant={contato.is_login ? "default" : "outline"}
                      size="icon"
                      onClick={() => handleContatoChange(idx, "is_login", !contato.is_login)}
                      title="Login"
                    >
                      <Key className={cn("w-4 h-4", contato.is_login ? "text-blue-500" : "text-muted-foreground")} />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveContato(idx)}
                    title="Remover"
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
            </section>
          </div>
        </div>
        {/* Rodapé fixo */}
        <div className="border-t bg-muted/50 px-6 py-4 flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
