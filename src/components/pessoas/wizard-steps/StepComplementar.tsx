import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DadosComplementares {
  dia_nascimento: string;
  mes_nascimento: string;
  ano_nascimento: string;
  entrou_por: string;
  observacoes: string;
}

interface Props {
  data: DadosComplementares;
  onChange: (data: DadosComplementares) => void;
  disabled?: boolean;
}

const dias = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, "0"));
const meses = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];
const anoAtual = new Date().getFullYear();
const anos = Array.from({ length: anoAtual - 1920 + 1 }, (_, i) => (anoAtual - i).toString());

const opcoesComoConheceu = [
  { value: "indicacao", label: "Indicação de amigo/familiar" },
  { value: "redes_sociais", label: "Redes sociais" },
  { value: "google", label: "Pesquisa no Google" },
  { value: "passou_na_frente", label: "Passou na frente da igreja" },
  { value: "evento", label: "Evento da igreja" },
  { value: "convite_membro", label: "Convite de membro" },
  { value: "outro", label: "Outro" },
];

export function StepComplementar({ data, onChange, disabled }: Props) {
  const set = (field: keyof DadosComplementares, value: string) =>
    onChange({ ...data, [field]: value });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Data de nascimento</Label>
        <div className="grid grid-cols-3 gap-2">
          <Select value={data.dia_nascimento} onValueChange={(v) => set("dia_nascimento", v)} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="Dia" /></SelectTrigger>
            <SelectContent>
              {dias.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={data.mes_nascimento} onValueChange={(v) => set("mes_nascimento", v)} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              {meses.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={data.ano_nascimento} onValueChange={(v) => set("ano_nascimento", v)} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              {anos.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="entrou_por">Como conheceu a igreja?</Label>
        <Select value={data.entrou_por} onValueChange={(v) => set("entrou_por", v)} disabled={disabled}>
          <SelectTrigger id="entrou_por">
            <SelectValue placeholder="Selecione uma opção" />
          </SelectTrigger>
          <SelectContent>
            {opcoesComoConheceu.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          value={data.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          placeholder="Observações sobre a pessoa..."
          disabled={disabled}
          className="min-h-[80px]"
        />
      </div>
    </div>
  );
}
