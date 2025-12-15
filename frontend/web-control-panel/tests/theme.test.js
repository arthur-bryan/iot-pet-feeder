import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Theme } from '../public/js/theme.js';

describe('Theme', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <button id="themeToggleButton"></button>
            <span id="sunIcon" class="hidden"></span>
            <span id="moonIcon"></span>
        `;
        document.documentElement.classList.remove('dark');
        localStorage.clear();
    });

    describe('initialize', () => {
        it('should set dark mode based on localStorage preference', () => {
            localStorage.setItem('theme', 'dark');
            Theme.initialize();
            expect(document.documentElement.classList.contains('dark')).toBe(true);
        });

        it('should set light mode when localStorage is light', () => {
            localStorage.setItem('theme', 'light');
            Theme.initialize();
            expect(document.documentElement.classList.contains('dark')).toBe(false);
        });

        it('should default to light mode when no localStorage value', () => {
            Theme.initialize();
            expect(document.documentElement.classList.contains('dark')).toBe(false);
        });

        it('should update icon visibility for dark mode', () => {
            localStorage.setItem('theme', 'dark');
            Theme.initialize();
            expect(document.getElementById('sunIcon').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('moonIcon').classList.contains('hidden')).toBe(true);
        });

        it('should update icon visibility for light mode', () => {
            localStorage.setItem('theme', 'light');
            Theme.initialize();
            expect(document.getElementById('sunIcon').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('moonIcon').classList.contains('hidden')).toBe(false);
        });
    });

    describe('toggle', () => {
        it('should toggle from light to dark', () => {
            localStorage.setItem('theme', 'light');
            Theme.toggle();
            expect(document.documentElement.classList.contains('dark')).toBe(true);
            expect(localStorage.getItem('theme')).toBe('dark');
        });

        it('should toggle from dark to light', () => {
            localStorage.setItem('theme', 'dark');
            Theme.toggle();
            expect(document.documentElement.classList.contains('dark')).toBe(false);
            expect(localStorage.getItem('theme')).toBe('light');
        });

        it('should call callback with new theme', () => {
            localStorage.setItem('theme', 'light');
            const callback = vi.fn();
            Theme.toggle(callback);
            expect(callback).toHaveBeenCalledWith('dark');
        });

        it('should handle undefined callback', () => {
            localStorage.setItem('theme', 'light');
            expect(() => Theme.toggle()).not.toThrow();
        });
    });

    describe('isDark', () => {
        it('should return true when localStorage theme is dark', () => {
            localStorage.setItem('theme', 'dark');
            expect(Theme.isDark()).toBe(true);
        });

        it('should return false when localStorage theme is light', () => {
            localStorage.setItem('theme', 'light');
            expect(Theme.isDark()).toBe(false);
        });

        it('should return false when no theme in localStorage', () => {
            expect(Theme.isDark()).toBe(false);
        });
    });
});
