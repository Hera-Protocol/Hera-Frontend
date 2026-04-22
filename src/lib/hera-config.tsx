import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_API_BASE_URL = "hera.apiBaseUrl";
const STORAGE_API_KEY = "hera.apiKey";
const STORAGE_WORKSPACE_ID = "hera.workspaceId";

const DEFAULT_API_BASE_URL =
  (import.meta.env.VITE_HERA_API_BASE_URL as string | undefined) ??
  "http://127.0.0.1:3000";
const DEFAULT_API_KEY =
  (import.meta.env.VITE_HERA_API_KEY as string | undefined) ?? "";
const DEFAULT_WORKSPACE_ID =
  (import.meta.env.VITE_HERA_WORKSPACE_ID as string | undefined) ?? "";

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

interface HeraConfigContextValue {
  apiBaseUrl: string;
  apiKey: string;
  selectedWorkspaceId: string;
  isConfigured: boolean;
  updateConnection: (next: { apiBaseUrl: string; apiKey: string }) => void;
  setSelectedWorkspaceId: (workspaceId: string) => void;
  clearConnection: () => void;
}

const HeraConfigContext = createContext<HeraConfigContextValue | null>(null);

export function HeraConfigProvider({ children }: { children: ReactNode }) {
  const [apiBaseUrl, setApiBaseUrl] = useState(() => {
    if (typeof window === "undefined") {
      return normalizeBaseUrl(DEFAULT_API_BASE_URL);
    }

    return normalizeBaseUrl(
      window.localStorage.getItem(STORAGE_API_BASE_URL) ?? DEFAULT_API_BASE_URL
    );
  });
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_API_KEY;
    }

    return (window.localStorage.getItem(STORAGE_API_KEY) ?? DEFAULT_API_KEY).trim();
  });
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_WORKSPACE_ID;
    }

    return (
      window.localStorage.getItem(STORAGE_WORKSPACE_ID) ?? DEFAULT_WORKSPACE_ID
    ).trim();
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_API_BASE_URL, apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (apiKey) {
      window.localStorage.setItem(STORAGE_API_KEY, apiKey);
    } else {
      window.localStorage.removeItem(STORAGE_API_KEY);
    }
  }, [apiKey]);

  useEffect(() => {
    if (selectedWorkspaceId) {
      window.localStorage.setItem(STORAGE_WORKSPACE_ID, selectedWorkspaceId);
    } else {
      window.localStorage.removeItem(STORAGE_WORKSPACE_ID);
    }
  }, [selectedWorkspaceId]);

  const value: HeraConfigContextValue = {
    apiBaseUrl,
    apiKey,
    selectedWorkspaceId,
    isConfigured: Boolean(apiBaseUrl && apiKey),
    updateConnection: (next) => {
      setApiBaseUrl(normalizeBaseUrl(next.apiBaseUrl || DEFAULT_API_BASE_URL));
      setApiKey(next.apiKey.trim());
    },
    setSelectedWorkspaceId: (workspaceId) => {
      setSelectedWorkspaceIdState(workspaceId.trim());
    },
    clearConnection: () => {
      setApiBaseUrl(normalizeBaseUrl(DEFAULT_API_BASE_URL));
      setApiKey("");
      setSelectedWorkspaceIdState("");
    },
  };

  return (
    <HeraConfigContext.Provider value={value}>
      {children}
    </HeraConfigContext.Provider>
  );
}

export function useHeraConfig() {
  const context = useContext(HeraConfigContext);
  if (!context) {
    throw new Error("useHeraConfig must be used within HeraConfigProvider");
  }

  return context;
}
