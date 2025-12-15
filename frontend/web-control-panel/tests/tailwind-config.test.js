import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Tailwind Config', () => {
    let originalTailwind;

    beforeEach(() => {
        originalTailwind = global.tailwind;
        global.tailwind = {};
    });

    afterEach(() => {
        global.tailwind = originalTailwind;
        vi.resetModules();
    });

    it('should set darkMode to class', async () => {
        await import('../public/js/tailwind-config.js');

        expect(tailwind.config.darkMode).toBe('class');
    });

    it('should extend theme with inter font family', async () => {
        vi.resetModules();
        global.tailwind = {};

        await import('../public/js/tailwind-config.js');

        expect(tailwind.config.theme.extend.fontFamily.inter).toContain('Inter');
    });

    it('should include sans-serif as fallback font', async () => {
        vi.resetModules();
        global.tailwind = {};

        await import('../public/js/tailwind-config.js');

        expect(tailwind.config.theme.extend.fontFamily.inter).toContain('sans-serif');
    });
});
