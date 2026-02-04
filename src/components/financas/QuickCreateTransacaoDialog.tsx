
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { format, parseISO } from "date-fns";

const formSchema = z.object({
  descricao: z.string().min(3, "A descrição é obrigatória."),
  valor: z.number().positive("O valor deve ser positivo."),
  data_pagamento: z.string().min(1, "A data é obrigatória."),
  conta_id: z.string().uuid("Selecione uma conta."),
  categoria_id: z.string().uuid("Selecione uma categoria."),
});

type FormValues = z.infer<typeof formSchema>;

interface ExtratoItem {
  id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: "credit" | "debit";
  conta_id: string;
}

interface QuickCreateTransacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extratoItem: ExtratoItem | null;
  onSuccess: () => void;
}

export function QuickCreateTransacaoDialog({
  open,
  onOpenChange,
  extratoItem,
  onSuccess,
}: QuickCreateTransacaoDialogProps) {
  const { igrejaId } = useIgrejaId();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      descricao: "",
      valor: 0,
      data_pagamento: "",
      conta_id: "",
      categoria_id: "",
    },
  });

  useEffect(() => {
    if (extratoItem) {
      form.reset({
        descricao: extratoItem.descricao,
        valor: Math.abs(extratoItem.valor),
        data_pagamento: format(parseISO(extratoItem.data_transacao), "yyyy-MM-dd"),
        conta_id: extratoItem.conta_id,
        categoria_id: "",
      });
    }
  }, [extratoItem, form]);

  const { data: contas } = useQuery({
    queryKey: ["contas", igrejaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contas")
        .select("id, nome")
        .eq("igreja_id", igrejaId!);
      return data;
    },
    enabled: !!igrejaId,
  });

  const { data: categorias } = useQuery({
    queryKey: ["categorias_financeiras", igrejaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("igreja_id", igrejaId!);
      return data;
    },
    enabled: !!igrejaId,
  });

  const createAndReconcileMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!extratoItem || !igrejaId) throw new Error("Dados incompletos.");

      const { data: transacaoData, error: transacaoError } = await supabase
        .from("transacoes_financeiras")
        .insert({
          descricao: values.descricao,
          valor: values.valor,
          data_pagamento: values.data_pagamento,
          data_vencimento: values.data_pagamento,
          data_competencia: values.data_pagamento,
          conta_id: values.conta_id,
          categoria_id: values.categoria_id,
          igreja_id: igrejaId,
          tipo: extratoItem.tipo === "credit" ? "entrada" : "saida",
          tipo_lancamento: "unico",
          status: "pago",
        })
        .select("id")
        .single();

      if (transacaoError) throw transacaoError;

      const { error: extratoError } = await supabase
        .from("extratos_bancarios")
        .update({
          reconciliado: true,
          transacao_vinculada_id: transacaoData.id,
        })
        .eq("id", extratoItem.id);

      if (extratoError) throw extratoError;
    },
    onSuccess: () => {
      toast.success("Transação criada e conciliada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["extratos-pendentes-inteligente"] });
      queryClient.invalidateQueries({ queryKey: ["transacoes-pendentes-inteligente"] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao criar e conciliar: " + error.message);
    },
  });

  const onSubmit = (values: FormValues) => {
    createAndReconcileMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançamento Rápido</DialogTitle>
          <DialogDescription>
            Crie uma nova transação baseada neste item do extrato.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data_pagamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="conta_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contas?.map((conta) => (
                        <SelectItem key={conta.id} value={conta.id}>
                          {conta.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoria_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categorias?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createAndReconcileMutation.isPending}>
                {createAndReconcileMutation.isPending ? "Salvando..." : "Criar e Conciliar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
