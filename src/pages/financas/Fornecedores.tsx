import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Loader2, Building2, Phone, Mail, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Interface ajustada para o padrão mais provável
interface Fornecedor {
  id: string;
  nome: string; // ✅ Ajustado de 'nome_fantasia' para 'nome'
  razao_social: string | null;
  cnpj_cpf: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
}

export default function Fornecedores() {
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Fornecedor | null>(null);
  
  // Form simplificado para garantir
  const [formData, setFormData] = useState({ 
    nome: "", 
    razao_social: "", 
    cnpj_cpf: "", 
    telefone: "", 
    email: "" 
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      // Tenta buscar na tabela 'fornecedores' ordenando por 'nome'
      const { data, error } = await supabase
        .from("fornecedores") 
        .select("*")
        .order("nome"); // ✅ Ordenação corrigida

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      console.error("Erro fetch:", error);
      // O Toast vai te dizer exatamente qual coluna falta (ex: "column fornecedores.nome does not exist")
      toast.error("Erro ao carregar dados", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) return toast.error("Nome é obrigatório");

    setSaving(true);
    try {
      const payload = {
        nome: formData.nome, // ✅ Payload usa 'nome'
        razao_social: formData.razao_social || null,
        cnpj_cpf: formData.cnpj_cpf || null,
        telefone: formData.telefone || null,
        email: formData.email || null,
        ativo: true
      };

      if (editingItem) {
        const { error } = await supabase.from("fornecedores").update(payload).eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Atualizado com sucesso");
      } else {
        const { error } = await supabase.from("fornecedores").insert([payload]);
        if (error) throw error;
        toast.success("Criado com sucesso");
      }
      setIsDialogOpen(false);
      fetchItems();
    } catch (error: any) {
      toast.error("Erro ao salvar", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este fornecedor?")) return;
    try {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
      toast.success("Removido com sucesso");
      fetchItems();
    } catch (error: any) {
      toast.error("Erro ao excluir", { description: error.message });
    }
  };

  const openNew = () => {
    setEditingItem(null);
    setFormData({ nome: "", razao_social: "", cnpj_cpf: "", telefone: "", email: "" });
    setIsDialogOpen(true);
  };

  const openEdit = (item: Fornecedor) => {
    setEditingItem(item);
    setFormData({ 
      nome: item.nome, 
      razao_social: item.razao_social || "", 
      cnpj_cpf: item.cnpj_cpf || "", 
      telefone: item.telefone || "", 
      email: item.email || "" 
    });
    setIsDialogOpen(true);
  };

  const filteredItems = items.filter(i => 
    i.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.razao_social && i.razao_social.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (i.cnpj_cpf && i.cnpj_cpf.includes(searchTerm))
  );

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2"/>Carregando parceiros...</div>;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Fornecedores & Parceiros</h2>
          <p className="text-sm text-muted-foreground">Cadastro de prestadores de serviço e credores.</p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-2"/> Novo Fornecedor</Button>
      </div>

      {/* Tabela Card */}
      <Card className="border shadow-sm overflow-hidden">
        <div className="p-3 border-b bg-muted/5 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou documento..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="max-w-xs h-8 text-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/5">
                <TableHead>Nome / Razão</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-8 w-8 opacity-20" />
                      <p>Nenhum fornecedor encontrado.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.nome}</span>
                        {item.razao_social && item.razao_social !== item.nome && (
                          <span className="text-xs text-muted-foreground">{item.razao_social}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {item.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3"/> {item.email}</div>}
                        {item.telefone && <div className="flex items-center gap-1"><Phone className="h-3 w-3"/> {item.telefone}</div>}
                        {!item.email && !item.telefone && <span>-</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.cnpj_cpf ? <Badge variant="outline" className="font-mono text-[10px]">{item.cnpj_cpf}</Badge> : <span className="text-xs text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5"/></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="h-3.5 w-3.5"/></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader><DialogTitle>{editingItem ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium">Nome *</label>
                <Input value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} placeholder="Ex: Padaria do Zé" />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium">Razão Social</label>
                <Input value={formData.razao_social} onChange={e => setFormData({...formData, razao_social: e.target.value})} placeholder="Ex: José Silva LTDA" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">CNPJ / CPF</label>
                <Input value={formData.cnpj_cpf} onChange={e => setFormData({...formData, cnpj_cpf: e.target.value})} placeholder="00.000.000/0001-91" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefone</label>
                <Input value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} placeholder="(11) 99999-9999" />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="contato@empresa.com" type="email" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}