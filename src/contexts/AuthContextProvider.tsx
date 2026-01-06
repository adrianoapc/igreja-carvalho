import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

const AUTH_CACHE_KEY = "auth_context_cache_v1";
const FILIAL_OVERRIDE_KEY = "lovable_filial_override";
const RPC_TIMEOUT_MS = 3000;

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

// Helper: apply cache data to state setters
function applyCacheToState(
  cached: CachedData,
  setters: {
    setProfile: (p: ProfileData | null) => void;
    setRoles: (r: string[]) => void;
    setIsAdmin: (a: boolean) => void;
    setHasExplicitAccess: (h: boolean) => void;
    setAllowedFilialIds: (a: string[] | null) => void;
    setFiliais: (f: FilialData[]) => void;
  }
) {
  setters.setProfile(cached.profile);
  setters.setRoles(cached.roles);
  setters.setIsAdmin(cached.isAdmin);
  setters.setHasExplicitAccess(cached.hasExplicitAccess);
  setters.setAllowedFilialIds(cached.allowedFilialIds);
  setters.setFiliais(cached.filiais);
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

  // Guard against concurrent RPC calls
  const inFlightRef = useRef<Promise<void> | null>(null);

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

  const stateSetters = {
    setProfile,
    setRoles,
    setIsAdmin,
    setHasExplicitAccess,
    setAllowedFilialIds,
    setFiliais,
  };

  const fetchUserContext = useCallback(
    async (userId: string): Promise<void> => {
      // Guard: if already in-flight, reuse existing promise
      if (inFlightRef.current) {
        console.log("[AUTH] RPC already in-flight, reusing promise");
        return inFlightRef.current;
      }

      const doFetch = async (): Promise<void> => {
        console.log("[AUTH] RPC start get_user_auth_context userId=", userId);

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("RPC_TIMEOUT")), RPC_TIMEOUT_MS);
        });

        // Create RPC promise
        const rpcPromise = supabase.rpc("get_user_auth_context", {
          p_user_id: userId,
        });

        try {
          // Race between RPC and timeout
          const { data, error } = await Promise.race([
            rpcPromise,
            timeoutPromise,
          ]);

          console.log("[AUTH] RPC response received", {
            hasData: !!data,
            error: error?.message,
          });

          if (error) {
            console.error("[AUTH] RPC error:", error);
            const cached = loadCache();
            if (cached) {
              console.log("[AUTH] Using cache after RPC error");
              applyCacheToState(cached, stateSetters);
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
            console.error("[AUTH] RPC returned success=false:", result?.error);
            const cached = loadCache();
            if (cached) {
              applyCacheToState(cached, stateSetters);
            }
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

          console.log("[AUTH] Context updated successfully");
        } catch (err) {
          const isTimeout =
            err instanceof Error && err.message === "RPC_TIMEOUT";
          console.warn("[AUTH] RPC failed:", isTimeout ? "TIMEOUT" : err);

          // Use cache on timeout/error
          const cached = loadCache();
          if (cached) {
            console.log(
              "[AUTH] Using cache after",
              isTimeout ? "timeout" : "error"
            );
            applyCacheToState(cached, stateSetters);
          }
        }
      };

      // Store promise in ref, clear on completion
      inFlightRef.current = doFetch().finally(() => {
        inFlightRef.current = null;
      });

      return inFlightRef.current;
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
      console.log("[AUTH] Loaded cache on mount");
      applyCacheToState(cached, stateSetters);
    }

    const initializeAuth = async () => {
      console.log("[AUTH] initializeAuth start");
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);

          // Fetch context but don't block UI if cache exists
          if (cached) {
            // Fire and forget - UI already has cache data
            fetchUserContext(currentSession.user.id).catch(console.error);
          } else {
            // No cache - must wait for RPC
            await fetchUserContext(currentSession.user.id);
          }
        }
      } catch (err) {
        console.error("[AUTH] Error initializing auth:", err);
      } finally {
        if (isMounted) {
          console.log("[AUTH] initializeAuth complete, setLoading(false)");
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log("[AUTH] onAuthStateChange:", event);
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === "SIGNED_IN" && newSession?.user) {
        // Don't await - let it run in background to avoid blocking
        fetchUserContext(newSession.user.id).catch(console.error);
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
