import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, ExternalLink, ChevronRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isSameMonth, addMonths, startOfToday, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { EventoDetailsDialog } from "@/components/agenda/EventoDetailsDialog";

interface Evento {
  id: string;
  titulo: string;
  tipo: "CULTO" | "RELOGIO" | "TAREFA" | "EVENTO" | "OUTRO";
  data_evento: string;
  local: string | null;
  endereco: string | null;
  tema: string | null;
  descricao: string | null;
  pregador: string | null;
  exibir_preletor: boolean;
}

interface CultosGrouped {
  month: Date;
  monthLabel: string;
  cultos: Evento[];
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
} as const;

const monthHeaderVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 20
    }
  }
};

const eventVariants = {
  hidden: { 
    opacity: 0, 
    x: -50,
    scale: 0.9
  },
  visible: (index: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
      delay: index * 0.1
    }
  }),
  hover: {
    scale: 1.02,
    y: -4,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25
    }
  }
};

const dateCircleVariants = {
  hidden: { 
    scale: 0, 
    rotate: -180 
  },
  visible: (index: number) => ({
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 20,
      delay: index * 0.1
    }
  }),
  hover: {
    scale: 1.15,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 10
    }
  }
};

const timelineVariants = {
  hidden: { scaleY: 0, originY: 0 },
  visible: {
    scaleY: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1] as const
    }
  }
};

export default function Agenda() {
  const navigate = useNavigate();
  const [cultos, setCultos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);

  useEffect(() => {
    fetchCultos();
  }, []);

  const fetchCultos = async () => {
    setLoading(true);
    try {
      const today = startOfToday();
      const threeMonthsLater = endOfMonth(addMonths(today, 3));
      
      const { data, error } = await supabase
        .from("eventos")
        .select("id, titulo, tipo, data_evento, local, endereco, tema, descricao, pregador, exibir_preletor")
        .gte("data_evento", today.toISOString())
        .lte("data_evento", threeMonthsLater.toISOString())
        .eq("status", "confirmado")
        .order("data_evento", { ascending: true });

      if (error) throw error;
      setCultos(data || []);
    } catch (error) {
      console.error("Error fetching cultos:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case "culto de celebração":
      case "culto_domingo":
        return "bg-primary text-primary-foreground";
      case "culto de oração":
      case "culto_oracao":
        return "bg-amber-500 text-white";
      case "culto de ensino":
      case "culto_ensino":
        return "bg-emerald-500 text-white";
      case "culto de jovens":
      case "culto_jovens":
        return "bg-violet-500 text-white";
      case "santa ceia":
        return "bg-rose-500 text-white";
      case "batismo":
        return "bg-sky-500 text-white";
      case "evento especial":
        return "bg-orange-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getBorderColor = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case "culto de celebração":
      case "culto_domingo":
        return "border-l-primary";
      case "culto de oração":
      case "culto_oracao":
        return "border-l-amber-500";
      case "culto de ensino":
      case "culto_ensino":
        return "border-l-emerald-500";
      case "culto de jovens":
      case "culto_jovens":
        return "border-l-violet-500";
      case "santa ceia":
        return "border-l-rose-500";
      case "batismo":
        return "border-l-sky-500";
      case "evento especial":
        return "border-l-orange-500";
      default:
        return "border-l-muted-foreground";
    }
  };

  const getGoogleMapsUrl = (endereco: string | null, local: string | null) => {
    const searchQuery = endereco || local || "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
  };

  // Group cultos by month
  const groupedCultos: CultosGrouped[] = cultos.reduce((acc: CultosGrouped[], culto) => {
    const cultoDate = parseISO(culto.data_evento);
    const existingGroup = acc.find(group => isSameMonth(group.month, cultoDate));
    
    if (existingGroup) {
      existingGroup.cultos.push(culto);
    } else {
      acc.push({
        month: cultoDate,
        monthLabel: format(cultoDate, "MMMM 'de' yyyy", { locale: ptBR }),
        cultos: [culto]
      });
    }
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 px-4 py-8">
        <main className="container max-w-2xl mx-auto px-0">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="h-6 bg-muted rounded w-48 mb-4 animate-pulse"></div>
                <div className="flex gap-4">
                  <div className="w-14 h-14 bg-muted rounded-full animate-pulse"></div>
                  <div className="flex-1 h-24 bg-muted rounded-lg animate-pulse"></div>
                </div>
              </motion.div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-4 py-8">
      <main className="container max-w-2xl mx-auto px-0">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Agenda de Eventos
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Próximos eventos dos próximos 3 meses
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {cultos.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  >
                    <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                  </motion.div>
                  <h3 className="text-lg font-semibold mb-2">Nenhum evento agendado</h3>
                  <p className="text-muted-foreground text-sm">
                    Não há eventos confirmados para os próximos dias.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div 
              className="space-y-8"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {groupedCultos.map((group, groupIndex) => (
                <motion.div 
                  key={group.monthLabel}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: groupIndex * 0.2 }}
                >
                  {/* Month Header */}
                  <motion.div 
                    className="flex items-center gap-3 mb-6"
                    variants={monthHeaderVariants}
                  >
                    <motion.div 
                      className="h-px flex-1 bg-border"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.5, delay: groupIndex * 0.2 }}
                    />
                    <motion.h2 
                      className="text-sm font-semibold uppercase tracking-wider text-primary px-3 py-1 bg-primary/10 rounded-full"
                      whileHover={{ scale: 1.05 }}
                    >
                      {group.monthLabel}
                    </motion.h2>
                    <motion.div 
                      className="h-px flex-1 bg-border"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.5, delay: groupIndex * 0.2 }}
                    />
                  </motion.div>

                  {/* Events Timeline */}
                  <div className="space-y-4">
                    {group.cultos.map((culto, index) => {
                      const cultoDate = parseISO(culto.data_evento);
                      const day = format(cultoDate, "d");
                      const weekDay = format(cultoDate, "EEEE", { locale: ptBR });
                      const time = format(cultoDate, "HH:mm");

                      return (
                        <motion.div 
                          key={culto.id} 
                          className="flex gap-4 group"
                          custom={index}
                          variants={eventVariants}
                          whileHover="hover"
                        >
                          {/* Date Circle */}
                          <div className="flex flex-col items-center">
                            <motion.div 
                              className={cn(
                                "w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl",
                                "bg-primary/10 text-primary border-2 border-primary/20"
                              )}
                              custom={index}
                              variants={dateCircleVariants}
                              whileHover="hover"
                            >
                              {day}
                            </motion.div>
                            {/* Timeline connector */}
                            {index < group.cultos.length - 1 && (
                              <motion.div 
                                className="w-0.5 h-full min-h-[1rem] bg-border mt-2"
                                variants={timelineVariants}
                              />
                            )}
                          </div>

                          {/* Event Card */}
                          <Card 
                            className={cn(
                              "flex-1 overflow-hidden cursor-pointer relative",
                              "border-l-4",
                              getBorderColor(culto.tipo)
                            )}
                            onClick={() => setSelectedEvento(culto)}
                          >
                            <CardContent className="p-4">
                              {/* Event Title */}
                              <motion.h3 
                                className="font-bold text-lg text-primary mb-1 uppercase tracking-wide"
                                layoutId={`title-${culto.id}`}
                              >
                                {culto.titulo}
                              </motion.h3>
                              
                              {/* Date and Time */}
                              <p className="text-sm text-muted-foreground mb-3 capitalize">
                                {weekDay}, {format(cultoDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                <span className="mx-2">•</span>
                                <Clock className="w-3 h-3 inline-block mr-1" />
                                {time}
                              </p>

                              {/* Location */}
                              {(culto.local || culto.endereco) && (
                                <motion.a
                                  href={getGoogleMapsUrl(culto.endereco, culto.local)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-primary transition-colors group/link"
                                  whileHover={{ x: 4 }}
                                  whileTap={{ scale: 0.98 }}
                                >
                                  <MapPin className="w-4 h-4 text-primary" />
                                  <span className="flex flex-col">
                                    {culto.local && (
                                      <span className="font-semibold">{culto.local}</span>
                                    )}
                                    {culto.endereco && (
                                      <span className="text-xs text-muted-foreground group-hover/link:text-primary transition-colors">
                                        {culto.endereco}
                                      </span>
                                    )}
                                  </span>
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                </motion.a>
                              )}

                              {/* Theme badge if exists */}
                              {culto.tema && (
                                <motion.div 
                                  className="mt-3 pt-3 border-t border-border"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.3 }}
                                >
                                  <span className="text-xs text-muted-foreground">Tema: </span>
                                  <span className="text-sm font-medium">{culto.tema}</span>
                                </motion.div>
                              )}

                              {/* Arrow indicator */}
                              <motion.div 
                                className="absolute right-4 top-1/2 -translate-y-1/2"
                                initial={{ opacity: 0, x: -10 }}
                                whileHover={{ opacity: 1, x: 0 }}
                              >
                                <ChevronRight className="w-5 h-5 text-primary" />
                              </motion.div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info */}
        {cultos.length > 0 && (
          <motion.div 
            className="mt-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-muted-foreground">
              {cultos.length} evento{cultos.length !== 1 ? 's' : ''} nos próximos 3 meses
            </p>
          </motion.div>
        )}

        {/* Event Details Dialog */}
        <EventoDetailsDialog 
          evento={selectedEvento}
          open={!!selectedEvento}
          onOpenChange={(open) => !open && setSelectedEvento(null)}
        />
      </main>
    </div>
  );
}
