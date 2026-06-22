import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  pushEnabled: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  requestPushPermission: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
};

const normalizeNotification = (n: unknown): Notification => {
  if (typeof n !== "object" || n === null) throw new Error("Invalid notification");
  const notif = n as Record<string, unknown>;
  return { ...(notif as unknown as Notification), metadata: toRecord(notif?.metadata) };
};

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const processedRef = useRef<Set<string>>(new Set());

  const getDeepLink = (notification: Notification): string => {
    const { type, metadata } = notification;
    switch (type) {
      case "kids_diario":
        return metadata?.crianca_id ? `/kids/diario/${metadata.crianca_id}?date=${metadata.data}` : "/kids/dashboard";
      case "kids_checkout":
        return metadata?.crianca_id ? `/kids/checkin/${metadata.crianca_id}` : "/kids/dashboard";
      case "novo_visitante":
        return metadata?.visitante_id ? `/visitantes/${metadata.visitante_id}` : "/visitantes";
      case "promocao_status":
        return metadata?.pessoa_id ? `/pessoas/${metadata.pessoa_id}` : "/membros";
      case "financeiro_reembolso_aprovacao":
        return metadata?.solicitacao_id ? `/financas/reembolsos?id=${metadata.solicitacao_id}` : "/financas/reembolsos";
      default:
        return "/dashboard";
    }
  };

  const showPushNotification = useCallback(
    (notification: Notification) => {
      if (processedRef.current.has(notification.id)) return;
      processedRef.current.add(notification.id);

      if (pushEnabled && "Notification" in window && Notification.permission === "granted") {
        try {
          const push = new Notification(notification.title, {
            body: notification.message,
            icon: "/icon-192x192.png",
            badge: "/badge-72x72.png",
            tag: `notif-${notification.type}`,
            silent: false,
            data: { notificationId: notification.id, url: getDeepLink(notification) },
          });
          push.onclick = () => { const link = getDeepLink(notification); if (link) window.location.href = link; window.focus(); push.close(); };
          push.onshow = () => { if (!notification.metadata?.requireInteraction) setTimeout(() => push.close(), 5000); };
        } catch (err) {
          console.error("Error showing push notification:", err);
        }
      } else {
        toast({ title: notification.title, description: notification.message, duration: 5000 });
      }
    },
    [pushEnabled, toast]
  );

  const requestPushPermission = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") { setPushEnabled(true); return; }
    if (Notification.permission !== "denied") {
      try {
        const permission = await Notification.requestPermission();
        setPushEnabled(permission === "granted");
      } catch { setPushEnabled(false); }
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const load = async () => {
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
      } catch (err) {
        console.error("Error loading notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
    requestPushPermission();
  }, [user]);

  // ONE subscription per user — channelRef guards against duplicates
  useEffect(() => {
    if (!user || channelRef.current) return;

    channelRef.current = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload: { new: Notification }) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev]);
          setUnreadCount((prev) => prev + 1);
          showPushNotification(n);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload: { new: Notification; old?: { read?: boolean } }) => {
          const updated = payload.new as Notification;
          const wasUnread = payload.old?.read === false;
          setNotifications((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
          if (!updated.read && wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
          if (updated.read && wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, showPushNotification]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) { console.error("Error marking as read:", err); }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) { console.error("Error marking all as read:", err); }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase.from("notifications").delete().eq("id", notificationId);
      if (error) throw error;
      const wasUnread = notifications.find((n) => n.id === notificationId)?.read === false;
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) { console.error("Error deleting notification:", err); }
  };

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, loading, pushEnabled, markAsRead, markAllAsRead, deleteNotification, requestPushPermission }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotificationsContext must be used inside NotificationsProvider");
  return ctx;
}
