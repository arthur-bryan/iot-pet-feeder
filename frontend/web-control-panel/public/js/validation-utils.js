// Validation Utility Functions
import { createElement } from './dom-utils.js';

export const Validators = {
    /**
     * Check if value is not empty
     */
    required(value, fieldName = 'Field') {
        if (value === null || value === undefined || value === '') {
            return { valid: false, message: `${fieldName} is required` };
        }
        return { valid: true };
    },

    /**
     * Check if value is a valid email
     */
    email(value) {
        if (!value) {
            return { valid: false, message: 'Email is required' };
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return { valid: false, message: 'Please enter a valid email address' };
        }
        return { valid: true };
    },

    /**
     * Check if number is within range
     */
    numberInRange(value, min, max, fieldName = 'Value') {
        const num = Number(value);
        if (isNaN(num)) {
            return { valid: false, message: `${fieldName} must be a number` };
        }
        if (num < min || num > max) {
            return { valid: false, message: `${fieldName} must be between ${min} and ${max}` };
        }
        return { valid: true };
    },

    /**
     * Check if integer is within range
     */
    integerInRange(value, min, max, fieldName = 'Value') {
        const num = parseInt(value, 10);
        if (isNaN(num)) {
            return { valid: false, message: `${fieldName} must be a whole number` };
        }
        if (num < min || num > max) {
            return { valid: false, message: `${fieldName} must be between ${min} and ${max}` };
        }
        return { valid: true };
    },

    /**
     * Check if date is valid and not in the past
     */
    futureDate(dateValue, timeValue, allowToday = true) {
        if (!dateValue || !timeValue) {
            return { valid: false, message: 'Date and time are required' };
        }

        const dateTimeString = `${dateValue}T${timeValue}:00`;
        const selectedDate = new Date(dateTimeString);

        if (isNaN(selectedDate.getTime())) {
            return { valid: false, message: 'Invalid date or time format' };
        }

        const now = new Date();
        if (allowToday) {
            now.setSeconds(0, 0);
        }

        if (selectedDate < now) {
            return { valid: false, message: 'Scheduled time cannot be in the past' };
        }

        return { valid: true };
    },

    /**
     * Check if value is in allowed list
     */
    oneOf(value, allowedValues, fieldName = 'Value') {
        if (!allowedValues.includes(value)) {
            return { valid: false, message: `${fieldName} must be one of: ${allowedValues.join(', ')}` };
        }
        return { valid: true };
    }
};

/**
 * Display validation error on a form field
 */
export function showFieldError(inputElement, message) {
    clearFieldError(inputElement);

    inputElement.classList.add('border-red-500', 'dark:border-red-500');
    inputElement.classList.remove('border-gray-300', 'dark:border-gray-600');

    const errorElement = createElement('p', {
        className: 'mt-1 text-sm text-red-600 dark:text-red-400 validation-error',
        textContent: message
    });

    inputElement.parentNode.appendChild(errorElement);
}

/**
 * Clear validation error from a form field
 */
export function clearFieldError(inputElement) {
    inputElement.classList.remove('border-red-500', 'dark:border-red-500');
    inputElement.classList.add('border-gray-300', 'dark:border-gray-600');

    const existingError = inputElement.parentNode.querySelector('.validation-error');
    if (existingError) {
        existingError.remove();
    }
}

/**
 * Clear all validation errors in a form
 */
export function clearFormErrors(formElement) {
    const errors = formElement.querySelectorAll('.validation-error');
    errors.forEach(error => error.remove());

    const inputs = formElement.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.classList.remove('border-red-500', 'dark:border-red-500');
        input.classList.add('border-gray-300', 'dark:border-gray-600');
    });
}

/**
 * Validate multiple fields and return overall result
 */
export function validateForm(validations) {
    let allValid = true;
    const errors = [];

    for (const { element, validator, args } of validations) {
        const result = validator(...args);
        if (!result.valid) {
            allValid = false;
            errors.push({ element, message: result.message });
            if (element) {
                showFieldError(element, result.message);
            }
        } else if (element) {
            clearFieldError(element);
        }
    }

    return { valid: allValid, errors };
}

/**
 * Add real-time validation to input on blur
 */
export function addBlurValidation(inputElement, validator, args = []) {
    inputElement.addEventListener('blur', () => {
        const result = validator(...args);
        if (!result.valid) {
            showFieldError(inputElement, result.message);
        } else {
            clearFieldError(inputElement);
        }
    });

    inputElement.addEventListener('input', () => {
        clearFieldError(inputElement);
    });
}

// Expose functions globally for non-module scripts
if (typeof window !== 'undefined') {
    window.Validators = Validators;
    window.showFieldError = showFieldError;
    window.clearFieldError = clearFieldError;
    window.clearFormErrors = clearFormErrors;
    window.validateForm = validateForm;
    window.addBlurValidation = addBlurValidation;
}
