// Focus Trap Utility for Accessible Modals

export const FocusTrap = {
    activeModal: null,
    previouslyFocused: null,

    /**
     * Get all focusable elements within a container
     */
    getFocusableElements(container) {
        const focusableSelectors = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])'
        ].join(', ');

        return Array.from(container.querySelectorAll(focusableSelectors))
            .filter(el => el.offsetParent !== null);
    },

    /**
     * Handle tab key navigation within modal
     */
    handleKeyDown(event) {
        if (!FocusTrap.activeModal) { return; }

        if (event.key === 'Escape') {
            const closeButton = FocusTrap.activeModal.querySelector('[data-close-modal], #closeModalButton, #cancelButton, #cancelConfirmButton');
            if (closeButton) {
                closeButton.click();
            }
            return;
        }

        if (event.key !== 'Tab') { return; }

        const focusableElements = FocusTrap.getFocusableElements(FocusTrap.activeModal);
        if (focusableElements.length === 0) { return; }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    },

    /**
     * Activate focus trap on a modal
     */
    activate(modalElement) {
        if (this.activeModal) {
            this.deactivate();
        }

        this.activeModal = modalElement;
        this.previouslyFocused = document.activeElement;

        document.addEventListener('keydown', this.handleKeyDown);

        const focusableElements = this.getFocusableElements(modalElement);
        if (focusableElements.length > 0) {
            setTimeout(() => focusableElements[0].focus(), 10);
        }
    },

    /**
     * Deactivate focus trap
     */
    deactivate() {
        document.removeEventListener('keydown', this.handleKeyDown);

        if (this.previouslyFocused && this.previouslyFocused.focus) {
            this.previouslyFocused.focus();
        }

        this.activeModal = null;
        this.previouslyFocused = null;
    },

    /**
     * Setup automatic focus trap for modals that use hidden class
     */
    setupAutoTrap(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) { return; }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isHidden = modal.classList.contains('hidden');
                    if (!isHidden) {
                        FocusTrap.activate(modal);
                    } else if (FocusTrap.activeModal === modal) {
                        FocusTrap.deactivate();
                    }
                }
            });
        });

        observer.observe(modal, { attributes: true });
    }
};

// Keep window global for backward compatibility with non-module scripts
if (typeof window !== 'undefined') {
    window.FocusTrap = FocusTrap;
}
