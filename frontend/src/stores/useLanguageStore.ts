import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { translations, Language, TranslationKey } from '../utils/translations';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Auto-detect OS/browser language
// Returns 'vi' if system language starts with 'vi', else 'en'
// ─────────────────────────────────────────────────────────────────────────────
const getSystemLanguage = (): Language => {
 const browserLang = navigator.language || navigator.languages?.[0] || 'vi';
 return browserLang.startsWith('vi') ? 'vi' : 'en';
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface LanguageState {
 /** Current active language */
 language: Language;
 /** Whether user has explicitly chosen a language (vs auto-detect) */
 userChosen: boolean;
 /** Set a specific language */
 setLanguage: (lang: Language) => void;
 /** Reset to OS/browser detected language */
 resetToSystem: () => void;
 /** Translation helper function */
 t: (key: TranslationKey) => string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store definition
// ─────────────────────────────────────────────────────────────────────────────
export const useLanguageStore = create<LanguageState>()(
 persist(
 (set, get) => ({
 // Default: auto-detect from browser
 language: getSystemLanguage(),
 userChosen: false,

 setLanguage: (lang: Language) => {
 set({ language: lang, userChosen: true });
 },

 resetToSystem: () => {
 set({ language: getSystemLanguage(), userChosen: false });
 },

 t: (key: TranslationKey): string => {
 const { language } = get();
 return translations[language][key] || key;
 },
 }),
 {
 name: 'language-storage', // Key in localStorage
 // Only persist language + userChosen
 partialize: (state) => ({
 language: state.language,
 userChosen: state.userChosen,
 }),
 // On rehydrate: if user has not explicitly chosen, re-detect from browser
 onRehydrateStorage: () => (state) => {
 if (state && !state.userChosen) {
 state.language = getSystemLanguage();
 }
 },
 }
 )
);
