import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  User,
  BookOpen,
  ClipboardCheck,
  Trophy,
  ChevronRight,
  Heart,
} from "lucide-react";
import { motion } from "framer-motion";

interface IntegracaoInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ETAPAS = [
  {
    numero: 1,
    titulo: "Entrevista",
    duracao: "1-3 dias",
    descricao: "Admin/Líder agenda entrevista com você",
    objetivos: [
      "Confirmar sua disponibilidade",
      "Esclarecer expectativas do ministério",
      "Responder suas dúvidas",
    ],
    icon: User,
    cor: "bg-blue-100 text-blue-700",
    corBg: "bg-blue-50",
    proximo: "Aprovado na entrevista",
  },
  {
    numero: 2,
    titulo: "Trilha de Formação",
    duracao: "30-45 dias",
    descricao: "Você segue uma trilha de formação específica do ministério",
    objetivos: [
      "Estudar e aprender os fundamentos",
      "Completar materiais de formação",
      "Acompanhamento do mentor",
    ],
    icon: BookOpen,
    cor: "bg-green-100 text-green-700",
    corBg: "bg-green-50",
    proximo: "Completar 100% da trilha",
  },
  {
    numero: 3,
    titulo: "Mentoria",
    duracao: "15 dias",
    descricao: "Mentor acompanha você na prática do ministério",
    objetivos: [
      "Check-ins semanais com mentor",
      "Observação em ação real",
      "Feedback prático e orientação",
    ],
    icon: User,
    cor: "bg-purple-100 text-purple-700",
    corBg: "bg-purple-50",
    proximo: "Mentor aprova continuação",
  },
  {
    numero: 4,
    titulo: "Teste de Aptidão",
    duracao: "1-7 dias",
    descricao: "Você faz um teste para validar suas habilidades",
    objetivos: [
      "Demonstrar suas competências",
      "Ser avaliado conforme critérios",
      "Obter aprovação no teste",
    ],
    icon: ClipboardCheck,
    cor: "bg-orange-100 text-orange-700",
    corBg: "bg-orange-50",
    proximo: "Aprovado no teste",
  },
  {
    numero: 5,
    titulo: "Membro Ativo",
    duracao: "Permanente",
    descricao: "Você é oficialmente membro do ministério",
    objetivos: [
      "Participar de escalas",
      "Acompanhamento de 30/60/90 dias",
      "Crescimento e desenvolvimento contínuo",
    ],
    icon: Trophy,
    cor: "bg-yellow-100 text-yellow-700",
    corBg: "bg-yellow-50",
    proximo: "✅ Objetivo alcançado!",
  },
];

export function IntegracaoInfoModal({
  open,
  onOpenChange,
}: IntegracaoInfoModalProps) {
  const [etapaExpandida, setEtapaExpandida] = useState(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Heart className="w-6 h-6 text-red-500" />
            Como Funciona a Integração?
          </DialogTitle>
          <DialogDescription>
            Entenda passo a passo como você progride de candidato para membro ativo do ministério
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Timeline Visual */}
          <div className="flex items-center justify-between mb-8">
            {ETAPAS.map((etapa, idx) => (
              <div key={etapa.numero} className="flex items-center">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="flex flex-col items-center"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${etapa.cor}`}>
                    {etapa.numero}
                  </div>
                  <span className="text-xs text-center mt-2 max-w-16 text-muted-foreground">
                    {etapa.titulo}
                  </span>
                </motion.div>
                {idx < ETAPAS.length - 1 && (
                  <div className="w-8 h-0.5 bg-gray-200 mx-2" />
                )}
              </div>
            ))}
          </div>

          {/* Etapas Detalhadas */}
          <div className="space-y-4">
            {ETAPAS.map((etapa, idx) => (
              <motion.div
                key={etapa.numero}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    etapaExpandida === idx ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() =>
                    setEtapaExpandida(etapaExpandida === idx ? -1 : idx)
                  }
                >
                  <CardHeader className={`pb-3 ${etapa.corBg}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${etapa.cor}`}>
                          <etapa.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base">
                            Etapa {etapa.numero}: {etapa.titulo}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {etapa.descricao}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="whitespace-nowrap ml-2">
                        <Clock className="w-3 h-3 mr-1" />
                        {etapa.duracao}
                      </Badge>
                    </div>
                  </CardHeader>

                  {etapaExpandida === idx && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <CardContent className="pt-4 space-y-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-3">
                            O que você faz nesta etapa?
                          </h4>
                          <ul className="space-y-2">
                            {etapa.objetivos.map((objetivo, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span>{objetivo}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-2 border-t">
                          <p className="text-sm font-medium text-muted-foreground mb-2">
                            Próximo passo:
                          </p>
                          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                            <ChevronRight className="w-4 h-4" />
                            {etapa.proximo}
                          </div>
                        </div>
                      </CardContent>
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Info Box */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <h4 className="font-semibold text-sm mb-2">💡 Dicas Importantes</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  • Se não passar no teste, você pode tentar novamente após 30 dias
                </li>
                <li>
                  • Seu mentor está lá para ajudar você em cada etapa do processo
                </li>
                <li>
                  • O tempo total típico é de 60-90 dias, mas pode variar
                </li>
                <li>
                  • Acompanhe seu progresso na página "Minha Jornada"
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Entendi
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Quero me candidatar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
