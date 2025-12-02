import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, ExternalLink, Share2, User, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

interface Culto {
  id: string;
  titulo: string;
  tipo: string;
  data_culto: string;
  local: string | null;
  endereco: string | null;
  tema: string | null;
  descricao: string | null;
  pregador: string | null;
}

interface EventoDetailsDialogProps {
  evento: Culto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventoDetailsDialog({ evento, open, onOpenChange }: EventoDetailsDialogProps) {
  if (!evento) return null;

  const cultoDate = parseISO(evento.data_culto);
  const weekDay = format(cultoDate, "EEEE", { locale: ptBR });
  const fullDate = format(cultoDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const time = format(cultoDate, "HH:mm");

  const getGoogleMapsUrl = (endereco: string | null, local: string | null) => {
    const searchQuery = endereco || local || "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
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

  const handleShareWhatsApp = () => {
    const mapsUrl = getGoogleMapsUrl(evento.endereco, evento.local);
    const locationText = evento.local ? `📍 ${evento.local}` : "";
    const addressText = evento.endereco ? `\n${evento.endereco}` : "";
    const themeText = evento.tema ? `\n🎯 Tema: ${evento.tema}` : "";
    const preacherText = evento.pregador ? `\n🎤 Preletor: ${evento.pregador}` : "";
    
    const message = `🙏 *${evento.titulo}*

📅 ${weekDay}, ${fullDate}
🕐 ${time}h
${locationText}${addressText}${themeText}${preacherText}

📍 Como chegar: ${mapsUrl}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Badge className={`${getTipoColor(evento.tipo)} mb-2 text-xs`}>
              {evento.tipo}
            </Badge>
            <DialogTitle className="text-xl font-bold text-primary uppercase tracking-wide">
              {evento.titulo}
            </DialogTitle>
          </motion.div>
        </DialogHeader>

        <motion.div 
          className="space-y-4 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          {/* Date and Time */}
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <Calendar className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium capitalize">{weekDay}</p>
              <p className="text-sm text-muted-foreground">{fullDate}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {time}h
              </p>
            </div>
          </div>

          {/* Location */}
          {(evento.local || evento.endereco) && (
            <a
              href={getGoogleMapsUrl(evento.endereco, evento.local)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors group"
            >
              <MapPin className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                {evento.local && (
                  <p className="font-medium group-hover:text-primary transition-colors">
                    {evento.local}
                  </p>
                )}
                {evento.endereco && (
                  <p className="text-sm text-muted-foreground">
                    {evento.endereco}
                  </p>
                )}
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          )}

          {/* Theme */}
          {evento.tema && (
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Tema</p>
                <p className="font-medium">{evento.tema}</p>
              </div>
            </div>
          )}

          {/* Preletor */}
          {evento.pregador && (
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <User className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Preletor</p>
                <p className="font-medium">{evento.pregador}</p>
              </div>
            </div>
          )}

          {/* Description */}
          {evento.descricao && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Descrição</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{evento.descricao}</p>
            </div>
          )}

          {/* Share Button */}
          <Button 
            onClick={handleShareWhatsApp}
            className="w-full gap-2"
            variant="default"
          >
            <Share2 className="w-4 h-4" />
            Compartilhar no WhatsApp
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
