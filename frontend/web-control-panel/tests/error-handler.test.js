import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler } from '../public/js/error-handler.js';

describe('ErrorHandler', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        ErrorHandler.errorContainer = null;
        ErrorHandler.errorCount = 0;
        ErrorHandler.maxErrors = 3;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('init', () => {
        it('should set up window.onerror handler', () => {
            ErrorHandler.init();
            expect(window.onerror).toBeDefined();
        });

        it('should set up window.onunhandledrejection handler', () => {
            ErrorHandler.init();
            expect(window.onunhandledrejection).toBeDefined();
        });

        it('should handle errors via window.onerror', () => {
            ErrorHandler.init();
            const handleErrorSpy = vi.spyOn(ErrorHandler, 'handleError');

            const error = new Error('Test error');
            window.onerror('message', 'source', 1, 1, error);

            expect(handleErrorSpy).toHaveBeenCalledWith(error);
        });

        it('should handle message when no error object provided to onerror', () => {
            ErrorHandler.init();
            const handleErrorSpy = vi.spyOn(ErrorHandler, 'handleError');

            window.onerror('Test message', 'source', 1, 1, null);

            expect(handleErrorSpy).toHaveBeenCalled();
        });

        it('should handle unhandled promise rejections', () => {
            ErrorHandler.init();
            const handleErrorSpy = vi.spyOn(ErrorHandler, 'handleError');

            const event = {
                reason: new Error('Promise rejected'),
                preventDefault: vi.fn()
            };

            window.onunhandledrejection(event);

            expect(handleErrorSpy).toHaveBeenCalledWith(event.reason);
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should return true from window.onerror to suppress default handling', () => {
            ErrorHandler.init();
            const result = window.onerror('message', 'source', 1, 1, new Error('Test'));
            expect(result).toBe(true);
        });
    });

    describe('handleError', () => {
        it('should increment error count', () => {
            expect(ErrorHandler.errorCount).toBe(0);
            ErrorHandler.handleError(new Error('Test error'));
            expect(ErrorHandler.errorCount).toBe(1);
        });

        it('should show error banner for new errors', () => {
            ErrorHandler.handleError(new Error('Test error'));
            expect(ErrorHandler.errorContainer).not.toBeNull();
        });

        it('should use error message if provided', () => {
            ErrorHandler.handleError(new Error('Custom error message'));
            expect(ErrorHandler.errorContainer.textContent).toContain('Custom error message');
        });

        it('should use default message if no error message', () => {
            ErrorHandler.handleError({});
            expect(ErrorHandler.errorContainer.textContent).toContain('An unexpected error occurred');
        });

        it('should stop showing banners after maxErrors', () => {
            for (let i = 0; i < 5; i++) {
                ErrorHandler.handleError(new Error(`Error ${i}`));
            }
            expect(ErrorHandler.errorContainer.children.length).toBe(3);
        });

        it('should handle null error', () => {
            ErrorHandler.handleError(null);
            expect(ErrorHandler.errorContainer.textContent).toContain('An unexpected error occurred');
        });

        it('should handle undefined error', () => {
            ErrorHandler.handleError(undefined);
            expect(ErrorHandler.errorContainer.textContent).toContain('An unexpected error occurred');
        });
    });

    describe('showErrorBanner', () => {
        it('should create error container if not exists', () => {
            expect(ErrorHandler.errorContainer).toBeNull();
            ErrorHandler.showErrorBanner('Test');
            expect(ErrorHandler.errorContainer).not.toBeNull();
        });

        it('should reuse existing container', () => {
            ErrorHandler.showErrorBanner('Error 1');
            const container = ErrorHandler.errorContainer;
            ErrorHandler.showErrorBanner('Error 2');
            expect(ErrorHandler.errorContainer).toBe(container);
        });

        it('should add banner with role alert', () => {
            ErrorHandler.showErrorBanner('Test error');
            const banner = ErrorHandler.errorContainer.querySelector('[role="alert"]');
            expect(banner).not.toBeNull();
        });

        it('should append multiple banners', () => {
            ErrorHandler.showErrorBanner('Error 1');
            ErrorHandler.showErrorBanner('Error 2');
            expect(ErrorHandler.errorContainer.children.length).toBe(2);
        });

        it('should create container with correct id and class', () => {
            ErrorHandler.showErrorBanner('Test');
            expect(ErrorHandler.errorContainer.id).toBe('globalErrorBanner');
            expect(ErrorHandler.errorContainer.className).toContain('fixed');
        });

        it('should create banner with close button', () => {
            ErrorHandler.showErrorBanner('Test error');
            const closeButton = ErrorHandler.errorContainer.querySelector('button[aria-label="Dismiss error"]');
            expect(closeButton).not.toBeNull();
        });

        it('should remove banner when close button clicked', () => {
            ErrorHandler.showErrorBanner('Test error');
            const closeButton = ErrorHandler.errorContainer.querySelector('button[aria-label="Dismiss error"]');
            const banner = ErrorHandler.errorContainer.querySelector('[role="alert"]');

            closeButton.click();

            expect(ErrorHandler.errorContainer.contains(banner)).toBe(false);
        });

        it('should auto-remove banner after timeout', () => {
            vi.useFakeTimers();

            ErrorHandler.showErrorBanner('Test error');
            const banner = ErrorHandler.errorContainer.querySelector('[role="alert"]');

            expect(ErrorHandler.errorContainer.contains(banner)).toBe(true);

            vi.advanceTimersByTime(10000);

            expect(ErrorHandler.errorContainer.contains(banner)).toBe(false);

            vi.useRealTimers();
        });

        it('should not throw if banner already removed before timeout', () => {
            vi.useFakeTimers();

            ErrorHandler.showErrorBanner('Test error');
            const closeButton = ErrorHandler.errorContainer.querySelector('button[aria-label="Dismiss error"]');

            closeButton.click();

            expect(() => vi.advanceTimersByTime(10000)).not.toThrow();

            vi.useRealTimers();
        });
    });

    describe('reset', () => {
        it('should reset error count to zero', () => {
            ErrorHandler.handleError(new Error('Test'));
            ErrorHandler.handleError(new Error('Test'));
            expect(ErrorHandler.errorCount).toBe(2);

            ErrorHandler.reset();
            expect(ErrorHandler.errorCount).toBe(0);
        });

        it('should clear error container', () => {
            ErrorHandler.handleError(new Error('Test'));
            expect(ErrorHandler.errorContainer.children.length).toBe(1);

            ErrorHandler.reset();
            expect(ErrorHandler.errorContainer.children.length).toBe(0);
        });

        it('should allow new errors after reset', () => {
            for (let i = 0; i < 5; i++) {
                ErrorHandler.handleError(new Error('Test'));
            }
            expect(ErrorHandler.errorContainer.children.length).toBe(3);

            ErrorHandler.reset();
            ErrorHandler.handleError(new Error('New error'));
            expect(ErrorHandler.errorContainer.children.length).toBe(1);
        });

        it('should handle reset when container is null', () => {
            expect(() => ErrorHandler.reset()).not.toThrow();
        });
    });

    describe('maxErrors limit', () => {
        it('should respect maxErrors setting', () => {
            ErrorHandler.maxErrors = 2;

            ErrorHandler.handleError(new Error('1'));
            ErrorHandler.handleError(new Error('2'));
            ErrorHandler.handleError(new Error('3'));

            expect(ErrorHandler.errorContainer.children.length).toBe(2);
        });

        it('should count errors even after max reached', () => {
            ErrorHandler.maxErrors = 1;

            ErrorHandler.handleError(new Error('1'));
            ErrorHandler.handleError(new Error('2'));
            ErrorHandler.handleError(new Error('3'));

            expect(ErrorHandler.errorCount).toBe(3);
        });
    });

    describe('window global', () => {
        it('should expose ErrorHandler on window', () => {
            expect(window.ErrorHandler).toBeDefined();
            expect(window.ErrorHandler).toBe(ErrorHandler);
        });
    });
});
