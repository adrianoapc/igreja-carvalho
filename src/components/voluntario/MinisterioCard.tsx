import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MinisterioCardProps {
  nome: string;
  descricao: string;
  icone: LucideIcon;
  cor: string;
  vagas?: number;
  dificuldade?: "fácil" | "médio" | "avançado";
  requisitos?: string[];
  onSelect: () => void;
  desabilitado?: boolean;
  motivo?: string;
}

export default function MinisterioCard({
  nome,
  descricao,
  icone: Icon,
  cor,
  vagas,
  dificuldade,
  requisitos,
  onSelect,
  desabilitado,
  motivo,
}: MinisterioCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!desabilitado ? { translateY: -4 } : {}}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={`relative overflow-hidden transition-all ${
          desabilitado
            ? "opacity-60 cursor-not-allowed bg-muted/30"
            : "hover:shadow-lg cursor-pointer hover:border-primary/50"
        }`}
      >
        {/* Barra de cor no topo */}
        <div className={`h-1.5 w-full ${cor}`} />

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className={`p-2.5 rounded-lg ${cor} bg-opacity-10`}>
                <Icon className={`w-6 h-6 ${cor.replace("bg-", "text-")}`} />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">{nome}</CardTitle>
                {vagas && (
                  <CardDescription className="text-xs mt-1">
                    {vagas} vagas disponíveis
                  </CardDescription>
                )}
              </div>
            </div>
            {dificuldade && (
              <Badge
                variant={
                  dificuldade === "fácil"
                    ? "default"
                    : dificuldade === "médio"
                      ? "secondary"
                      : "outline"
                }
                className="text-xs"
              >
                {dificuldade}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{descricao}</p>

          {requisitos && requisitos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Requisitos
              </p>
              <ul className="text-xs space-y-1">
                {requisitos.map((req, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-primary" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <motion.div
            whileHover={!desabilitado ? { x: 4 } : {}}
            transition={{ duration: 0.2 }}
          >
            <Button
              onClick={onSelect}
              disabled={desabilitado}
              className="w-full gap-2"
              variant={desabilitado ? "outline" : "default"}
            >
              {desabilitado ? "Indisponível" : "Candidatar-se"}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </motion.div>

          {desabilitado && motivo && (
            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
              {motivo}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
