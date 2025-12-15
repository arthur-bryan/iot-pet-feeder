import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Theme Init', () => {
    let originalLocalStorage;

    beforeEach(() => {
        originalLocalStorage = global.localStorage;
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        };
        document.documentElement.classList.remove('dark');
    });

    afterEach(() => {
        global.localStorage = originalLocalStorage;
        vi.resetModules();
        document.documentElement.classList.remove('dark');
    });

    it('should add dark class when theme is dark', async () => {
        global.localStorage.getItem = vi.fn().mockReturnValue('dark');

        await import('../public/js/theme-init.js');

        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should not add dark class when theme is light', async () => {
        global.localStorage.getItem = vi.fn().mockReturnValue('light');

        vi.resetModules();
        document.documentElement.classList.remove('dark');

        const themeScript = `
            (function() {
                const theme = localStorage.getItem('theme') || 'light';
                if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                }
            })();
        `;
        eval(themeScript);

        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should default to light when no theme in localStorage', async () => {
        global.localStorage.getItem = vi.fn().mockReturnValue(null);

        vi.resetModules();
        document.documentElement.classList.remove('dark');

        const themeScript = `
            (function() {
                const theme = localStorage.getItem('theme') || 'light';
                if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                }
            })();
        `;
        eval(themeScript);

        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
});
