import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Phone, Plus, Save, Trash2, Loader2, ArrowLeft, Building2, Edit } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface WhatsAppNumero {
  id: string;
  igreja_id: string;
  filial_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  provider: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  filial?: { nome: string } | null;
}

interface Filial {
  id: string;
  nome: string;
}

interface Props {
  onBack?: () => void;
}

export default function WhatsAppNumeros({ onBack }: Props) {
  const { igrejaId } = useIgrejaId();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNumero, setEditingNumero] = useState<WhatsAppNumero | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    filial_id: "",
    phone_number_id: "",
    display_phone_number: "",
    provider: "meta",
    enabled: true,
  });

  // Fetch WhatsApp numbers
  const { data: numeros = [], isLoading } = useQuery({
    queryKey: ["whatsapp-numeros", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from("whatsapp_numeros")
        .select("*, filial:filiais(nome)")
        .eq("igreja_id", igrejaId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as WhatsAppNumero[];
    },
    enabled: !!igrejaId,
  });

  // Fetch filiais
  const { data: filiais = [] } = useQuery({
    queryKey: ["filiais", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from("filiais")
        .select("id, nome")
        .eq("igreja_id", igrejaId)
        .order("nome");
      
      if (error) throw error;
      return data as Filial[];
    },
    enabled: !!igrejaId,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (!igrejaId) throw new Error("Igreja não identificada");
      
      const payload = {
        igreja_id: igrejaId,
        filial_id: data.filial_id || null,
        phone_number_id: data.phone_number_id || null,
        display_phone_number: data.display_phone_number || null,
        provider: data.provider,
        enabled: data.enabled,
      };

      if (data.id) {
        const { error } = await supabase
          .from("whatsapp_numeros")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_numeros")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-numeros"] });
      toast.success(editingNumero ? "Número atualizado!" : "Número cadastrado!");
      handleCloseDialog();
    },
    onError: (error) => {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar número");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_numeros")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-numeros"] });
      toast.success("Número removido!");
    },
    onError: (error) => {
      console.error("Erro ao remover:", error);
      toast.error("Erro ao remover número");
    },
  });

  // Toggle enabled mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("whatsapp_numeros")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-numeros"] });
    },
    onError: (error) => {
      console.error("Erro ao atualizar:", error);
      toast.error("Erro ao atualizar status");
    },
  });

  const handleOpenDialog = (numero?: WhatsAppNumero) => {
    if (numero) {
      setEditingNumero(numero);
      setFormData({
        filial_id: numero.filial_id || "",
        phone_number_id: numero.phone_number_id || "",
        display_phone_number: numero.display_phone_number || "",
        provider: numero.provider,
        enabled: numero.enabled,
      });
    } else {
      setEditingNumero(null);
      setFormData({
        filial_id: "",
        phone_number_id: "",
        display_phone_number: "",
        provider: "meta",
        enabled: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingNumero(null);
    setFormData({
      filial_id: "",
      phone_number_id: "",
      display_phone_number: "",
      provider: "meta",
      enabled: true,
    });
  };

  const handleSave = () => {
    if (!formData.display_phone_number) {
      toast.error("Informe o número de telefone");
      return;
    }
    saveMutation.mutate({ ...formData, id: editingNumero?.id });
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case "meta": return "Meta Cloud API";
      case "evolution": return "Evolution API";
      case "make": return "Make.com";
      default: return provider;
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case "meta": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "evolution": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "make": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Números WhatsApp</h1>
            <p className="text-muted-foreground">Gerencie os números de WhatsApp por filial</p>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Número
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingNumero ? "Editar Número" : "Novo Número WhatsApp"}</DialogTitle>
              <DialogDescription>
                Configure um número de WhatsApp para envio de mensagens.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="display_phone_number">Número de Telefone *</Label>
                <Input
                  id="display_phone_number"
                  placeholder="5517999999999"
                  value={formData.display_phone_number}
                  onChange={(e) => setFormData({ ...formData, display_phone_number: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Formato: código do país + DDD + número (ex: 5517999999999)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number_id">Phone Number ID (Meta)</Label>
                <Input
                  id="phone_number_id"
                  placeholder="ID do número no Meta Business"
                  value={formData.phone_number_id}
                  onChange={(e) => setFormData({ ...formData, phone_number_id: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Obrigatório para Meta Cloud API</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filial">Filial</Label>
                <Select
                  value={formData.filial_id}
                  onValueChange={(value) => setFormData({ ...formData, filial_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as filiais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as filiais</SelectItem>
                    {filiais.map((filial) => (
                      <SelectItem key={filial.id} value={filial.id}>
                        {filial.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">Provedor</Label>
                <Select
                  value={formData.provider}
                  onValueChange={(value) => setFormData({ ...formData, provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Meta Cloud API</SelectItem>
                    <SelectItem value="evolution">Evolution API</SelectItem>
                    <SelectItem value="make">Make.com</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Ativo</Label>
                  <p className="text-xs text-muted-foreground">Habilitar envio de mensagens</p>
                </div>
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingNumero ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Números Cadastrados
          </CardTitle>
          <CardDescription>
            Números de WhatsApp configurados para envio de mensagens
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : numeros.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Nenhum número cadastrado</p>
              <p className="text-sm">Clique em "Novo Número" para adicionar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {numeros.map((numero) => (
                <div
                  key={numero.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{numero.display_phone_number || "Sem número"}</span>
                        <Badge variant="outline" className={getProviderColor(numero.provider)}>
                          {getProviderLabel(numero.provider)}
                        </Badge>
                        {!numero.enabled && (
                          <Badge variant="secondary">Desativado</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {numero.filial?.nome || "Todas as filiais"}
                        {numero.phone_number_id && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-xs">ID: {numero.phone_number_id}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={numero.enabled}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: numero.id, enabled: checked })}
                      disabled={toggleMutation.isPending}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(numero)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Deseja remover este número?")) {
                          deleteMutation.mutate(numero.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
