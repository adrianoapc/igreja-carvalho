import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
  related_user_id?: string;
}

interface PushNotificationOptions {
  enabled?: boolean;
  sound?: boolean;
  badge?: boolean;
}

export function useNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notificationProcessedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    loadNotifications();
    subscribeToNotifications();
    requestPushPermission();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user]);

  const toRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return undefined;
  };

  const normalizeNotification = (n: unknown): Notification => {
    if (typeof n !== "object" || n === null) {
      throw new Error("Invalid notification");
    }
    const notif = n as Record<string, unknown>;
    return {
      ...(notif as unknown as Notification),
      metadata: toRecord(notif?.metadata),
    };
  };

  const loadNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const normalized = (data || []).map(normalizeNotification);
      setNotifications(normalized);
      setUnreadCount(normalized.filter((n) => !n.read).length);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const showPushNotification = useCallback(
    (notification: Notification) => {
      // Evitar duplicatas processando apenas uma vez
      if (notificationProcessedRef.current.has(notification.id)) {
        return;
      }
      notificationProcessedRef.current.add(notification.id);

      // Se push notifications estão habilitadas e no navegador
      if (
        pushEnabled &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          // Determinar ícone baseado no tipo de notificação
          const icon = "/icon-192x192.png";
          const badge = "/badge-72x72.png";

          const notificationOptions: NotificationOptions = {
            body: notification.message,
            icon,
            badge,
            tag: `kids-${notification.type}`,
            requireInteraction: false,
            data: {
              notificationId: notification.id,
              url: getDeepLink(notification),
            },
          };

          // Adicionar som se habilitado
          if (pushEnabled) {
            notificationOptions.silent = false;
          }

          const push = new Notification(
            notification.title,
            notificationOptions
          );

          // Clicar na notificação abre o app ou navega para página relevante
          push.onclick = () => {
            const deepLink = getDeepLink(notification);
            if (deepLink) {
              window.location.href = deepLink;
            }
            window.focus();
            push.close();
          };

          push.onshow = () => {
            // Auto-fechar após 5 segundos se não for interativa
            if (!notification.metadata?.requireInteraction) {
              setTimeout(() => push.close(), 5000);
            }
          };
        } catch (error) {
          console.error("Error showing push notification:", error);
        }
      } else {
        // Fallback: mostrar toast se push não disponível
        toast({
          title: notification.title,
          description: notification.message,
          duration: 5000,
        });
      }
    },
    [pushEnabled, toast]
  );

  const requestPushPermission = async () => {
    if (!("Notification" in window)) {
      console.warn("Browser não suporta Notifications API");
      return;
    }

    if (Notification.permission === "granted") {
      setPushEnabled(true);
      return;
    }

    if (Notification.permission !== "denied") {
      try {
        const permission = await Notification.requestPermission();
        setPushEnabled(permission === "granted");
      } catch (error) {
        console.error("Error requesting notification permission:", error);
        setPushEnabled(false);
      }
    }
  };

  const getDeepLink = (notification: Notification): string => {
    const { type, metadata } = notification;

    switch (type) {
      case "kids_diario":
        // Navegar para o diário da criança
        return metadata?.crianca_id
          ? `/kids/diario/${metadata.crianca_id}?date=${metadata.data}`
          : "/kids/dashboard";

      case "kids_checkout":
        // Navegar para o check-in/checkout
        return metadata?.crianca_id
          ? `/kids/checkin/${metadata.crianca_id}`
          : "/kids/dashboard";

      case "novo_visitante":
        // Navegar para visitantes
        return metadata?.visitante_id
          ? `/visitantes/${metadata.visitante_id}`
          : "/visitantes";

      case "promocao_status":
        // Navegar para membros
        return metadata?.pessoa_id
          ? `/pessoas/${metadata.pessoa_id}`
          : "/membros";

      case "financeiro_reembolso_aprovacao":
        // Navegar para reembolso específico
        return metadata?.solicitacao_id
          ? `/financas/reembolsos?id=${metadata.solicitacao_id}`
          : "/financas/reembolsos";

      default:
        return "/dashboard";
    }
  };

  const subscribeToNotifications = () => {
    if (!user) return;

    channelRef.current = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { new: Notification }) => {
          const newNotification = payload.new as Notification;

          // Adicionar à lista
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // Mostrar push notification
          showPushNotification(newNotification);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { new: Notification; old?: { read?: boolean } }) => {
          const updatedNotification = payload.new as Notification;

          setNotifications((prev) =>
            prev.map((n) =>
              n.id === updatedNotification.id ? updatedNotification : n
            )
          );

          // Atualizar contagem de não lidos
          const wasUnread =
            payload.old?.read === false && updatedNotification.read === true;
          if (wasUnread) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Notificações em tempo real ativadas");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Erro ao conectar ao canal de notificações");
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      const wasUnread =
        notifications.find((n) => n.id === notificationId)?.read === false;
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    pushEnabled,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestPushPermission,
  };
}
