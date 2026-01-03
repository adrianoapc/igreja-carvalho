import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const availabilityOptions = [
  "Domingos (manhã)",
  "Domingos (noite)",
  "Durante a semana",
  "Eventos pontuais",
  "Flexível",
];

const experienceOptions = [
  "Nenhuma experiência (quero aprender)",
  "Já servi antes",
  "Sirvo atualmente",
];

interface InscricaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ministerio: string;
  perfil?: {
    nome: string;
    telefone: string;
    email: string;
  };
  onSubmit: (data: {
    disponibilidade: string;
    experiencia: string;
    observacoes: string;
    telefone?: string;
    email?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export default function InscricaoModal({
  open,
  onOpenChange,
  ministerio,
  perfil,
  onSubmit,
  isSubmitting,
}: InscricaoModalProps) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await onSubmit({
      disponibilidade: formData.get("disponibilidade") as string,
      experiencia: formData.get("experiencia") as string,
      observacoes: formData.get("observacoes") as string,
      telefone: (formData.get("telefone") as string) || undefined,
      email: (formData.get("email") as string) || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader>
            <DialogTitle>Candidatar-se a {ministerio}</DialogTitle>
            <DialogDescription>
              Preencha as informações para completar sua candidatura
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {perfil?.nome && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-sm text-green-700">
                  ✓ Você está conectado como <strong>{perfil.nome}</strong>
                </p>
              </div>
            )}

            {!perfil?.telefone && (
              <div className="space-y-2">
                <Label htmlFor="telefone">WhatsApp</Label>
                <Input
                  id="telefone"
                  name="telefone"
                  placeholder="(11) 99999-9999"
                  type="tel"
                />
              </div>
            )}

            {!perfil?.email && (
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  placeholder="seu@email.com"
                  type="email"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="disponibilidade">
                Disponibilidade <span className="text-red-500">*</span>
              </Label>
              <Select name="disponibilidade" required>
                <SelectTrigger id="disponibilidade">
                  <SelectValue placeholder="Selecione sua disponibilidade" />
                </SelectTrigger>
                <SelectContent>
                  {availabilityOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experiencia">
                Experiência <span className="text-red-500">*</span>
              </Label>
              <Select name="experiencia" required>
                <SelectTrigger id="experiencia">
                  <SelectValue placeholder="Selecione seu nível" />
                </SelectTrigger>
                <SelectContent>
                  {experienceOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                placeholder="Conte sobre seus dons, horários preferidos ou outras informações relevantes."
                rows={4}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Candidatura"
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
