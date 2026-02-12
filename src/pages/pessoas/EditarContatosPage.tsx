import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { maskTelefone } from "@/components/pessoas/maskTelefone";
import { Star, Zap, Key, Trash2, Search, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCepAutocomplete } from "@/hooks/useCepAutocomplete";

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

// Ícone WhatsApp SVG - Verde oficial
const WhatsAppIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
  </svg>
);

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
  const { buscarCep, loading: cepLoading, error: cepError, clearError: clearCepError } = useCepAutocomplete();
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
            tipo: (c.tipo || "celular").trim().toLowerCase(),
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
    const contato = contatos[idx];
    const contatosDeTipo = contatos.filter(c => c.tipo === contato.tipo);
    
    // Se é o único do tipo, não pode desmarcar
    if (contatosDeTipo.length === 1) {
      toast({ 
        title: "Aviso", 
        description: "Deve haver sempre um contato principal de cada tipo!", 
        variant: "destructive" 
      });
      return;
    }

    const updated = contatos.map((c, i) => ({
      ...c,
      is_primary: i === idx ? !c.is_primary : false,
    }));
    setContatos(updated);
  };

  const handleToggleWhatsApp = (idx: number) => {
    const updated = [...contatos];
    updated[idx] = { ...updated[idx], is_whatsapp: !updated[idx].is_whatsapp };
    setContatos(updated);
  };

  const handleSetLogin = (idx: number) => {
    // Apenas permite MARCAR como login, nunca desmarcar
    // E não permite ter mais de um login
    const temLoginJa = contatos.some((c, i) => c.is_login && i !== idx);
    
    if (temLoginJa) {
      toast({
        title: "Aviso",
        description: "Já existe um contato como login. Remova o outro antes.",
        variant: "destructive"
      });
      return;
    }

    const updated = contatos.map((c, i) => ({
      ...c,
      is_login: i === idx ? true : false,
    }));
    setContatos(updated);
  };

  const handleBuscarCep = async () => {
    clearCepError();
    const cepData = await buscarCep(formData.cep);
    if (cepData && !cepData.erro) {
      setFormData({
        ...formData,
        endereco: cepData.logradouro,
        bairro: cepData.bairro,
        cidade: cepData.localidade,
        estado: cepData.uf,
      });
      toast({ title: "Sucesso", description: "CEP encontrado!" });
    } else {
      toast({ title: "Erro", description: cepError || "CEP não encontrado", variant: "destructive" });
    }
  };

  const handleCepKeyDown = (e: React.KeyboardEvent) => {
    // Não permite Enter no campo de CEP para evitar submit
    if (e.key === "Enter") {
      e.preventDefault();
      handleBuscarCep();
    }
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    const salvarDados = async () => {
      try {
        if (!id) throw new Error("ID da pessoa não encontrado");

        // 1. Salvar dados de endereço em profiles
        const { error: perfilError } = await supabase
          .from("profiles")
          .update({
            cep: formData.cep,
            cidade: formData.cidade,
            bairro: formData.bairro,
            estado: formData.estado,
            endereco: formData.endereco,
            numero: formData.numero,
            complemento: formData.complemento,
          })
          .eq("id", id);

        if (perfilError) throw perfilError;

        // 2. Deletar contatos antigos
        const { error: deleteError } = await supabase
          .from("profile_contatos")
          .delete()
          .eq("profile_id", id);

        if (deleteError) throw deleteError;

        // 3. Inserir novos contatos
        if (contatos.length > 0) {
          const contatosParaInserir = contatos.map(c => ({
            profile_id: id,
            tipo: c.tipo,
            valor: c.valor,
            rotulo: c.rotulo,
            is_primary: c.is_primary,
            is_whatsapp: c.is_whatsapp,
            is_login: c.is_login,
          }));

          const { error: contatosError } = await supabase
            .from("profile_contatos")
            .insert(contatosParaInserir);

          if (contatosError) throw contatosError;
        }

        setLoading(false);
        toast({ title: "Sucesso", description: "Dados salvos com sucesso!" });
        navigate(-1);
      } catch (error) {
        console.error("Erro ao salvar:", error);
        setLoading(false);
        toast({ 
          title: "Erro", 
          description: "Falha ao salvar dados. Tente novamente.", 
          variant: "destructive" 
        });
      }
    };

    salvarDados();
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
              <div className="flex gap-2">
                <Input
                  id="cep"
                  value={formData.cep}
                  onChange={e => setFormData({
                    ...formData,
                    cep: e.target.value
                      .replace(/\D/g, '')
                      .replace(/(\d{5})(\d{0,3})/, (m, d1, d2) => { return d2 ? `${d1}-${d2}` : d1; })
                  })}
                  onKeyDown={handleCepKeyDown}
                  placeholder="00000-000"
                  maxLength={9}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleBuscarCep}
                  disabled={cepLoading || formData.cep.replace(/\D/g, '').length !== 8}
                  title="Buscar CEP"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              {cepError && <p className="text-sm text-destructive mt-1">{cepError}</p>}
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
                <div className="flex flex-wrap gap-2 mt-3 items-center">
                  <Button
                    type="button"
                    variant={contato.is_primary ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTogglePrimary(idx)}
                    title="Marcar como principal"
                    className="gap-2"
                  >
                    <Star className={cn("w-4 h-4", contato.is_primary ? "text-yellow-400" : "")} />
                    Principal
                  </Button>
                  {(contato.tipo === "celular" || contato.tipo === "fixo" || contato.tipo === "telefone") && (
                    <Button
                      type="button"
                      variant={contato.is_whatsapp ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleWhatsApp(idx)}
                      title="Marcar como WhatsApp"
                      className={cn("gap-2", contato.is_whatsapp && "bg-green-600 hover:bg-green-700 text-white")}
                    >
                      <WhatsAppIcon />
                      <span>WhatsApp</span>
                    </Button>
                  )}
                  {(contato.tipo === "email" || contato.tipo === "celular") && (
                    <Button
                      type="button"
                      variant={contato.is_login ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSetLogin(idx)}
                      disabled={contato.is_login || contatos.some((c, i) => c.is_login && i !== idx)}
                      title={contato.is_login ? "Este contato é o login" : contatos.some((c, i) => c.is_login && i !== idx) ? "Já existe um login" : "Usar como login"}
                      className="gap-2"
                    >
                      <Key className={cn("w-4 h-4", contato.is_login ? "text-blue-500" : "")} />
                      Login
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveContato(idx)}
                    title="Remover contato"
                    className="text-destructive ml-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remover
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
