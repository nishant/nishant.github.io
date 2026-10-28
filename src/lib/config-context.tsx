import { toast } from '@nish/ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadConfig, saveConfig, type Config } from './storage';

interface ConfigContextValue {
  config: Config;
  setConfig: (c: Config) => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadConfig);
  const [config, setConfigState] = useState<Config>(initial.config);
  const warned = useRef(false);

  useEffect(() => {
    if (initial.warning && !warned.current) {
      warned.current = true;
      toast.warn(initial.warning);
    }
  }, [initial.warning]);

  const setConfig = useCallback((c: Config) => {
    setConfigState(c);
    try {
      saveConfig(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save: storage is full or blocked');
    }
  }, []);

  const value = useMemo(() => ({ config, setConfig }), [config, setConfig]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used inside <ConfigProvider>');
  return ctx;
}
