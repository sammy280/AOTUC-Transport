import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setUser: (userId: string | null) => void;
  currentUserId: string | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const GLOBAL_THEME_KEY = 'aotuc_theme_global';

function getStorageKey(userId: string | null): string {
  return userId ? `aotuc_theme_user_${userId}` : GLOBAL_THEME_KEY;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Identify active user if session already exists
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const savedUser = sessionStorage.getItem('aotuc_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        return parsed?.id || null;
      }
    } catch {
      // ignore
    }
    return null;
  });

  // 2. Load theme mode preference for this user (or global/system)
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    try {
      const key = getStorageKey(currentUserId);
      const saved = localStorage.getItem(key) as ThemeMode | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
      const globalSaved = localStorage.getItem(GLOBAL_THEME_KEY) as ThemeMode | null;
      if (globalSaved === 'light' || globalSaved === 'dark' || globalSaved === 'system') {
        return globalSaved;
      }
    } catch {
      // ignore
    }
    return 'system';
  });

  // 3. Resolve whether effectively light or dark
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (mode === 'light') return 'light';
    if (mode === 'dark') return 'dark';
    return getSystemTheme();
  });

  // Apply theme to DOM
  const applyThemeToDOM = useCallback((resolved: ResolvedTheme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, []);

  // Update resolved theme whenever mode changes
  useEffect(() => {
    let resolved: ResolvedTheme;
    if (mode === 'light') {
      resolved = 'light';
    } else if (mode === 'dark') {
      resolved = 'dark';
    } else {
      resolved = getSystemTheme();
    }
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);
  }, [mode, applyThemeToDOM]);

  // Listen to OS prefers-color-scheme changes in real-time when in system mode
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (mode === 'system') {
        const newResolved: ResolvedTheme = e.matches ? 'dark' : 'light';
        setResolvedTheme(newResolved);
        applyThemeToDOM(newResolved);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
      return () => mediaQuery.removeEventListener('change', handleMediaChange);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleMediaChange);
      return () => (mediaQuery as any).removeListener(handleMediaChange);
    }
  }, [mode, applyThemeToDOM]);

  // Update mode and persist for current user
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      const key = getStorageKey(currentUserId);
      localStorage.setItem(key, newMode);
      localStorage.setItem(GLOBAL_THEME_KEY, newMode);

      // Best-effort remote synchronization across devices if token is present
      const token = localStorage.getItem('aotuc_auth_token') || sessionStorage.getItem('aotuc_auth_token');
      if (token && currentUserId) {
        fetch('/api/v1/auth/preferences/theme', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ theme: newMode }),
        }).catch(() => {
          // offline or dev mode fallback
        });
      }
    } catch {
      // ignore storage error
    }
  }, [currentUserId]);

  // When active user changes (Login/Logout), restore that user's independent preference
  const setUser = useCallback((userId: string | null) => {
    setCurrentUserId(userId);
    try {
      const key = getStorageKey(userId);
      const userSaved = localStorage.getItem(key) as ThemeMode | null;
      if (userSaved === 'light' || userSaved === 'dark' || userSaved === 'system') {
        setModeState(userSaved);
      } else {
        // Fallback to system default for users who haven't selected a preference
        setModeState('system');
      }

      // Check remote preference if user is authenticated
      const token = localStorage.getItem('aotuc_auth_token') || sessionStorage.getItem('aotuc_auth_token');
      if (token && userId) {
        fetch('/api/v1/auth/preferences/theme', {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((res) => {
            if (res?.data?.theme && ['light', 'dark', 'system'].includes(res.data.theme)) {
              setModeState(res.data.theme);
              localStorage.setItem(key, res.data.theme);
            }
          })
          .catch(() => {
            // offline or dev mode fallback
          });
      }
    } catch {
      setModeState('system');
    }
  }, []);

  // Quick binary toggle helper (light <-> dark)
  const toggleTheme = useCallback(() => {
    setMode(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setMode]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        resolvedTheme,
        isDark: resolvedTheme === 'dark',
        setMode,
        toggleTheme,
        setUser,
        currentUserId,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
