import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import InputMask from "react-input-mask";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCepAutocomplete } from "@/hooks/useCepAutocomplete";
import { useToast } from "@/hooks/use-toast";

export interface DadosMembro {
  cpf: string;
  rg: string;
  estado_civil: string;
  profissao: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface Props {
  data: DadosMembro;
  onChange: (data: DadosMembro) => void;
  disabled?: boolean;
}

const estadosCivis = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União Estável" },
];

export function StepDadosMembro({ data, onChange, disabled }: Props) {
  const set = (field: keyof DadosMembro, value: string) =>
    onChange({ ...data, [field]: value });

  const { buscarCep, loading: cepLoading, error: cepError } = useCepAutocomplete();
  const { toast } = useToast();

  const handleCepBlur = async () => {
    const dados = await buscarCep(data.cep);
    if (dados) {
      onChange({
        ...data,
        logradouro: dados.logradouro || data.logradouro,
        bairro: dados.bairro || data.bairro,
        cidade: dados.localidade || data.cidade,
        estado: dados.uf || data.estado,
      });
    }
    if (cepError) {
      toast({ title: "Aviso", description: cepError, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cpf">CPF</Label>
          <InputMask
            mask="999.999.999-99"
            value={data.cpf}
            onChange={(e) => set("cpf", e.target.value)}
            disabled={disabled}
          >
            {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
              <Input {...inputProps} id="cpf" placeholder="000.000.000-00" />
            )}
          </InputMask>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rg">RG</Label>
          <Input
            id="rg"
            value={data.rg}
            onChange={(e) => set("rg", e.target.value)}
            placeholder="RG"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="estado_civil">Estado Civil</Label>
          <Select value={data.estado_civil} onValueChange={(v) => set("estado_civil", v)} disabled={disabled}>
            <SelectTrigger id="estado_civil">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {estadosCivis.map((ec) => (
                <SelectItem key={ec.value} value={ec.value}>{ec.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="profissao">Profissão</Label>
          <Input
            id="profissao"
            value={data.profissao}
            onChange={(e) => set("profissao", e.target.value)}
            placeholder="Profissão"
            disabled={disabled}
          />
        </div>
      </div>

      <p className="text-sm font-medium text-muted-foreground pt-1">Endereço</p>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cep">CEP</Label>
          <div className="relative">
            <InputMask
              mask="99999-999"
              value={data.cep}
              onChange={(e) => set("cep", e.target.value)}
              onBlur={handleCepBlur}
              disabled={disabled}
            >
              {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
                <Input {...inputProps} id="cep" placeholder="00000-000" className={cn(cepLoading && "pr-10")} />
              )}
            </InputMask>
            {cepLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="logradouro">Logradouro</Label>
          <Input
            id="logradouro"
            value={data.logradouro}
            onChange={(e) => set("logradouro", e.target.value)}
            placeholder="Rua, Av..."
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="numero">Número</Label>
          <Input id="numero" value={data.numero} onChange={(e) => set("numero", e.target.value)} placeholder="Nº" disabled={disabled} />
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="complemento">Complemento</Label>
          <Input id="complemento" value={data.complemento} onChange={(e) => set("complemento", e.target.value)} placeholder="Apto, Bloco..." disabled={disabled} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bairro">Bairro</Label>
          <Input id="bairro" value={data.bairro} onChange={(e) => set("bairro", e.target.value)} placeholder="Bairro" disabled={disabled} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" value={data.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Cidade" disabled={disabled} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estado_uf">Estado</Label>
          <Input id="estado_uf" value={data.estado} onChange={(e) => set("estado", e.target.value)} placeholder="UF" maxLength={2} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}
