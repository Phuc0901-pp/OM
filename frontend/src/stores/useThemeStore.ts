import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type Theme = 'light' | 'dark';

interface ThemeState {
    /** Current active theme */
    theme: Theme;
    /** Whether user has explicitly chosen a theme (vs auto-detect) */
    userChosen: boolean;
    /** Toggle between light and dark */
    toggleTheme: () => void;
    /** Explicitly set a theme */
    setTheme: (theme: Theme) => void;
    /** Reset to system preference */
    resetToSystem: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get OS/browser preferred theme
// ─────────────────────────────────────────────────────────────────────────────
const getSystemTheme = (): Theme =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

// ─────────────────────────────────────────────────────────────────────────────
// Apply theme class to <html> element
// ─────────────────────────────────────────────────────────────────────────────
const applyTheme = (theme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
};

// ─────────────────────────────────────────────────────────────────────────────
// Store definition
// ─────────────────────────────────────────────────────────────────────────────
export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            // Default: auto-detect from OS
            theme: getSystemTheme(),
            userChosen: false,

            toggleTheme: () => {
                const next: Theme = get().theme === 'light' ? 'dark' : 'light';
                applyTheme(next);
                set({ theme: next, userChosen: true });
            },

            setTheme: (theme: Theme) => {
                applyTheme(theme);
                set({ theme, userChosen: true });
            },

            resetToSystem: () => {
                const system = getSystemTheme();
                applyTheme(system);
                set({ theme: system, userChosen: false });
            },
        }),
        {
            name: 'theme-storage', // Key in localStorage
            // Only persist theme + userChosen, not action functions
            partialize: (state) => ({
                theme: state.theme,
                userChosen: state.userChosen,
            }),
            // On rehydrate: if user has not explicitly chosen, re-detect from OS
            onRehydrateStorage: () => (state) => {
                if (state) {
                    if (!state.userChosen) {
                        const system = getSystemTheme();
                        state.theme = system;
                    }
                    applyTheme(state.theme);
                }
            },
        }
    )
);

// ─────────────────────────────────────────────────────────────────────────────
// Listen to OS theme changes and auto-update if user hasn't manually chosen
// ─────────────────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
        const { userChosen, setTheme } = useThemeStore.getState();
        if (!userChosen) {
            // Only auto-follow OS if user hasn't manually picked
            const newTheme: Theme = e.matches ? 'dark' : 'light';
            applyTheme(newTheme);
            // Update store without marking as user-chosen
            useThemeStore.setState({ theme: newTheme });
        }
    });
}
