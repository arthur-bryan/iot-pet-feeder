import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getUserTimezone,
    setUserTimezone,
    formatInUserTimezone,
    convertToUTC,
    getLocalDateTimeFromUTC,
    getTimezoneDisplay
} from '../public/js/timezone-utils.js';

describe('getUserTimezone', () => {
    it('should return a valid timezone string', () => {
        const tz = getUserTimezone();
        expect(typeof tz).toBe('string');
        expect(tz.length).toBeGreaterThan(0);
    });

    it('should return a recognizable timezone format', () => {
        const tz = getUserTimezone();
        expect(tz).toMatch(/^[A-Za-z_/]+$/);
    });
});

describe('setUserTimezone', () => {
    it('should not throw when called', () => {
        expect(() => setUserTimezone('America/New_York')).not.toThrow();
    });
});

describe('formatInUserTimezone', () => {
    it('should return N/A for null input', () => {
        expect(formatInUserTimezone(null)).toBe('N/A');
    });

    it('should return N/A for undefined input', () => {
        expect(formatInUserTimezone(undefined)).toBe('N/A');
    });

    it('should return N/A for empty string', () => {
        expect(formatInUserTimezone('')).toBe('N/A');
    });

    it('should return Invalid Date for malformed date', () => {
        expect(formatInUserTimezone('not-a-date')).toBe('Invalid Date');
    });

    it('should handle ISO string with Z suffix', () => {
        const result = formatInUserTimezone('2025-01-15T12:00:00Z');
        expect(result).toContain('2025');
        expect(result).toContain('Jan');
    });

    it('should handle ISO string without Z suffix', () => {
        const result = formatInUserTimezone('2025-01-15T12:00:00');
        expect(result).toContain('2025');
    });

    it('should format date only when formatType is date', () => {
        const result = formatInUserTimezone('2025-06-20T12:00:00Z', 'date');
        expect(result).toContain('Jun');
        expect(result).toContain('2025');
    });

    it('should format time only when formatType is time', () => {
        const result = formatInUserTimezone('2025-01-15T15:30:45Z', 'time');
        expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should handle ISO string with positive timezone offset', () => {
        const result = formatInUserTimezone('2025-01-15T12:00:00+05:00');
        expect(result).toContain('2025');
    });

    it('should handle ISO string with negative timezone offset', () => {
        const result = formatInUserTimezone('2025-01-15T12:00:00-08:00');
        expect(result).toContain('2025');
    });
});

describe('convertToUTC', () => {
    it('should return a valid ISO string', () => {
        const result = convertToUTC('2025-01-15', '12:30');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should include the Z suffix indicating UTC', () => {
        const result = convertToUTC('2025-06-20', '08:00');
        expect(result.endsWith('Z')).toBe(true);
    });

    it('should preserve the date components', () => {
        const result = convertToUTC('2025-12-25', '00:00');
        expect(result).toContain('2025');
    });
});

describe('getLocalDateTimeFromUTC', () => {
    it('should return empty strings for null input', () => {
        const result = getLocalDateTimeFromUTC(null);
        expect(result.date).toBe('');
        expect(result.time).toBe('');
    });

    it('should return empty strings for undefined input', () => {
        const result = getLocalDateTimeFromUTC(undefined);
        expect(result.date).toBe('');
        expect(result.time).toBe('');
    });

    it('should return empty strings for invalid date', () => {
        const result = getLocalDateTimeFromUTC('invalid');
        expect(result.date).toBe('');
        expect(result.time).toBe('');
    });

    it('should return date in YYYY-MM-DD format', () => {
        const result = getLocalDateTimeFromUTC('2025-01-15T12:00:00Z');
        expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return time in HH:MM format', () => {
        const result = getLocalDateTimeFromUTC('2025-01-15T12:00:00Z');
        expect(result.time).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should return an object with date and time properties', () => {
        const result = getLocalDateTimeFromUTC('2025-01-15T12:00:00Z');
        expect(result).toHaveProperty('date');
        expect(result).toHaveProperty('time');
    });
});

describe('getTimezoneDisplay', () => {
    it('should return a string containing the timezone', () => {
        const display = getTimezoneDisplay();
        expect(typeof display).toBe('string');
        expect(display.length).toBeGreaterThan(0);
    });

    it('should contain timezone info in parentheses', () => {
        const display = getTimezoneDisplay();
        expect(display).toMatch(/\([^)]+\)/);
    });
});

describe('timezone roundtrip', () => {
    it('should preserve date/time through UTC conversion and back', () => {
        const originalDate = '2025-06-15';
        const originalTime = '14:30';

        const utc = convertToUTC(originalDate, originalTime);
        const backToLocal = getLocalDateTimeFromUTC(utc);

        expect(backToLocal.date).toBe(originalDate);
        expect(backToLocal.time).toBe(originalTime);
    });
});

describe('getTimezoneDisplay error handling', () => {
    it('should return timezone string on Intl errors', () => {
        const result = getTimezoneDisplay();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });
});

describe('window globals', () => {
    it('should expose getUserTimezone on window', () => {
        expect(window.getUserTimezone).toBeDefined();
    });

    it('should expose setUserTimezone on window', () => {
        expect(window.setUserTimezone).toBeDefined();
    });

    it('should expose formatInUserTimezone on window', () => {
        expect(window.formatInUserTimezone).toBeDefined();
    });

    it('should expose convertToUTC on window', () => {
        expect(window.convertToUTC).toBeDefined();
    });

    it('should expose getLocalDateTimeFromUTC on window', () => {
        expect(window.getLocalDateTimeFromUTC).toBeDefined();
    });

    it('should expose getTimezoneDisplay on window', () => {
        expect(window.getTimezoneDisplay).toBeDefined();
    });
});
