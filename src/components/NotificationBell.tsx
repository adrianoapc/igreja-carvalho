import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "kids_diario":
        return "📔";
      case "kids_checkout":
        return "✅";
      case "novo_visitante":
        return "👋";
      case "promocao_status":
        return "🎉";
      default:
        return "🔔";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "kids_diario":
        return "bg-blue-100 text-blue-800";
      case "kids_checkout":
        return "bg-green-100 text-green-800";
      case "novo_visitante":
        return "bg-purple-100 text-purple-800";
      case "promocao_status":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center rounded-full"
              variant="destructive"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-gray-500 hover:text-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                markAllAsRead();
              }}
            >
              Marcar como lido
            </Button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="h-8 w-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Sem notificações</p>
          </div>
        ) : (
          <ScrollArea className="h-80">
            <div className="space-y-0">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors",
                    !notification.read && "bg-blue-50"
                  )}
                >
                  <div className="flex gap-3">
                    {/* Ícone */}
                    <div className="text-lg mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-tight">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="h-2 w-2 bg-blue-500 rounded-full mt-1 flex-shrink-0" />
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {notification.message}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={getNotificationColor(notification.type)}>
                          {notification.type.replace(/_/g, " ")}
                        </Badge>
                        <p className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2 mt-2">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-xs text-gray-500 hover:text-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                          >
                            Marcar como lido
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs text-gray-500 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a href="/settings/notifications" className="cursor-pointer">
            ⚙️ Configurar notificações
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
