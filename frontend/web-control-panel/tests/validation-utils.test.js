import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    Validators,
    showFieldError,
    clearFieldError,
    clearFormErrors,
    validateForm,
    addBlurValidation
} from '../public/js/validation-utils.js';

describe('Validators.required', () => {
    it('should return invalid for empty string', () => {
        const result = Validators.required('', 'Name');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Name is required');
    });

    it('should return invalid for null', () => {
        const result = Validators.required(null);
        expect(result.valid).toBe(false);
    });

    it('should return invalid for undefined', () => {
        const result = Validators.required(undefined);
        expect(result.valid).toBe(false);
    });

    it('should return valid for non-empty string', () => {
        const result = Validators.required('hello');
        expect(result.valid).toBe(true);
    });

    it('should return valid for zero', () => {
        const result = Validators.required(0);
        expect(result.valid).toBe(true);
    });
});

describe('Validators.email', () => {
    it('should return invalid for empty email', () => {
        const result = Validators.email('');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Email is required');
    });

    it('should return invalid for malformed email', () => {
        const result = Validators.email('notanemail');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Please enter a valid email address');
    });

    it('should return invalid for email without domain', () => {
        const result = Validators.email('test@');
        expect(result.valid).toBe(false);
    });

    it('should return valid for correct email', () => {
        const result = Validators.email('test@example.com');
        expect(result.valid).toBe(true);
    });

    it('should return valid for email with subdomain', () => {
        const result = Validators.email('user@mail.example.com');
        expect(result.valid).toBe(true);
    });
});

describe('Validators.numberInRange', () => {
    it('should return invalid for non-numeric value', () => {
        const result = Validators.numberInRange('abc', 1, 10, 'Value');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Value must be a number');
    });

    it('should return invalid for value below min', () => {
        const result = Validators.numberInRange(0, 1, 10, 'Value');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Value must be between 1 and 10');
    });

    it('should return invalid for value above max', () => {
        const result = Validators.numberInRange(11, 1, 10, 'Value');
        expect(result.valid).toBe(false);
    });

    it('should return valid for value at min', () => {
        const result = Validators.numberInRange(1, 1, 10);
        expect(result.valid).toBe(true);
    });

    it('should return valid for value at max', () => {
        const result = Validators.numberInRange(10, 1, 10);
        expect(result.valid).toBe(true);
    });

    it('should return valid for value in range', () => {
        const result = Validators.numberInRange(5.5, 1, 10);
        expect(result.valid).toBe(true);
    });

    it('should parse string numbers correctly', () => {
        const result = Validators.numberInRange('5.5', 1, 10);
        expect(result.valid).toBe(true);
    });
});

describe('Validators.integerInRange', () => {
    it('should return invalid for non-numeric value', () => {
        const result = Validators.integerInRange('abc', 1, 10, 'Count');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Count must be a whole number');
    });

    it('should return invalid for value below min', () => {
        const result = Validators.integerInRange(0, 1, 10, 'Count');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Count must be between 1 and 10');
    });

    it('should return invalid for value above max', () => {
        const result = Validators.integerInRange(11, 1, 10, 'Count');
        expect(result.valid).toBe(false);
    });

    it('should return valid for value at min', () => {
        const result = Validators.integerInRange(1, 1, 10);
        expect(result.valid).toBe(true);
    });

    it('should return valid for value at max', () => {
        const result = Validators.integerInRange(10, 1, 10);
        expect(result.valid).toBe(true);
    });

    it('should return valid for value in range', () => {
        const result = Validators.integerInRange(5, 1, 10);
        expect(result.valid).toBe(true);
    });

    it('should parse string numbers correctly', () => {
        const result = Validators.integerInRange('5', 1, 10);
        expect(result.valid).toBe(true);
    });
});

describe('Validators.oneOf', () => {
    it('should return invalid for value not in list', () => {
        const result = Validators.oneOf('weekly', ['none', 'daily'], 'Recurrence');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Recurrence must be one of: none, daily');
    });

    it('should return valid for value in list', () => {
        const result = Validators.oneOf('daily', ['none', 'daily']);
        expect(result.valid).toBe(true);
    });
});

describe('Validators.futureDate', () => {
    it('should return invalid for missing date', () => {
        const result = Validators.futureDate('', '12:00');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Date and time are required');
    });

    it('should return invalid for missing time', () => {
        const result = Validators.futureDate('2025-12-25', '');
        expect(result.valid).toBe(false);
    });

    it('should return invalid for invalid date format', () => {
        const result = Validators.futureDate('not-a-date', '12:00');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Invalid date or time format');
    });

    it('should return valid for future date', () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        const dateStr = futureDate.toISOString().split('T')[0];
        const result = Validators.futureDate(dateStr, '12:00');
        expect(result.valid).toBe(true);
    });

    it('should return invalid for past date', () => {
        const result = Validators.futureDate('2020-01-01', '12:00');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Scheduled time cannot be in the past');
    });
});

describe('showFieldError', () => {
    it('should add error styling to input', () => {
        document.body.innerHTML = '<div><input id="testInput" class="border-gray-300" /></div>';
        const input = document.getElementById('testInput');

        showFieldError(input, 'Error message');

        expect(input.classList.contains('border-red-500')).toBe(true);
        expect(input.classList.contains('border-gray-300')).toBe(false);
    });

    it('should add error message element', () => {
        document.body.innerHTML = '<div><input id="testInput" /></div>';
        const input = document.getElementById('testInput');

        showFieldError(input, 'Error message');

        const errorEl = input.parentNode.querySelector('.validation-error');
        expect(errorEl).not.toBeNull();
        expect(errorEl.textContent).toBe('Error message');
    });

    it('should clear previous error before showing new one', () => {
        document.body.innerHTML = '<div><input id="testInput" /></div>';
        const input = document.getElementById('testInput');

        showFieldError(input, 'First error');
        showFieldError(input, 'Second error');

        const errors = input.parentNode.querySelectorAll('.validation-error');
        expect(errors.length).toBe(1);
        expect(errors[0].textContent).toBe('Second error');
    });
});

describe('clearFieldError', () => {
    it('should remove error styling from input', () => {
        document.body.innerHTML = '<div><input id="testInput" class="border-red-500" /></div>';
        const input = document.getElementById('testInput');

        clearFieldError(input);

        expect(input.classList.contains('border-red-500')).toBe(false);
        expect(input.classList.contains('border-gray-300')).toBe(true);
    });

    it('should remove error message element', () => {
        document.body.innerHTML = '<div><input id="testInput" /><p class="validation-error">Error</p></div>';
        const input = document.getElementById('testInput');

        clearFieldError(input);

        const errorEl = input.parentNode.querySelector('.validation-error');
        expect(errorEl).toBeNull();
    });
});

describe('clearFormErrors', () => {
    it('should clear all validation errors in form', () => {
        document.body.innerHTML = `
            <form id="testForm">
                <div><input id="input1" class="border-red-500" /><p class="validation-error">Error 1</p></div>
                <div><input id="input2" class="border-red-500" /><p class="validation-error">Error 2</p></div>
            </form>
        `;
        const form = document.getElementById('testForm');

        clearFormErrors(form);

        const errors = form.querySelectorAll('.validation-error');
        expect(errors.length).toBe(0);

        const input1 = document.getElementById('input1');
        const input2 = document.getElementById('input2');
        expect(input1.classList.contains('border-red-500')).toBe(false);
        expect(input2.classList.contains('border-red-500')).toBe(false);
    });
});

describe('validateForm', () => {
    it('should return valid when all validations pass', () => {
        document.body.innerHTML = '<div><input id="testInput" /></div>';
        const input = document.getElementById('testInput');

        const result = validateForm([
            { element: input, validator: Validators.required, args: ['value', 'Field'] }
        ]);

        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
    });

    it('should return invalid with errors when validation fails', () => {
        document.body.innerHTML = '<div><input id="testInput" /></div>';
        const input = document.getElementById('testInput');

        const result = validateForm([
            { element: input, validator: Validators.required, args: ['', 'Field'] }
        ]);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].message).toBe('Field is required');
    });

    it('should show field errors for invalid fields', () => {
        document.body.innerHTML = '<div><input id="testInput" /></div>';
        const input = document.getElementById('testInput');

        validateForm([
            { element: input, validator: Validators.required, args: ['', 'Field'] }
        ]);

        expect(input.classList.contains('border-red-500')).toBe(true);
    });

    it('should handle validation without element', () => {
        const result = validateForm([
            { element: null, validator: Validators.required, args: ['', 'Field'] }
        ]);

        expect(result.valid).toBe(false);
    });
});

describe('addBlurValidation', () => {
    it('should add blur event listener', () => {
        document.body.innerHTML = '<div><input id="testInput" /></div>';
        const input = document.getElementById('testInput');
        const addEventSpy = vi.spyOn(input, 'addEventListener');

        addBlurValidation(input, Validators.required, ['', 'Field']);

        expect(addEventSpy).toHaveBeenCalledWith('blur', expect.any(Function));
    });

    it('should add input event listener', () => {
        document.body.innerHTML = '<div><input id="testInput" /></div>';
        const input = document.getElementById('testInput');
        const addEventSpy = vi.spyOn(input, 'addEventListener');

        addBlurValidation(input, Validators.required, ['', 'Field']);

        expect(addEventSpy).toHaveBeenCalledWith('input', expect.any(Function));
    });

    it('should show error on blur when invalid', () => {
        document.body.innerHTML = '<div><input id="testInput" /></div>';
        const input = document.getElementById('testInput');

        addBlurValidation(input, Validators.required, ['', 'Field']);

        input.dispatchEvent(new Event('blur'));

        expect(input.classList.contains('border-red-500')).toBe(true);
    });

    it('should clear error on input', () => {
        document.body.innerHTML = '<div><input id="testInput" class="border-red-500" /><p class="validation-error">Error</p></div>';
        const input = document.getElementById('testInput');

        addBlurValidation(input, Validators.required, ['value', 'Field']);

        input.dispatchEvent(new Event('input'));

        expect(input.classList.contains('border-red-500')).toBe(false);
    });

    it('should clear field error on blur when valid', () => {
        document.body.innerHTML = '<div><input id="testInput" class="border-red-500" /><p class="validation-error">Error</p></div>';
        const input = document.getElementById('testInput');

        addBlurValidation(input, Validators.required, ['valid-value', 'Field']);

        input.dispatchEvent(new Event('blur'));

        expect(input.classList.contains('border-red-500')).toBe(false);
        expect(input.parentNode.querySelector('.validation-error')).toBeNull();
    });
});

describe('validateForm advanced', () => {
    it('should clear field error when validation passes', () => {
        document.body.innerHTML = '<div><input id="testInput" class="border-red-500" /><p class="validation-error">Old error</p></div>';
        const input = document.getElementById('testInput');

        const result = validateForm([
            { element: input, validator: Validators.required, args: ['valid-value', 'Field'] }
        ]);

        expect(result.valid).toBe(true);
        expect(input.classList.contains('border-red-500')).toBe(false);
        expect(input.parentNode.querySelector('.validation-error')).toBeNull();
    });
});

describe('window globals', () => {
    it('should expose Validators on window', () => {
        expect(window.Validators).toBeDefined();
    });

    it('should expose showFieldError on window', () => {
        expect(window.showFieldError).toBeDefined();
    });

    it('should expose clearFieldError on window', () => {
        expect(window.clearFieldError).toBeDefined();
    });

    it('should expose clearFormErrors on window', () => {
        expect(window.clearFormErrors).toBeDefined();
    });

    it('should expose validateForm on window', () => {
        expect(window.validateForm).toBeDefined();
    });

    it('should expose addBlurValidation on window', () => {
        expect(window.addBlurValidation).toBeDefined();
    });
});
