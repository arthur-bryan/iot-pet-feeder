/**
 * Global Error Handler
 * Catches unhandled errors and displays user-friendly messages
 */

export const ErrorHandler = {
    errorContainer: null,
    errorCount: 0,
    maxErrors: 3,

    init() {
        window.onerror = (message, source, lineno, colno, error) => {
            this.handleError(error || new Error(message));
            return true;
        };

        window.onunhandledrejection = (event) => {
            this.handleError(event.reason);
            event.preventDefault();
        };
    },

    handle(error, context = '') {
        console.error(`Error in ${context}:`, error);
        this.handleError(error);
    },

    handleError(error) {
        this.errorCount++;

        if (this.errorCount > this.maxErrors) {
            return;
        }

        const errorMessage = error?.message || 'An unexpected error occurred';

        this.showErrorBanner(errorMessage);
    },

    showErrorBanner(message) {
        if (!this.errorContainer) {
            this.errorContainer = document.createElement('div');
            this.errorContainer.id = 'globalErrorBanner';
            this.errorContainer.className = 'fixed bottom-4 right-4 max-w-sm z-50';
            document.body.appendChild(this.errorContainer);
        }

        const banner = document.createElement('div');
        banner.className = 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-2 shadow-lg';
        banner.setAttribute('role', 'alert');

        const content = document.createElement('div');
        content.className = 'flex items-start gap-3';

        const icon = document.createElement('div');
        icon.className = 'flex-shrink-0 text-red-500 dark:text-red-400';
        icon.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';

        const text = document.createElement('div');
        text.className = 'flex-1';

        const title = document.createElement('p');
        title.className = 'text-sm font-medium text-red-800 dark:text-red-200';
        title.textContent = 'Something went wrong';

        const description = document.createElement('p');
        description.className = 'text-xs text-red-600 dark:text-red-300 mt-1';
        description.textContent = message;

        text.appendChild(title);
        text.appendChild(description);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'flex-shrink-0 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300';
        closeBtn.setAttribute('aria-label', 'Dismiss error');
        closeBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
        closeBtn.onclick = () => banner.remove();

        content.appendChild(icon);
        content.appendChild(text);
        content.appendChild(closeBtn);
        banner.appendChild(content);

        this.errorContainer.appendChild(banner);

        setTimeout(() => {
            if (banner.parentNode) {
                banner.remove();
            }
        }, 10000);
    },

    reset() {
        this.errorCount = 0;
        if (this.errorContainer) {
            this.errorContainer.innerHTML = '';
        }
    }
};

// Immediately assign to window global for backward compatibility
if (typeof window !== 'undefined') {
    // Process any queued calls from the stub
    const queue = window.ErrorHandler?._queue || [];

    window.ErrorHandler = ErrorHandler;
    window.ErrorHandler._initialized = true;

    // Process queued calls
    queue.forEach(({ error, context }) => {
        ErrorHandler.handle(error, context);
    });

    // Auto-initialize immediately if DOM already loaded, otherwise wait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            ErrorHandler.init();
        });
    } else {
        ErrorHandler.init();
    }
}
