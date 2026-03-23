import '@testing-library/jest-dom';

// Mock IndexedDB for offline storage tests
const indexedDB = {
    open: () => ({
        result: {
            objectStoreNames: { contains: () => false },
            createObjectStore: () => ({}),
            transaction: () => ({
                objectStore: () => ({
                    put: () => ({ onsuccess: null, onerror: null }),
                    get: () => ({ onsuccess: null, onerror: null }),
                    delete: () => ({ onsuccess: null, onerror: null }),
                    getAll: () => ({ onsuccess: null, onerror: null }),
                }),
            }),
        },
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
    }),
};

Object.defineProperty(window, 'indexedDB', {
    value: indexedDB,
    writable: true,
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true,
});

// Mock matchMedia (used by some UI components)
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => false,
    }),
});
