import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "./api";
import { useI18n } from "./i18n";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
export function AppProvider({ children }) {
  const { setLanguage } = useI18n();
  const [user, setUser] = useState(null);
  const [setup, setSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const [quickAdd, setQuickAdd] = useState(null);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  const loadUser = useCallback(async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
    setLanguage(data.language);
    return data;
  }, [setLanguage]);
  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/auth/status");
      setSetup(data.setup_required);
      if (!data.setup_required) {
        try {
          await loadUser();
        } catch (e) {
          if (e.response?.status !== 401) throw e;
        }
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [loadUser]);
  useEffect(() => {
    initialize();
    const expire = () => setUser(null);
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, [initialize]);
  const canWrite = !!user && user.role !== "VIEWER";
  const canAdmin = !!user && ["OWNER", "ADMIN"].includes(user.role);
  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        setup,
        setSetup,
        loading,
        error,
        initialize,
        loadUser,
        revision,
        refresh,
        quickAdd,
        setQuickAdd,
        canWrite,
        canAdmin,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
