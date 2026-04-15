/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const port = env.PORT ? parseInt(env.PORT) : 8080;
    const target = env.API_TARGET || 'http://localhost:4000';

    return {
        plugins: [
            react(),
            basicSsl(),
            VitePWA({
                strategies: 'generateSW',
                registerType: 'autoUpdate',
                includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
                manifest: {
                    name: 'Solar O&M Management',
                    short_name: 'SolarOM',
                    description: 'Solar Operations & Management System',
                    theme_color: '#ffffff',
                    icons: [
                        {
                            src: 'pwa-192x192.png',
                            sizes: '192x192',
                            type: 'image/png'
                        },
                        {
                            src: 'pwa-512x512.png',
                            sizes: '512x512',
                            type: 'image/png'
                        }
                    ]
                },
                devOptions: {
                    enabled: true,
                    type: 'module',
                    navigateFallback: 'index.html',
                }
            })
        ],
        server: {
            port: port,
            host: true,
            allowedHosts: true, // Allow all hosts for tunnel
            proxy: {
                '/api': {
                    target: target,
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                }
            }
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        'vendor-react': ['react', 'react-dom', 'react-router-dom', 'zustand'],
                        'vendor-framer': ['framer-motion'],
                        'vendor-tiptap': [
                            '@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-color',
                            '@tiptap/extension-table', '@tiptap/extension-image', '@tiptap/extension-text-align'
                        ],
                        'vendor-ui': ['lucide-react', '@headlessui/react', 'recharts']
                    }
                }
            }
        },
        test: {
            globals: true,
            environment: 'jsdom',
            setupFiles: './src/setupTests.ts',
            css: true,
        }
    };
});
