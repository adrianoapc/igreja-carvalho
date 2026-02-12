import { useState, useEffect } from "react";
import { type InputHTMLAttributes } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star, Trash2, Zap, Key } from "lucide-react";
import { removerFormatacao } from "@/lib/validators";
import { useCepAutocomplete } from "@/hooks/useCepAutocomplete";
import { cn } from "@/lib/utils";

const TIPOS = [
  { value: "celular", label: "Celular" },
  { value: "fixo", label: "Fixo" },
  { value: "email", label: "E-mail" },
  { value: "instagram", label: "Instagram" },
];

// ...mantém schema/validação dos campos de endereço e dados pessoais...

interface EditarContatosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  dadosAtuais: {
    cep: string | null;
    cidade: string | null;
    bairro: string | null;
    estado: string | null;
    endereco: string | null;
    numero: string | null;
    complemento: string | null;
  };
  onSuccess: () => void;
}

function maskTelefone(value: string, tipo: string): string {
  const digits = value.replace(/\D/g, "").slice(0, tipo === "celular" ? 11 : 10);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (tipo === "celular") {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

export function EditarContatosDialog({
  open,
  onOpenChange,
  pessoaId,
  dadosAtuais,
  onSuccess,
}: EditarContatosDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cep: dadosAtuais.cep || "",
    cidade: dadosAtuais.cidade || "",
    bairro: dadosAtuais.bairro || "",
    estado: dadosAtuais.estado || "",
    endereco: dadosAtuais.endereco || "",
    numero: dadosAtuais.numero || "",
    complemento: dadosAtuais.complemento || "",
  });
  const [contatos, setContatos] = useState<
    Array<{
      id?: string;
      tipo: string;
      valor: string;
      rotulo: string;
      is_primary: boolean;
      is_whatsapp: boolean;
      is_login: boolean;
    }>
  >([]);
  const { toast } = useToast();
  const {
    buscarCep,
    loading: cepLoading,
    error: cepError,
  } = useCepAutocomplete();

  // Carregar contatos ao abrir
  useEffect(() => {
    if (open) {
      setFormData({
        cep: dadosAtuais.cep || "",
        cidade: dadosAtuais.cidade || "",
        bairro: dadosAtuais.bairro || "",
        estado: dadosAtuais.estado || "",
        endereco: dadosAtuais.endereco || "",
        numero: dadosAtuais.numero || "",
        complemento: dadosAtuais.complemento || "",
      });
      supabase
        .from("profile_contatos")
        .select("*")
        .eq("profile_id", pessoaId)
        .then(({ data }) => {
          setContatos(
            (data || []).map((c) => ({
              ...c,
              tipo: c.tipo || "celular",
              valor: c.valor || "",
              rotulo: c.rotulo || "",
              is_primary: !!c.is_primary,
              is_whatsapp: !!c.is_whatsapp,
              is_login: !!c.is_login,
            })),
          );
        });
    }
  }, [open, pessoaId, dadosAtuais]);

  // Adicionar novo contato
  const handleAddContato = () => {
    setContatos((prev) => [
      ...prev,
      {
        tipo: "celular",
        valor: "",
        rotulo: "Pessoal",
        is_primary: false,
        is_whatsapp: false,
        is_login: false,
      },
    ]);
  };

  // Remover contato
  const handleRemoveContato = (idx: number) => {
    setContatos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Atualizar campo
  const handleContatoChange = (
    idx: number,
    field: string,
    value: string | boolean,
  ) => {
    setContatos((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    );
  };

  // Garantir apenas 1 principal por tipo
  const handleTogglePrimary = (idx: number) => {
    const tipo = contatos[idx].tipo;
    setContatos((prev) =>
      prev.map((c, i) =>
        c.tipo === tipo ? { ...c, is_primary: i === idx } : c,
      ),
    );
  };

  // Salvar contatos (apenas profile_contatos)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Remove todos os contatos antigos e insere os novos
      await supabase
        .from("profile_contatos")
        .delete()
        .eq("profile_id", pessoaId);
      const contatosInsert = contatos
        .filter((c) => c.valor.trim())
        .map((c) => ({
          profile_id: pessoaId,
          tipo: c.tipo,
          valor: c.valor.trim(),
          rotulo: c.rotulo.trim(),
          is_primary: !!c.is_primary,
          is_whatsapp: !!c.is_whatsapp,
          is_login: !!c.is_login,
        }));
      if (contatosInsert.length > 0) {
        const { error } = await supabase
          .from("profile_contatos")
          .insert(contatosInsert);
        if (error) throw error;
      }
      toast({ title: "Sucesso", description: "Contatos atualizados!" });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCepBlur = async () => {
    const dados = await buscarCep(formData.cep);
    if (dados) {
      setFormData((prev) => ({
        ...prev,
        endereco: dados.logradouro || prev.endereco,
        bairro: dados.bairro || prev.bairro,
        cidade: dados.localidade || prev.cidade,
        estado: dados.uf || prev.estado,
      }));
    }
    if (cepError) {
      toast({
        title: "Aviso",
        description: cepError,
        variant: "destructive",
      });
    }
  };

  // Removeu duplicidade: handleSubmit já está definido acima para contatos e endereço

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Contatos"
    >
      <div className="flex flex-col h-full">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-2 py-4 md:px-12 md:py-8">
            {/* Campos de endereço e dados pessoais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <div className="relative">
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cep: e.target.value
                          .replace(/\D/g, "")
                          .replace(/(\d{5})(\d{0,3})/, (m, d1, d2) => {
                            return d2 ? `${d1}-${d2}` : d1;
                          }),
                      })
                    }
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) =>
                    setFormData({ ...formData, cidade: e.target.value })
                  }
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={formData.bairro}
                  onChange={(e) =>
                    setFormData({ ...formData, bairro: e.target.value })
                  }
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  value={formData.estado}
                  onChange={(e) =>
                    setFormData({ ...formData, estado: e.target.value })
                  }
                  maxLength={2}
                  placeholder="SP"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="endereco">Endereço</Label>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="md:col-span-4 col-span-1">
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) =>
                        setFormData({ ...formData, endereco: e.target.value })
                      }
                      maxLength={255}
                      placeholder="Rua, avenida, etc."
                    />
                  </div>
                  <div className="md:col-span-1 col-span-1">
                    <Input
                      id="numero"
                      value={formData.numero || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, numero: e.target.value })
                      }
                      maxLength={10}
                      placeholder="Nº"
                    />
                  </div>
                  <div className="md:col-span-1 col-span-1">
                    <Input
                      id="complemento"
                      value={formData.complemento || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          complemento: e.target.value,
                        })
                      }
                      maxLength={50}
                      placeholder="Compl."
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Lista dinâmica de contatos */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <Label>Contatos</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddContato}
                >
                  + Adicionar Contato
                </Button>
              </div>
              <div className="space-y-6 max-h-[340px] md:max-h-[420px] overflow-y-auto pr-1">
                {contatos.map((contato, idx) => (
                  <div
                    key={idx}
                    className="border rounded-xl p-4 bg-muted/50 shadow-sm flex flex-col gap-3"
                  >
                    <div className="grid grid-cols-1 gap-3 items-end">
                      {/* Tipo */}
                      <div>
                        <select
                          className="w-full border rounded px-2 py-1"
                          value={contato.tipo}
                          onChange={(e) =>
                            handleContatoChange(idx, "tipo", e.target.value)
                          }
                        >
                          {TIPOS.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* Valor */}
                      <div>
                        {contato.tipo === "celular" ||
                        contato.tipo === "fixo" ? (
                          <Input
                            value={contato.valor}
                            onChange={(e) => {
                              // Só aplica máscara se o valor realmente mudou
                              const raw = e.target.value;
                              // Se já está formatado, não re-mascarar
                              if (raw === contato.valor) return;
                              handleContatoChange(
                                idx,
                                "valor",
                                maskTelefone(raw, contato.tipo),
                              );
                            }}
                            placeholder={
                              contato.tipo === "celular" ? "Celular" : "Fixo"
                            }
                            inputMode="tel"
                            maxLength={contato.tipo === "celular" ? 15 : 14}
                          />
                        ) : (
                          <Input
                            value={contato.valor}
                            onChange={(e) =>
                              handleContatoChange(idx, "valor", e.target.value)
                            }
                            placeholder={
                              contato.tipo === "email" ? "E-mail" : "Instagram"
                            }
                          />
                        )}
                      </div>
                      {/* Rótulo como select fixo */}
                      <div>
                        <select
                          className="w-full border rounded px-2 py-1"
                          value={contato.rotulo}
                          onChange={(e) =>
                            handleContatoChange(idx, "rotulo", e.target.value)
                          }
                        >
                          <option value="Pessoal">Pessoal</option>
                          <option value="Trabalho">Trabalho</option>
                          <option value="Recado">Recado</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {/* Principal */}
                      <Button
                        type="button"
                        variant={contato.is_primary ? "default" : "outline"}
                        size="icon"
                        onClick={() => handleTogglePrimary(idx)}
                        title="Principal"
                      >
                        <Star
                          className={cn(
                            "w-4 h-4",
                            contato.is_primary
                              ? "text-yellow-500"
                              : "text-muted-foreground",
                          )}
                        />
                      </Button>
                      {/* Whatsapp */}
                      {(contato.tipo === "celular" ||
                        contato.tipo === "fixo") && (
                        <Button
                          type="button"
                          variant={contato.is_whatsapp ? "default" : "outline"}
                          size="icon"
                          onClick={() =>
                            handleContatoChange(
                              idx,
                              "is_whatsapp",
                              !contato.is_whatsapp,
                            )
                          }
                          title="WhatsApp"
                        >
                          <Zap
                            className={cn(
                              "w-4 h-4",
                              contato.is_whatsapp
                                ? "text-green-500"
                                : "text-muted-foreground",
                            )}
                          />
                        </Button>
                      )}
                      {/* Login */}
                      {(contato.tipo === "email" ||
                        contato.tipo === "celular") && (
                        <Button
                          type="button"
                          variant={contato.is_login ? "default" : "outline"}
                          size="icon"
                          onClick={() =>
                            handleContatoChange(
                              idx,
                              "is_login",
                              !contato.is_login,
                            )
                          }
                          title="Login"
                        >
                          <Key
                            className={cn(
                              "w-4 h-4",
                              contato.is_login
                                ? "text-blue-500"
                                : "text-muted-foreground",
                            )}
                          />
                        </Button>
                      )}
                      {/* Remover */}
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
            </div>
          </div>
          {/* Footer */}
          <div className="border-t bg-muted/50 px-4 py-3 md:px-12 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </ResponsiveDialog>
  );
}
