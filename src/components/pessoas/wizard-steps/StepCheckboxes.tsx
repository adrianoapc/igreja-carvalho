import { Checkbox } from "@/components/ui/checkbox";
import type { TipoPessoa } from "./StepTipo";

export interface DadosCheckboxes {
  aceitou_jesus: boolean;
  batizado: boolean;
  deseja_contato: boolean;
  recebeu_brinde: boolean;
}

interface Props {
  data: DadosCheckboxes;
  onChange: (data: DadosCheckboxes) => void;
  tipo: TipoPessoa;
  disabled?: boolean;
}

export function StepCheckboxes({ data, onChange, tipo, disabled }: Props) {
  const set = (field: keyof DadosCheckboxes, value: boolean) =>
    onChange({ ...data, [field]: value });

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <Checkbox
          id="aceitou_jesus"
          checked={data.aceitou_jesus}
          onCheckedChange={(v) => set("aceitou_jesus", v as boolean)}
          disabled={disabled}
        />
        <label htmlFor="aceitou_jesus" className="text-sm font-medium leading-none cursor-pointer">
          Aceitou Jesus
        </label>
      </div>

      <div className="flex items-center space-x-3">
        <Checkbox
          id="batizado"
          checked={data.batizado}
          onCheckedChange={(v) => set("batizado", v as boolean)}
          disabled={disabled}
        />
        <label htmlFor="batizado" className="text-sm font-medium leading-none cursor-pointer">
          Convertido / Batizado
        </label>
      </div>

      {tipo === "visitante" && (
        <>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="deseja_contato"
              checked={data.deseja_contato}
              onCheckedChange={(v) => set("deseja_contato", v as boolean)}
              disabled={disabled}
            />
            <label htmlFor="deseja_contato" className="text-sm font-medium leading-none cursor-pointer">
              Deseja receber contato da igreja
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="recebeu_brinde"
              checked={data.recebeu_brinde}
              onCheckedChange={(v) => set("recebeu_brinde", v as boolean)}
              disabled={disabled}
            />
            <label htmlFor="recebeu_brinde" className="text-sm font-medium leading-none cursor-pointer">
              Recebeu brinde
            </label>
          </div>
        </>
      )}
    </div>
  );
}
