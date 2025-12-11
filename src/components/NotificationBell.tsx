import { Bell, Check, Trash2, Wallet, Users, HeartHandshake, Baby, AlertTriangle, Info, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Deep Linking Inteligente (Roteamento)
    const type = notification.type;
    if (type === 'sentimento_diario') navigate('/?sentimento=true');
    if (type?.startsWith('financeiro')) navigate('/financas/dashboard');
    if (type?.startsWith('kids')) navigate('/kids/dashboard');
    if (type?.includes('visitante')) navigate('/pessoas/visitantes');
    if (type?.includes('oracao') || type?.includes('pedido')) navigate('/intercessao/pedidos');
  };

  // Helper para ícone e cor baseado no tipo do evento
  const getEventStyle = (type: string) => {
    if (type?.includes('financeiro') || type?.includes('conta')) 
      return { icon: Wallet, color: "text-emerald-600 bg-emerald-100" };
    
    if (type?.includes('kids') || type?.includes('crianca')) 
      return { icon: Baby, color: "text-orange-600 bg-orange-100" };
    
    if (type?.includes('oracao') || type?.includes('pedido')) 
      return { icon: HeartHandshake, color: "text-purple-600 bg-purple-100" };
    
    if (type?.includes('visitante')) 
      return { icon: Users, color: "text-blue-600 bg-blue-100" };
    
    if (type?.includes('alerta') || type?.includes('critico')) 
      return { icon: AlertTriangle, color: "text-red-600 bg-red-100" };

    if (type?.includes('agenda') || type?.includes('escala')) 
        return { icon: CalendarClock, color: "text-indigo-600 bg-indigo-100" };

    return { icon: Info, color: "text-slate-600 bg-slate-100" };
  };

  // Helper para traduzir tipo técnico para categoria humana
  const getCategoryLabel = (type: string): { label: string; color: string } => {
    if (type?.includes('financeiro') || type?.includes('conta'))
      return { label: "💰 Financeiro", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    
    if (type?.includes('kids') || type?.includes('crianca'))
      return { label: "👶 Kids", color: "bg-orange-100 text-orange-700 border-orange-200" };
    
    if (type?.includes('oracao') || type?.includes('pedido'))
      return { label: "🙏 Intercessão", color: "bg-purple-100 text-purple-700 border-purple-200" };
    
    if (type?.includes('visitante'))
      return { label: "👋 Recepção", color: "bg-blue-100 text-blue-700 border-blue-200" };
    
    if (type?.includes('alerta') || type?.includes('critico'))
      return { label: "⚠️ Alerta", color: "bg-red-100 text-red-700 border-red-200" };

    if (type?.includes('agenda') || type?.includes('escala'))
      return { label: "📅 Agenda", color: "bg-indigo-100 text-indigo-700 border-indigo-200" };

    return { label: "🔔 Geral", color: "bg-slate-100 text-slate-700 border-slate-200" };
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 transition-all rounded-full h-10 w-10">
          <Bell className={cn("h-5 w-5 text-foreground hover:text-primary transition-colors", unreadCount > 0 && "animate-pulse-subtle")} />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white animate-in zoom-in" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 sm:w-96 p-0 shadow-xl border-slate-100 rounded-xl" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white rounded-t-xl">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notificações</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary hover:bg-primary/20">
                {unreadCount} novas
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs h-7 text-muted-foreground hover:text-primary px-2"
              title="Marcar todas como lidas"
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Limpar
            </Button>
          )}
        </div>

        <ScrollArea className="h-[350px] bg-slate-50/50">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground p-8 text-center">
              <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-900">Tudo limpo por aqui!</p>
              <p className="text-xs mt-1 text-slate-500">Você não tem novas notificações no momento.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notification) => {
                const { icon: Icon, color } = getEventStyle(notification.type);
                
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group relative flex gap-4 p-4 transition-all hover:bg-white cursor-pointer border-b border-slate-100 last:border-0",
                      !notification.read ? "bg-white" : "bg-slate-50/50 opacity-70 hover:opacity-100"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Indicador de não lido (Bolinha azul) */}
                    {!notification.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500" />
                    )}

                    {/* Ícone */}
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", color)}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Conteúdo */}
                    <div className="flex flex-1 flex-col gap-2 min-w-0">
                      {/* Categoria Badge + Título */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <Badge variant="outline" className={cn("w-fit text-[10px] font-medium px-2 py-0.5", getCategoryLabel(notification.type).color)}>
                            {getCategoryLabel(notification.type).label}
                          </Badge>
                          <p className={cn("text-sm leading-tight", !notification.read ? "font-semibold text-slate-900" : "font-medium text-slate-700")}>
                            {notification.title}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: false, locale: ptBR })}
                        </span>
                      </div>
                      
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                    </div>

                    {/* Botão de Excluir (Hover only) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
