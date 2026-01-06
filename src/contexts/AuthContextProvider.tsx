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

const AUTH_CACHE_KEY = "auth_context_cache_v1";
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
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Cache valid for 5 minutes
    if (Date.now() - parsed.timestamp > 5 * 60 * 1000) {
      return null;
    }
    return parsed;
  } catch {
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const { data, error } = await supabase.rpc("get_user_auth_context", {
          p_user_id: userId,
        });

        clearTimeout(timeoutId);

        if (error) {
          console.error("Error fetching auth context:", error);
          // Try to use cache on error
          const cached = loadCache();
          if (cached) {
            setProfile(cached.profile);
            setRoles(cached.roles);
            setIsAdmin(cached.isAdmin);
            setHasExplicitAccess(cached.hasExplicitAccess);
            setAllowedFilialIds(cached.allowedFilialIds);
            setFiliais(cached.filiais);
          }
          return;
        }

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
          console.error("Auth context fetch failed:", result?.error);
          setLoading(false); // GARANTIR que loading seja false mesmo em erro
          return;
        }

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
        console.warn("Auth context fetch timeout or error:", err);

        // Try to use cache on timeout
        const cached = loadCache();
        if (cached) {
          setProfile(cached.profile);
          setRoles(cached.roles);
          setIsAdmin(cached.isAdmin);
          setHasExplicitAccess(cached.hasExplicitAccess);
          setAllowedFilialIds(cached.allowedFilialIds);
          setFiliais(cached.filiais);
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

    // Load cache immediately for faster initial render
    const cached = loadCache();
    if (cached) {
      setProfile(cached.profile);
      setRoles(cached.roles);
      setIsAdmin(cached.isAdmin);
      setHasExplicitAccess(cached.hasExplicitAccess);
      setAllowedFilialIds(cached.allowedFilialIds);
      setFiliais(cached.filiais);
    }

    const initializeAuth = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          await fetchUserContext(currentSession.user.id);
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === "SIGNED_IN" && newSession?.user) {
        await fetchUserContext(newSession.user.id);
      } else if (event === "SIGNED_OUT") {
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
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
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
