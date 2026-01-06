import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

const AUTH_CACHE_KEY = "auth_context_cache_v2"; // v2: mudança full_name -> nome
const FILIAL_OVERRIDE_KEY = "lovable_filial_override";
const TIMEOUT_MS = 3000;

interface FilialData {
  id: string;
  nome: string;
}

interface ProfileData {
  id: string;
  igreja_id: string | null;
  filial_id: string | null;
  nome: string | null;
  igreja_nome: string | null;
  filial_nome: string | null;
}

export interface AuthContextData {
  // Auth state
  user: User | null;
  session: Session | null;

  // Profile data
  profile: ProfileData | null;

  // Roles and permissions
  roles: string[];
  isAdmin: boolean;

  // Filial context
  filialId: string | null;
  filialNome: string | null;
  igrejaId: string | null;
  igrejaNome: string | null;
  isAllFiliais: boolean;

  // Filial access restrictions
  hasExplicitAccess: boolean;
  allowedFilialIds: string[] | null; // null = no restriction
  filiais: FilialData[];

  // Loading state
  loading: boolean;

  // Actions
  refreshContext: () => Promise<void>;
  setFilialOverride: (filialId: string | null, isAll: boolean) => void;
}

const defaultContext: AuthContextData = {
  user: null,
  session: null,
  profile: null,
  roles: [],
  isAdmin: false,
  filialId: null,
  filialNome: null,
  igrejaId: null,
  igrejaNome: null,
  isAllFiliais: false,
  hasExplicitAccess: false,
  allowedFilialIds: null,
  filiais: [],
  loading: true,
  refreshContext: async () => {},
  setFilialOverride: () => {},
};

const AuthContext = createContext<AuthContextData>(defaultContext);

export const useAuthContext = () => useContext(AuthContext);

interface CachedData {
  profile: ProfileData | null;
  roles: string[];
  isAdmin: boolean;
  hasExplicitAccess: boolean;
  allowedFilialIds: string[] | null;
  filiais: FilialData[];
  timestamp: number;
}

interface FilialOverride {
  filialId: string | null;
  isAllFiliais: boolean;
}

function loadCache(): CachedData | null {
  try {
    console.log("[DEBUG] loadCache: Attempting to load from localStorage...");
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) {
      console.log("[DEBUG] loadCache: No cache found in localStorage");
      return null;
    }

    console.log("[DEBUG] loadCache: Raw cache found, parsing...");
    const parsed = JSON.parse(raw);

    // Validar estrutura do cache
    if (!parsed || typeof parsed !== "object") {
      console.warn("[DEBUG] loadCache: Cache inválido - estrutura incorreta");
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }

    // Validar que profile tem 'nome' (não 'full_name')
    if (parsed.profile && "full_name" in parsed.profile) {
      console.warn(
        "[DEBUG] loadCache: Cache obsoleto detectado (full_name encontrado), limpando..."
      );
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }

    // Cache válido por 5 minutos
    if (Date.now() - parsed.timestamp > 5 * 60 * 1000) {
      console.log("[DEBUG] loadCache: Cache expirado (> 5 minutos)");
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }

    console.log(
      "[DEBUG] loadCache: Valid cache loaded, expires in:",
      (5 * 60 * 1000 - (Date.now() - parsed.timestamp)) / 1000,
      "seconds"
    );

    return parsed;
  } catch (error) {
    console.error("Erro ao carregar cache:", error);
    localStorage.removeItem(AUTH_CACHE_KEY);
    return null;
  }
}

function saveCache(data: Omit<CachedData, "timestamp">) {
  try {
    localStorage.setItem(
      AUTH_CACHE_KEY,
      JSON.stringify({ ...data, timestamp: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

function loadFilialOverride(): FilialOverride | null {
  try {
    const raw = localStorage.getItem(FILIAL_OVERRIDE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveFilialOverride(override: FilialOverride) {
  try {
    localStorage.setItem(FILIAL_OVERRIDE_KEY, JSON.stringify(override));
  } catch {
    /* ignore */
  }
}

export function AuthContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasExplicitAccess, setHasExplicitAccess] = useState(false);
  const [allowedFilialIds, setAllowedFilialIds] = useState<string[] | null>(
    null
  );
  const [filiais, setFiliais] = useState<FilialData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filial override state
  const [filialOverride, setFilialOverrideState] =
    useState<FilialOverride | null>(loadFilialOverride());

  // Computed filial context based on override or profile
  const computeFilialContext = useCallback(() => {
    if (!profile) {
      return {
        filialId: null,
        filialNome: null,
        igrejaId: null,
        igrejaNome: null,
        isAllFiliais: false,
      };
    }

    const override = filialOverride;

    // Check if user can use "all filiais"
    const canUseAllFiliais =
      isAdmin || (allowedFilialIds === null && !hasExplicitAccess);

    if (override?.isAllFiliais && canUseAllFiliais) {
      return {
        filialId: null,
        filialNome: null,
        igrejaId: profile.igreja_id,
        igrejaNome: profile.igreja_nome,
        isAllFiliais: true,
      };
    }

    if (override?.filialId) {
      // Validate override filialId is allowed
      const isAllowed =
        allowedFilialIds === null ||
        allowedFilialIds.includes(override.filialId);

      if (isAllowed) {
        const filial = filiais.find((f) => f.id === override.filialId);
        return {
          filialId: override.filialId,
          filialNome: filial?.nome ?? null,
          igrejaId: profile.igreja_id,
          igrejaNome: profile.igreja_nome,
          isAllFiliais: false,
        };
      }
    }

    // Default to profile filial
    return {
      filialId: profile.filial_id,
      filialNome: profile.filial_nome,
      igrejaId: profile.igreja_id,
      igrejaNome: profile.igreja_nome,
      isAllFiliais: false,
    };
  }, [
    profile,
    filialOverride,
    isAdmin,
    allowedFilialIds,
    hasExplicitAccess,
    filiais,
  ]);

  const filialContext = computeFilialContext();

  const fetchUserContext = useCallback(
    async (userId: string): Promise<void> => {
      console.log("[DEBUG] fetchUserContext START - userId:", userId);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        console.log("[DEBUG] Calling RPC get_user_auth_context...");
        const { data, error } = await supabase.rpc("get_user_auth_context", {
          p_user_id: userId,
        });

        clearTimeout(timeoutId);

        console.log("[DEBUG] RPC response received");
        console.log("[DEBUG] RPC data:", data);
        console.log("[DEBUG] RPC error:", error);

        if (error) {
          console.error(
            "[ERROR] RPC error details:",
            JSON.stringify(error, null, 2)
          );
          console.log("[DEBUG] Tentando usar cache...");
          // Try to use cache on error
          const cached = loadCache();
          if (cached) {
            console.log("[DEBUG] Cache encontrado, usando dados:", cached);
            setProfile(cached.profile);
            setRoles(cached.roles);
            setIsAdmin(cached.isAdmin);
            setHasExplicitAccess(cached.hasExplicitAccess);
            setAllowedFilialIds(cached.allowedFilialIds);
            setFiliais(cached.filiais);
          } else {
            console.warn("[DEBUG] Cache não disponível");
          }
          return;
        }

        console.log("[DEBUG] RPC success, data:", data);

        const result = data as unknown as {
          success: boolean;
          error?: string;
          profile?: {
            id: string;
            igreja_id: string | null;
            filial_id: string | null;
            nome: string | null;
            igreja_nome: string | null;
            filial_nome: string | null;
          };
          roles?: string[];
          is_admin?: boolean;
          has_explicit_access?: boolean;
          allowed_filial_ids?: string[] | null;
          filiais?: Array<{ id: string; nome: string }>;
        };

        if (!result?.success) {
          console.error("[ERROR] Auth context not successful:", result?.error);
          setLoading(false);
          return;
        }

        console.log("[DEBUG] RPC result successful");
        console.log("[DEBUG] Profile:", result.profile);
        console.log("[DEBUG] Roles:", result.roles);
        console.log("[DEBUG] Is Admin:", result.is_admin);

        const newProfile = result.profile
          ? {
              id: result.profile.id,
              igreja_id: result.profile.igreja_id,
              filial_id: result.profile.filial_id,
              nome: result.profile.nome,
              igreja_nome: result.profile.igreja_nome,
              filial_nome: result.profile.filial_nome,
            }
          : null;

        const newRoles = result.roles ?? [];
        const newIsAdmin = result.is_admin ?? false;
        const newHasExplicitAccess = result.has_explicit_access ?? false;
        const newAllowedFilialIds = result.allowed_filial_ids ?? null;
        const newFiliais = result.filiais ?? [];

        console.log("[DEBUG] Setting state with:", {
          profile: newProfile,
          roles: newRoles,
          isAdmin: newIsAdmin,
        });

        setProfile(newProfile);
        setRoles(newRoles);
        setIsAdmin(newIsAdmin);
        setHasExplicitAccess(newHasExplicitAccess);
        setAllowedFilialIds(newAllowedFilialIds);
        setFiliais(newFiliais);

        // Save to cache
        saveCache({
          profile: newProfile,
          roles: newRoles,
          isAdmin: newIsAdmin,
          hasExplicitAccess: newHasExplicitAccess,
          allowedFilialIds: newAllowedFilialIds,
          filiais: newFiliais,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        console.error("[ERROR] Catch block - Auth context fetch error:", err);
        console.warn("Auth context fetch timeout or error:", err);

        // Try to use cache on timeout
        const cached = loadCache();
        if (cached) {
          console.log("[DEBUG] Cache disponível no catch, usando...");
          setProfile(cached.profile);
          setRoles(cached.roles);
          setIsAdmin(cached.isAdmin);
          setHasExplicitAccess(cached.hasExplicitAccess);
          setAllowedFilialIds(cached.allowedFilialIds);
          setFiliais(cached.filiais);
        } else {
          console.warn("[DEBUG] Nenhum cache disponível");
        }
      } finally {
        // SEMPRE desligar loading após buscar contexto
        setLoading(false);
      }
    },
    []
  );

  const refreshContext = useCallback(async () => {
    if (user) {
      await fetchUserContext(user.id);
    }
  }, [user, fetchUserContext]);

  const setFilialOverride = useCallback(
    (filialId: string | null, isAll: boolean) => {
      const override: FilialOverride = {
        filialId: isAll ? null : filialId,
        isAllFiliais: isAll,
      };
      setFilialOverrideState(override);
      saveFilialOverride(override);
    },
    []
  );

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;

    console.log("[DEBUG] AuthContextProvider INITIALIZING");

    // Timeout de segurança: se após 10s ainda estiver loading, forçar false
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("⚠️ Auth loading timeout - forçando loading=false");
        setLoading(false);
      }
    }, 10000);

    // Load cache immediately for faster initial render
    const cached = loadCache();
    if (cached) {
      console.log("[DEBUG] Cache loaded:", cached);
      setProfile(cached.profile);
      setRoles(cached.roles);
      setIsAdmin(cached.isAdmin);
      setHasExplicitAccess(cached.hasExplicitAccess);
      setAllowedFilialIds(cached.allowedFilialIds);
      setFiliais(cached.filiais);
    } else {
      console.log("[DEBUG] No cache available");
    }

    const initializeAuth = async () => {
      console.log("[DEBUG] initializeAuth START");
      try {
        console.log("[DEBUG] Calling supabase.auth.getSession()...");
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        console.log("[DEBUG] getSession response:", currentSession?.user?.id);

        if (!isMounted) {
          console.log("[DEBUG] Component unmounted, skipping auth init");
          return;
        }

        if (currentSession?.user) {
          console.log("[DEBUG] Session found, user:", currentSession.user.id);
          setSession(currentSession);
          setUser(currentSession.user);
          console.log("[DEBUG] Session set, fetching user context...");
          await fetchUserContext(currentSession.user.id);
          console.log("[DEBUG] fetchUserContext completed");
        } else {
          console.log("[DEBUG] No session found, setting loading=false");
          setLoading(false);
        }
      } catch (err) {
        console.error("[DEBUG] Error initializing auth:", err);
        setLoading(false);
      } finally {
        if (isMounted) {
          console.log(
            "[DEBUG] initializeAuth finally block, setting loading=false"
          );
          setLoading(false);
        }
      }
    };

    console.log("[DEBUG] Calling initializeAuth...");
    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(
        "[DEBUG] onAuthStateChange event:",
        event,
        "user:",
        newSession?.user?.id
      );

      if (!isMounted) {
        console.log("[DEBUG] Component unmounted, ignoring auth change");
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);
      console.log("[DEBUG] Session/User set from auth event");

      if (event === "SIGNED_IN" && newSession?.user) {
        console.log(
          "[DEBUG] SIGNED_IN event, fetching context for:",
          newSession.user.id
        );
        try {
          await fetchUserContext(newSession.user.id);
          console.log("[DEBUG] fetchUserContext completed");
        } catch (err) {
          console.error("[DEBUG] Error fetching context on sign in:", err);
          setLoading(false);
        }
      } else if (event === "SIGNED_OUT") {
        console.log("[DEBUG] SIGNED_OUT event, clearing state");
        // Clear all state
        setProfile(null);
        setRoles([]);
        setIsAdmin(false);
        setHasExplicitAccess(false);
        setAllowedFilialIds(null);
        setFiliais([]);
        setFilialOverrideState(null);
        localStorage.removeItem(AUTH_CACHE_KEY);
        localStorage.removeItem(FILIAL_OVERRIDE_KEY);
        setLoading(false);
        console.log("[DEBUG] SIGNED_OUT complete");
      } else {
        console.log(
          "[DEBUG] Other auth event:",
          event,
          "- keeping existing state"
        );
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [fetchUserContext]);

  const value: AuthContextData = {
    user,
    session,
    profile,
    roles,
    isAdmin,
    filialId: filialContext.filialId,
    filialNome: filialContext.filialNome,
    igrejaId: filialContext.igrejaId,
    igrejaNome: filialContext.igrejaNome,
    isAllFiliais: filialContext.isAllFiliais,
    hasExplicitAccess,
    allowedFilialIds,
    filiais,
    loading,
    refreshContext,
    setFilialOverride,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
