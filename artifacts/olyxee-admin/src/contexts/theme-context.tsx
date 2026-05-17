import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface ThemeSettings {
  isDark: boolean;
  primaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  businessName: string;
  businessTagline: string;
}

interface ThemeContextValue extends ThemeSettings {
  setIsDark: (v: boolean) => void;
  setPrimaryColor: (hex: string) => void;
  setLogoUrl: (url: string) => void;
  setFaviconUrl: (url: string) => void;
  setBusinessName: (name: string) => void;
  setBusinessTagline: (tagline: string) => void;
  saveSettings: (partial: Partial<ThemeSettings>) => void;
}

const STORAGE_KEY = "olyxee_theme";

const DEFAULTS: ThemeSettings = {
  isDark: false,
  primaryColor: "#2b2b2b",
  logoUrl: "",
  faviconUrl: "",
  businessName: "",
  businessTagline: "",
};

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function applyPrimaryColor(hex: string) {
  const hsl = hexToHsl(hex);
  if (!hsl) return;
  const root = document.documentElement;
  root.style.setProperty("--brand-h", String(hsl.h));
  root.style.setProperty("--brand-s", `${hsl.s}%`);
  root.style.setProperty("--brand-l", `${hsl.l}%`);
}

function loadSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

const ThemeContext = createContext<ThemeContextValue>({
  ...DEFAULTS,
  setIsDark: () => {},
  setPrimaryColor: () => {},
  setLogoUrl: () => {},
  setFaviconUrl: () => {},
  setBusinessName: () => {},
  setBusinessTagline: () => {},
  saveSettings: () => {},
});

function applyFavicon(url: string) {
  if (typeof document === "undefined") return;
  const head = document.head;
  // Remove all existing icon links so we replace, not stack.
  const existing = head.querySelectorAll(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
  );
  existing.forEach((el) => el.parentNode?.removeChild(el));
  if (!url) {
    // Restore default favicon shipped with the app.
    const def = document.createElement("link");
    def.rel = "icon";
    def.type = "image/png";
    def.href = `${import.meta.env.BASE_URL}favicon.png`;
    head.appendChild(def);
    return;
  }
  const link = document.createElement("link");
  link.rel = "icon";
  // Let the browser sniff the type from the data URL / file.
  link.href = url;
  head.appendChild(link);
  const apple = document.createElement("link");
  apple.rel = "apple-touch-icon";
  apple.href = url;
  head.appendChild(apple);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(loadSettings);

  const persist = useCallback((next: ThemeSettings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (settings.isDark) html.classList.add("dark");
    else html.classList.remove("dark");
  }, [settings.isDark]);

  useEffect(() => {
    applyPrimaryColor(settings.primaryColor);
  }, [settings.primaryColor]);

  useEffect(() => {
    applyFavicon(settings.faviconUrl);
  }, [settings.faviconUrl]);

  const update = useCallback((partial: Partial<ThemeSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      persist(next);
      return next;
    });
  }, [persist]);

  const value: ThemeContextValue = {
    ...settings,
    setIsDark: (v) => update({ isDark: v }),
    setPrimaryColor: (hex) => update({ primaryColor: hex }),
    setLogoUrl: (url) => update({ logoUrl: url }),
    setFaviconUrl: (url) => update({ faviconUrl: url }),
    setBusinessName: (name) => update({ businessName: name }),
    setBusinessTagline: (tagline) => update({ businessTagline: tagline }),
    saveSettings: update,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
