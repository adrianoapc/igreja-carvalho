import { useState } from "react";
import { differenceInYears, differenceInMonths } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  HeartHandshake,
  ChevronDown,
  ChevronUp,
  Phone,
  MessageCircle,
  Eye,
} from "lucide-react";

interface Responsavel {
  id: string;
  nome: string;
  telefone?: string;
  parentesco: string;
}

interface KidCardProps {
  id: string;
  nome: string;
  data_nascimento?: string;
  avatar_url?: string;
  alergias?: string;
  necessidades_especiais?: string;
  responsaveis?: Responsavel[];
}

export function KidCard({
  id,
  nome,
  data_nascimento,
  avatar_url,
  alergias,
  necessidades_especiais,
  responsaveis = [],
}: KidCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/pessoas/${id}`);
  };

  const calculateAge = () => {
    if (!data_nascimento) return null;
    const birthDate = new Date(data_nascimento);
    const years = differenceInYears(new Date(), birthDate);
    if (years >= 1) {
      return `${years} ${years === 1 ? "ano" : "anos"}`;
    }
    const months = differenceInMonths(new Date(), birthDate);
    return `${months} ${months === 1 ? "mês" : "meses"}`;
  };

  const age = calculateAge();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    return cleaned;
  };

  return (
    <Card 
      className="rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border-border/50 flex flex-col h-full"
    >
      <CardHeader className="pb-3 flex-1">
        <div className="space-y-2">
          {/* Topo: Avatar + Primeiro nome */}
          <div className="flex items-start gap-2">
            <Avatar className="w-12 h-12 border-2 border-primary/10 flex-shrink-0">
              <AvatarImage src={avatar_url} alt={nome} />
              <AvatarFallback className="bg-primary/5 text-primary font-semibold text-xs">
                {getInitials(nome)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              {/* Primeiro Nome em Destaque */}
              <h3 className="font-bold text-base leading-tight">
                {nome.split(" ")[0]}
              </h3>
              {/* Nome Completo em Tamanho Menor */}
              <p className="text-xs text-muted-foreground line-clamp-1">
                {nome}
              </p>
            </div>
          </div>

          {/* Idade */}
          {age && (
            <p className="text-xs font-medium text-foreground px-2 py-0.5 bg-primary/5 w-fit rounded">
              {age}
            </p>
          )}

          {/* Alertas Visuais - Ícones em destaque */}
          {(alergias || necessidades_especiais) && (
            <div className="flex gap-1.5 flex-wrap">
              {alergias && (
                <div className="flex items-center gap-1 bg-destructive/10 px-2 py-1 rounded text-xs">
                  <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" />
                  <span className="font-medium text-destructive">Alergia</span>
                </div>
              )}
              {necessidades_especiais && (
                <div className="flex items-center gap-1 bg-blue-100 px-2 py-1 rounded text-xs">
                  <HeartHandshake className="w-3 h-3 text-blue-700 flex-shrink-0" />
                  <span className="font-medium text-blue-700">Inclusão</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      {(alergias || necessidades_especiais || responsaveis.length > 0) && (
        <CardContent className="pt-0 flex-1 flex flex-col gap-2">
          <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex flex-col flex-1">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-xs text-muted-foreground hover:text-foreground h-8 px-2"
                onClick={(e) => e.stopPropagation()}
              >
                <span>
                  {responsaveis.length > 0
                    ? "Ver Responsáveis e Detalhes"
                    : "Ver Detalhes"}
                </span>
                {isOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-2 space-y-2 text-xs">
              {/* Alertas de Saúde - Detalhado */}
              {alergias && (
                <div className="space-y-1">
                  <p className="font-medium text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Alergias
                  </p>
                  <p className="text-muted-foreground bg-destructive/5 p-1.5 rounded">
                    {alergias}
                  </p>
                </div>
              )}

              {necessidades_especiais && (
                <div className="space-y-1">
                  <p className="font-medium text-blue-700 flex items-center gap-1">
                    <HeartHandshake className="w-3 h-3" />
                    Necessidades Especiais (Inclusão)
                  </p>
                  <p className="text-muted-foreground bg-blue-50 p-1.5 rounded">
                    {necessidades_especiais}
                  </p>
                </div>
              )}

              {/* Responsáveis */}
              {responsaveis.length > 0 && (
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    Responsáveis
                  </p>
                  {responsaveis.map((resp) => (
                    <div
                      key={resp.id}
                      className="flex items-center justify-between gap-1.5 bg-muted/30 p-1.5 rounded"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {resp.nome}
                        </p>
                        <p className="text-muted-foreground">
                          {resp.parentesco}
                        </p>
                      </div>
                      {resp.telefone && (
                        <div className="flex gap-0.5 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            asChild
                          >
                            <a
                              href={`tel:${formatPhone(resp.telefone)}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-green-600 hover:text-green-700"
                            asChild
                          >
                            <a
                              href={`https://wa.me/55${formatPhone(resp.telefone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="w-3 h-3" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 h-8 text-xs"
            onClick={handleCardClick}
          >
            <Eye className="w-3.5 h-3.5" />
            Ver Detalhes Completos
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
