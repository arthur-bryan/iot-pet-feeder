// Safe DOM manipulation utilities
// Prevents XSS vulnerabilities by escaping HTML entities

/**
 * Escapes HTML entities in a string to prevent XSS attacks.
 * @param {string} str - The string to escape
 * @returns {string} The escaped string safe for HTML insertion
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/**
 * Creates a text node safely.
 * @param {string} text - The text content
 * @returns {Text} A text node
 */
export function createTextNode(text) {
    return document.createTextNode(text || '');
}

/**
 * Creates an element with optional classes and text content.
 * @param {string} tag - The element tag name
 * @param {Object} options - Options for the element
 * @param {string|string[]} options.className - CSS class(es)
 * @param {string} options.textContent - Text content
 * @param {Object} options.attributes - HTML attributes
 * @param {HTMLElement[]} options.children - Child elements
 * @returns {HTMLElement} The created element
 */
export function createElement(tag, options = {}) {
    const el = document.createElement(tag);

    if (options.className) {
        if (Array.isArray(options.className)) {
            el.className = options.className.join(' ');
        } else {
            el.className = options.className;
        }
    }

    if (options.textContent !== undefined) {
        el.textContent = options.textContent;
    }

    if (options.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
            el.setAttribute(key, value);
        }
    }

    if (options.children) {
        options.children.forEach(child => {
            if (child) el.appendChild(child);
        });
    }

    return el;
}

/**
 * Sets safe text content on an element.
 * @param {HTMLElement} element - The element to update
 * @param {string} text - The text content
 */
export function setSafeText(element, text) {
    if (element) {
        element.textContent = text || '';
    }
}

/**
 * Creates a loading spinner element.
 * @param {string} message - Optional loading message
 * @returns {HTMLElement} The loading element
 */
export function createLoadingElement(message = 'Loading...') {
    const container = createElement('div', { className: 'py-8 text-center' });

    const spinner = createElement('div', {
        className: 'animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4'
    });
    spinner.innerHTML = `<svg fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>`;

    const text = createElement('p', {
        className: 'text-sm text-gray-500 dark:text-gray-400',
        textContent: message
    });

    container.appendChild(spinner);
    container.appendChild(text);
    return container;
}

/**
 * Creates an error message element.
 * @param {string} message - The error message
 * @returns {HTMLElement} The error element
 */
export function createErrorElement(message) {
    const container = createElement('div', {
        className: 'py-8 text-center text-sm text-red-600 dark:text-red-400',
        textContent: `Error: ${message}`
    });
    return container;
}

/**
 * Creates a table row error element.
 * @param {string} message - The error message
 * @param {number} colspan - Number of columns to span
 * @returns {HTMLElement} The table row element
 */
export function createTableErrorRow(message, colspan = 5) {
    const row = createElement('tr');
    const cell = createElement('td', {
        className: 'py-8 text-center text-sm text-red-600 dark:text-red-400',
        textContent: `Error: ${message}`,
        attributes: { colspan: String(colspan) }
    });
    row.appendChild(cell);
    return row;
}

/**
 * Creates an empty state element.
 * @param {string} message - The empty state message
 * @returns {HTMLElement} The empty state element
 */
export function createEmptyElement(message) {
    const container = createElement('div', {
        className: 'py-8 text-center text-sm text-gray-500 dark:text-gray-400',
        textContent: message
    });
    return container;
}

/**
 * Creates a table row empty state element.
 * @param {string} message - The empty state message
 * @param {number} colspan - Number of columns to span
 * @returns {HTMLElement} The table row element
 */
export function createTableEmptyRow(message, colspan = 5) {
    const row = createElement('tr');
    const cell = createElement('td', {
        className: 'py-8 text-center text-sm text-gray-500 dark:text-gray-400',
        textContent: message,
        attributes: { colspan: String(colspan) }
    });
    row.appendChild(cell);
    return row;
}

/**
 * Creates a status badge element.
 * @param {string} status - The status value
 * @param {string} className - CSS classes for styling
 * @returns {HTMLElement} The badge element
 */
export function createStatusBadge(status, className) {
    return createElement('span', {
        className: `${className} px-2 py-1 rounded-full text-xs font-medium`,
        textContent: (status || '').toUpperCase()
    });
}

/**
 * Clears all children from an element.
 * @param {HTMLElement} element - The element to clear
 */
export function clearElement(element) {
    if (element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
}

/**
 * Creates a refresh button spinner SVG.
 * @returns {string} The SVG HTML string (static, safe)
 */
export function getRefreshSpinnerSvg() {
    return `<svg class="w-5 h-5 text-gray-600 dark:text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>`;
}

// Expose functions globally for non-module scripts
if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.createTextNode = createTextNode;
    window.createElement = createElement;
    window.setSafeText = setSafeText;
    window.createLoadingElement = createLoadingElement;
    window.createErrorElement = createErrorElement;
    window.createTableErrorRow = createTableErrorRow;
    window.createEmptyElement = createEmptyElement;
    window.createTableEmptyRow = createTableEmptyRow;
    window.createStatusBadge = createStatusBadge;
    window.clearElement = clearElement;
    window.getRefreshSpinnerSvg = getRefreshSpinnerSvg;
}
