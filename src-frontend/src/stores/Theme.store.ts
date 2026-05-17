import { create } from "zustand";

type Theme = "light" | "dark";

type Store = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initTheme: () => void;
};

export const useThemeStore = create<Store>()((set, get) => ({
  theme: (localStorage.getItem("td_theme") as Theme) || "dark",
  setTheme: (theme: Theme) => {
    localStorage.setItem("td_theme", theme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const newTheme = get().theme === "dark" ? "light" : "dark";
    get().setTheme(newTheme);
  },
  initTheme: () => {
    const theme = get().theme;
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  },
}));
