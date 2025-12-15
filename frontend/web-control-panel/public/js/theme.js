/**
 * Shared theme management module.
 * Import this module instead of duplicating theme toggle/initialize functions.
 */

export const Theme = (function() {
    'use strict';

    const STORAGE_KEY = 'theme';
    const DARK_CLASS = 'dark';

    function getIconElements() {
        return {
            sun: document.getElementById('sunIcon'),
            moon: document.getElementById('moonIcon')
        };
    }

    function updateIcons(isDark) {
        const icons = getIconElements();
        if (!icons.sun || !icons.moon) return;

        if (isDark) {
            icons.sun.classList.remove('hidden');
            icons.moon.classList.add('hidden');
        } else {
            icons.sun.classList.add('hidden');
            icons.moon.classList.remove('hidden');
        }
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        const html = document.documentElement;

        if (isDark) {
            html.classList.add(DARK_CLASS);
        } else {
            html.classList.remove(DARK_CLASS);
        }

        updateIcons(isDark);
    }

    function getCurrentTheme() {
        return localStorage.getItem(STORAGE_KEY) || 'light';
    }

    return {
        toggle: function(onThemeChange) {
            const currentTheme = getCurrentTheme();
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            applyTheme(newTheme);
            localStorage.setItem(STORAGE_KEY, newTheme);

            if (typeof onThemeChange === 'function') {
                onThemeChange(newTheme);
            }
        },

        initialize: function() {
            applyTheme(getCurrentTheme());
        },

        isDark: function() {
            return getCurrentTheme() === 'dark';
        }
    };
})();

// Keep window global for backward compatibility with non-module scripts
if (typeof window !== 'undefined') {
    window.Theme = Theme;
}
