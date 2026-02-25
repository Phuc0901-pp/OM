/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Aurora Theme - Premium Light Mode
                // Backgrounds (Glass & Depth)
                background: {
                    DEFAULT: '#f8fafc', // Slate-50 (Global bg)
                    glass: 'rgba(255, 255, 255, 0.7)', // Glass panel
                    subtle: '#f1f5f9',  // Slate-100
                    pure: '#ffffff',
                },
                // Primary Brand (Indigo/Violet - Trust & Modernity)
                primary: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1', // Indigo-500 (Main Brand)
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                },
                // Secondary (Cyan/Sky - Clarity)
                secondary: {
                    500: '#06b6d4', // Cyan-500
                    600: '#0891b2',
                },
                // Semantic Colors
                success: { 500: '#10b981', 600: '#059669' }, // Emerald
                warning: { 500: '#f59e0b', 600: '#d97706' }, // Amber
                danger: { 500: '#ef4444', 600: '#dc2626' },  // Red

                // Text Colors
                text: {
                    main: '#1e293b',      // Slate-800
                    secondary: '#475569', // Slate-600
                    muted: '#94a3b8',     // Slate-400
                }
            },
            fontFamily: {
                sans: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
                display: ['Outfit', 'Inter', 'sans-serif'], // For Headings
            },
            boxShadow: {
                'glass': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                'glass-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
                'glass-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
                'neon': '0 0 5px theme("colors.primary.400"), 0 0 20px theme("colors.primary.500")',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.5s ease-out',
                'float': 'float 6s ease-in-out infinite',
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                }
            },
            backgroundImage: {
                'mesh-light': 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.1) 0, transparent 50%), radial-gradient(at 100% 0%, rgba(245, 158, 11, 0.1) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.1) 0, transparent 50%)',
                'mesh-dark': 'radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%)',
                'aurora-gradient': 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
            }
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
