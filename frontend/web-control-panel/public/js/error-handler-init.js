/**
 * Error Handler Initialization Script
 * Loads synchronously to ensure window.ErrorHandler is available immediately
 */

// Create a minimal stub that queues calls until the real handler is loaded
window.ErrorHandler = window.ErrorHandler || {
    _queue: [],
    handle: function(error, context) {
        // Queue the call if the real handler isn't loaded yet
        if (!this._initialized) {
            this._queue.push({ error, context });
        } else {
            // Real handler should replace this
            console.error(`Error in ${context}:`, error);
        }
    },
    _initialized: false
};
