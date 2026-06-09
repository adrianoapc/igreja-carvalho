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

export interface DadosBasicos {
  nome: string;
  telefone: string;
  email: string;
  sexo: string;
}

interface Props {
  data: DadosBasicos;
  onChange: (data: DadosBasicos) => void;
  disabled?: boolean;
}

export function StepDadosBasicos({ data, onChange, disabled }: Props) {
  const set = (field: keyof DadosBasicos, value: string) =>
    onChange({ ...data, [field]: value });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome completo *</Label>
        <Input
          id="nome"
          value={data.nome}
          onChange={(e) => set("nome", e.target.value)}
          placeholder="Nome completo"
          disabled={disabled}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefone">Telefone</Label>
        <InputMask
          mask="(99) 99999-9999"
          value={data.telefone}
          onChange={(e) => set("telefone", e.target.value)}
          disabled={disabled}
        >
          {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
            <Input
              {...inputProps}
              id="telefone"
              type="tel"
              placeholder="(00) 00000-0000"
            />
          )}
        </InputMask>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={data.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="email@exemplo.com"
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sexo">Sexo</Label>
        <Select
          value={data.sexo}
          onValueChange={(v) => set("sexo", v)}
          disabled={disabled}
        >
          <SelectTrigger id="sexo">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="masculino">Masculino</SelectItem>
            <SelectItem value="feminino">Feminino</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
