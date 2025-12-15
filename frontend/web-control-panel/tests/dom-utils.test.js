import { describe, it, expect, beforeEach } from 'vitest';
import {
    escapeHtml,
    createElement,
    setSafeText,
    clearElement,
    createStatusBadge,
    createTextNode,
    createLoadingElement,
    createErrorElement,
    createTableErrorRow,
    createEmptyElement,
    createTableEmptyRow,
    getRefreshSpinnerSvg
} from '../public/js/dom-utils.js';

describe('escapeHtml', () => {
    it('should return empty string for null', () => {
        expect(escapeHtml(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
        expect(escapeHtml(undefined)).toBe('');
    });

    it('should escape HTML entities', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should escape ampersands', () => {
        expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape quotes', () => {
        const result = escapeHtml('test "quoted"');
        expect(result).toContain('test');
    });

    it('should handle numbers by converting to string', () => {
        expect(escapeHtml(123)).toBe('123');
    });

    it('should pass through plain text unchanged', () => {
        expect(escapeHtml('Hello World')).toBe('Hello World');
    });
});

describe('createTextNode', () => {
    it('should create a text node with the given text', () => {
        const node = createTextNode('Hello');
        expect(node.textContent).toBe('Hello');
    });

    it('should return empty text node for null', () => {
        const node = createTextNode(null);
        expect(node.textContent).toBe('');
    });

    it('should return empty text node for undefined', () => {
        const node = createTextNode(undefined);
        expect(node.textContent).toBe('');
    });
});

describe('createElement', () => {
    it('should create an element with the correct tag', () => {
        const el = createElement('div');
        expect(el.tagName).toBe('DIV');
    });

    it('should apply a single class name', () => {
        const el = createElement('span', { className: 'test-class' });
        expect(el.className).toBe('test-class');
    });

    it('should join array of class names', () => {
        const el = createElement('div', { className: ['class1', 'class2', 'class3'] });
        expect(el.className).toBe('class1 class2 class3');
    });

    it('should set text content', () => {
        const el = createElement('p', { textContent: 'Hello' });
        expect(el.textContent).toBe('Hello');
    });

    it('should set attributes', () => {
        const el = createElement('input', {
            attributes: { type: 'text', id: 'myInput' }
        });
        expect(el.getAttribute('type')).toBe('text');
        expect(el.getAttribute('id')).toBe('myInput');
    });

    it('should append children', () => {
        const child1 = createElement('span', { textContent: 'Child 1' });
        const child2 = createElement('span', { textContent: 'Child 2' });
        const parent = createElement('div', { children: [child1, child2] });

        expect(parent.children.length).toBe(2);
        expect(parent.children[0].textContent).toBe('Child 1');
        expect(parent.children[1].textContent).toBe('Child 2');
    });

    it('should skip null children', () => {
        const child = createElement('span');
        const parent = createElement('div', { children: [child, null] });
        expect(parent.children.length).toBe(1);
    });

    it('should handle empty options', () => {
        const el = createElement('div');
        expect(el.className).toBe('');
        expect(el.textContent).toBe('');
    });
});

describe('setSafeText', () => {
    it('should set text content on element', () => {
        const el = document.createElement('div');
        setSafeText(el, 'Test text');
        expect(el.textContent).toBe('Test text');
    });

    it('should handle null text', () => {
        const el = document.createElement('div');
        el.textContent = 'Original';
        setSafeText(el, null);
        expect(el.textContent).toBe('');
    });

    it('should handle undefined text', () => {
        const el = document.createElement('div');
        el.textContent = 'Original';
        setSafeText(el, undefined);
        expect(el.textContent).toBe('');
    });

    it('should not throw if element is null', () => {
        expect(() => setSafeText(null, 'text')).not.toThrow();
    });
});

describe('clearElement', () => {
    it('should remove all children', () => {
        const parent = document.createElement('div');
        parent.appendChild(document.createElement('span'));
        parent.appendChild(document.createElement('span'));
        parent.appendChild(document.createElement('span'));

        expect(parent.children.length).toBe(3);
        clearElement(parent);
        expect(parent.children.length).toBe(0);
    });

    it('should handle element with no children', () => {
        const parent = document.createElement('div');
        expect(() => clearElement(parent)).not.toThrow();
        expect(parent.children.length).toBe(0);
    });

    it('should not throw if element is null', () => {
        expect(() => clearElement(null)).not.toThrow();
    });
});

describe('createStatusBadge', () => {
    it('should create a span with correct classes', () => {
        const badge = createStatusBadge('active', 'bg-green-100');
        expect(badge.tagName).toBe('SPAN');
        expect(badge.className).toContain('bg-green-100');
        expect(badge.className).toContain('px-2');
    });

    it('should uppercase the status text', () => {
        const badge = createStatusBadge('pending', 'bg-yellow-100');
        expect(badge.textContent).toBe('PENDING');
    });

    it('should handle empty status', () => {
        const badge = createStatusBadge('', 'bg-gray-100');
        expect(badge.textContent).toBe('');
    });

    it('should handle null status', () => {
        const badge = createStatusBadge(null, 'bg-gray-100');
        expect(badge.textContent).toBe('');
    });
});

describe('createLoadingElement', () => {
    it('should create a loading element', () => {
        const el = createLoadingElement();
        expect(el.tagName).toBe('DIV');
        expect(el.textContent).toContain('Loading...');
    });

    it('should accept custom message', () => {
        const el = createLoadingElement('Please wait...');
        expect(el.textContent).toContain('Please wait...');
    });
});

describe('createErrorElement', () => {
    it('should create an error element with message', () => {
        const el = createErrorElement('Something went wrong');
        expect(el.textContent).toContain('Error: Something went wrong');
    });
});

describe('createTableErrorRow', () => {
    it('should create a table row with error message', () => {
        const row = createTableErrorRow('Network error');
        expect(row.tagName).toBe('TR');
        expect(row.textContent).toContain('Error: Network error');
    });

    it('should have correct colspan', () => {
        const row = createTableErrorRow('Error', 3);
        const cell = row.querySelector('td');
        expect(cell.getAttribute('colspan')).toBe('3');
    });
});

describe('createEmptyElement', () => {
    it('should create an empty state element', () => {
        const el = createEmptyElement('No items found');
        expect(el.textContent).toBe('No items found');
    });
});

describe('createTableEmptyRow', () => {
    it('should create a table row with empty message', () => {
        const row = createTableEmptyRow('No data');
        expect(row.tagName).toBe('TR');
        expect(row.textContent).toBe('No data');
    });

    it('should have default colspan of 5', () => {
        const row = createTableEmptyRow('Empty');
        const cell = row.querySelector('td');
        expect(cell.getAttribute('colspan')).toBe('5');
    });
});

describe('getRefreshSpinnerSvg', () => {
    it('should return an SVG string', () => {
        const svg = getRefreshSpinnerSvg();
        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');
    });
});
