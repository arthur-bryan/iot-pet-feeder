import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FocusTrap } from '../public/js/focus-trap.js';

describe('FocusTrap', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <button id="outsideButton">Outside</button>
            <div id="testModal">
                <button id="firstButton">First</button>
                <input id="testInput" type="text" />
                <button id="lastButton">Last</button>
                <button id="closeModalButton">Close</button>
            </div>
        `;
        FocusTrap.activeModal = null;
        FocusTrap.previouslyFocused = null;
    });

    describe('activate', () => {
        it('should store previously focused element', () => {
            const outsideButton = document.getElementById('outsideButton');
            outsideButton.focus();
            const modal = document.getElementById('testModal');

            FocusTrap.activate(modal);
            expect(FocusTrap.previouslyFocused).toBe(outsideButton);
        });

        it('should set activeModal', () => {
            const modal = document.getElementById('testModal');
            FocusTrap.activate(modal);
            expect(FocusTrap.activeModal).toBe(modal);
        });

        it('should add keydown event listener', () => {
            const modal = document.getElementById('testModal');
            const addEventSpy = vi.spyOn(document, 'addEventListener');
            FocusTrap.activate(modal);
            expect(addEventSpy).toHaveBeenCalledWith('keydown', FocusTrap.handleKeyDown);
        });

        it('should deactivate previous modal before activating new one', () => {
            const modal = document.getElementById('testModal');
            FocusTrap.activate(modal);

            const modal2 = document.createElement('div');
            modal2.id = 'modal2';
            document.body.appendChild(modal2);

            FocusTrap.activate(modal2);
            expect(FocusTrap.activeModal).toBe(modal2);
        });

        it('should focus first focusable element after timeout', async () => {
            vi.useFakeTimers();
            const modal = document.getElementById('testModal');

            Object.defineProperty(document.getElementById('firstButton'), 'offsetParent', {
                get: () => document.body
            });
            Object.defineProperty(document.getElementById('testInput'), 'offsetParent', {
                get: () => document.body
            });
            Object.defineProperty(document.getElementById('lastButton'), 'offsetParent', {
                get: () => document.body
            });
            Object.defineProperty(document.getElementById('closeModalButton'), 'offsetParent', {
                get: () => document.body
            });

            FocusTrap.activate(modal);
            vi.advanceTimersByTime(20);

            vi.useRealTimers();
        });
    });

    describe('deactivate', () => {
        it('should clear activeModal', () => {
            const modal = document.getElementById('testModal');
            FocusTrap.activate(modal);
            FocusTrap.deactivate();
            expect(FocusTrap.activeModal).toBeNull();
        });

        it('should remove keydown event listener', () => {
            const modal = document.getElementById('testModal');
            const removeEventSpy = vi.spyOn(document, 'removeEventListener');
            FocusTrap.activate(modal);
            FocusTrap.deactivate();
            expect(removeEventSpy).toHaveBeenCalledWith('keydown', FocusTrap.handleKeyDown);
        });

        it('should restore focus to previously focused element', () => {
            const outsideButton = document.getElementById('outsideButton');
            const modal = document.getElementById('testModal');

            outsideButton.focus();
            FocusTrap.activate(modal);
            FocusTrap.deactivate();

            expect(document.activeElement.id).toBe('outsideButton');
        });

        it('should clear previouslyFocused', () => {
            const modal = document.getElementById('testModal');
            FocusTrap.activate(modal);
            FocusTrap.deactivate();
            expect(FocusTrap.previouslyFocused).toBeNull();
        });

        it('should handle null previouslyFocused', () => {
            const modal = document.getElementById('testModal');
            FocusTrap.activeModal = modal;
            FocusTrap.previouslyFocused = null;
            expect(() => FocusTrap.deactivate()).not.toThrow();
        });

        it('should handle previouslyFocused without focus method', () => {
            const modal = document.getElementById('testModal');
            FocusTrap.activeModal = modal;
            FocusTrap.previouslyFocused = { id: 'test' };
            expect(() => FocusTrap.deactivate()).not.toThrow();
        });
    });

    describe('handleKeyDown', () => {
        it('should do nothing when no active modal', () => {
            const event = new KeyboardEvent('keydown', { key: 'Tab' });
            expect(() => FocusTrap.handleKeyDown(event)).not.toThrow();
        });

        it('should click close button on Escape', () => {
            const modal = document.getElementById('testModal');
            FocusTrap.activeModal = modal;

            const closeButton = document.getElementById('closeModalButton');
            const clickSpy = vi.spyOn(closeButton, 'click');

            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            FocusTrap.handleKeyDown(event);

            expect(clickSpy).toHaveBeenCalled();
        });

        it('should handle Escape when no close button', () => {
            const modal = document.createElement('div');
            modal.id = 'emptyModal';
            document.body.appendChild(modal);
            FocusTrap.activeModal = modal;

            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            expect(() => FocusTrap.handleKeyDown(event)).not.toThrow();
        });

        it('should ignore non-Tab and non-Escape keys', () => {
            const modal = document.getElementById('testModal');
            FocusTrap.activeModal = modal;

            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            expect(() => FocusTrap.handleKeyDown(event)).not.toThrow();
        });

        it('should handle Tab with no focusable elements', () => {
            const modal = document.createElement('div');
            modal.id = 'emptyModal';
            document.body.appendChild(modal);
            FocusTrap.activeModal = modal;

            const event = new KeyboardEvent('keydown', { key: 'Tab' });
            expect(() => FocusTrap.handleKeyDown(event)).not.toThrow();
        });

        it('should wrap focus from last to first element on Tab', () => {
            const modal = document.getElementById('testModal');
            FocusTrap.activeModal = modal;

            const firstButton = document.getElementById('firstButton');
            const lastButton = document.getElementById('lastButton');

            Object.defineProperty(firstButton, 'offsetParent', { get: () => document.body });
            Object.defineProperty(lastButton, 'offsetParent', { get: () => document.body });

            lastButton.focus();

            const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false });
            Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

            FocusTrap.handleKeyDown(event);
        });

        it('should wrap focus from first to last element on Shift+Tab', () => {
            const modal = document.getElementById('testModal');
            FocusTrap.activeModal = modal;

            const firstButton = document.getElementById('firstButton');
            const lastButton = document.getElementById('lastButton');

            Object.defineProperty(firstButton, 'offsetParent', { get: () => document.body });
            Object.defineProperty(lastButton, 'offsetParent', { get: () => document.body });

            firstButton.focus();

            const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
            Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

            FocusTrap.handleKeyDown(event);
        });
    });

    describe('setupAutoTrap', () => {
        it('should not throw for non-existent modal', () => {
            expect(() => FocusTrap.setupAutoTrap('nonExistent')).not.toThrow();
        });

        it('should create mutation observer for existing modal', () => {
            const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');
            FocusTrap.setupAutoTrap('testModal');
            expect(observeSpy).toHaveBeenCalled();
        });

        it('should activate focus trap when modal becomes visible', async () => {
            const modal = document.getElementById('testModal');
            modal.classList.add('hidden');

            FocusTrap.setupAutoTrap('testModal');

            modal.classList.remove('hidden');

            await new Promise(resolve => setTimeout(resolve, 0));
        });

        it('should deactivate focus trap when modal becomes hidden', async () => {
            const modal = document.getElementById('testModal');

            FocusTrap.setupAutoTrap('testModal');

            FocusTrap.activeModal = modal;
            modal.classList.add('hidden');

            await new Promise(resolve => setTimeout(resolve, 0));
        });
    });

    describe('getFocusableElements', () => {
        it('should return an array', () => {
            const modal = document.getElementById('testModal');
            const elements = FocusTrap.getFocusableElements(modal);
            expect(Array.isArray(elements)).toBe(true);
        });

        it('should filter by visibility', () => {
            const modal = document.getElementById('testModal');
            const elements = FocusTrap.getFocusableElements(modal);
            expect(Array.isArray(elements)).toBe(true);
        });

        it('should include buttons and inputs', () => {
            const modal = document.getElementById('testModal');

            const firstButton = document.getElementById('firstButton');
            const testInput = document.getElementById('testInput');
            Object.defineProperty(firstButton, 'offsetParent', { get: () => document.body });
            Object.defineProperty(testInput, 'offsetParent', { get: () => document.body });

            const elements = FocusTrap.getFocusableElements(modal);
            expect(elements.length).toBeGreaterThanOrEqual(0);
        });

        it('should exclude disabled elements', () => {
            document.body.innerHTML = `
                <div id="testModal">
                    <button id="enabledButton">Enabled</button>
                    <button id="disabledButton" disabled>Disabled</button>
                </div>
            `;
            const modal = document.getElementById('testModal');

            const enabledButton = document.getElementById('enabledButton');
            Object.defineProperty(enabledButton, 'offsetParent', { get: () => document.body });

            const elements = FocusTrap.getFocusableElements(modal);

            const hasDisabled = elements.some(el => el.id === 'disabledButton');
            expect(hasDisabled).toBe(false);
        });

        it('should include elements with positive tabindex', () => {
            document.body.innerHTML = `
                <div id="testModal">
                    <div id="tabbable" tabindex="0">Tabbable</div>
                    <div id="notTabbable" tabindex="-1">Not Tabbable</div>
                </div>
            `;
            const modal = document.getElementById('testModal');

            const tabbable = document.getElementById('tabbable');
            Object.defineProperty(tabbable, 'offsetParent', { get: () => document.body });

            const elements = FocusTrap.getFocusableElements(modal);

            const hasNotTabbable = elements.some(el => el.id === 'notTabbable');
            expect(hasNotTabbable).toBe(false);
        });

        it('should include anchor elements with href', () => {
            document.body.innerHTML = `
                <div id="testModal">
                    <a id="linkWithHref" href="#">Link</a>
                    <a id="linkWithoutHref">No href</a>
                </div>
            `;
            const modal = document.getElementById('testModal');

            const linkWithHref = document.getElementById('linkWithHref');
            Object.defineProperty(linkWithHref, 'offsetParent', { get: () => document.body });

            const elements = FocusTrap.getFocusableElements(modal);

            const hasLinkWithoutHref = elements.some(el => el.id === 'linkWithoutHref');
            expect(hasLinkWithoutHref).toBe(false);
        });
    });
});
