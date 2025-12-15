// Timezone Utility Functions

/**
 * Get user's current timezone from browser
 * Always uses the browser's timezone (no manual selection)
 */
export function getUserTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/**
 * Legacy function - no-op for backwards compatibility
 * Timezone is now always the browser's timezone
 */
export function setUserTimezone(_timezone) {
    // No-op: timezone is always determined by browser
}

/**
 * Convert UTC ISO string to user's timezone and format it
 * @param {string} utcISOString - UTC timestamp in ISO format
 * @param {string} formatType - 'datetime', 'date', 'time'
 * @returns {string} Formatted date/time string
 */
export function formatInUserTimezone(utcISOString, formatType = 'datetime') {
    if (!utcISOString) return 'N/A';

    const userTz = getUserTimezone();

    // Ensure the string has 'Z' suffix to be interpreted as UTC
    // DynamoDB may return ISO strings without 'Z'
    let isoString = utcISOString;
    if (!isoString.endsWith('Z') && !isoString.includes('+') && !isoString.includes('-', 10)) {
        isoString = isoString + 'Z';
    }

    const date = new Date(isoString);

    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }

    const options = {
        timeZone: userTz
    };

    if (formatType === 'datetime') {
        options.year = 'numeric';
        options.month = 'short';
        options.day = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        options.hour12 = true;
    } else if (formatType === 'date') {
        options.year = 'numeric';
        options.month = 'short';
        options.day = 'numeric';
    } else if (formatType === 'time') {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        options.hour12 = true;
    }

    return date.toLocaleString('en-US', options);
}

/**
 * Convert user's local date/time input to UTC ISO string
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} timeString - Time in HH:MM format
 * @returns {string} UTC ISO string
 */
export function convertToUTC(dateString, timeString) {
    // Create a date string in ISO format (without timezone = local time)
    const localDateTimeString = `${dateString}T${timeString}:00`;

    // new Date() with ISO string (no Z) interprets it as LOCAL browser time
    // Then toISOString() converts it to UTC automatically
    const date = new Date(localDateTimeString);

    return date.toISOString();
}

/**
 * Get date and time components from UTC string in user's timezone
 * @param {string} utcISOString - UTC timestamp
 * @returns {object} { date: 'YYYY-MM-DD', time: 'HH:MM' }
 */
export function getLocalDateTimeFromUTC(utcISOString) {
    if (!utcISOString) return { date: '', time: '' };

    const userTz = getUserTimezone();
    const date = new Date(utcISOString);

    if (isNaN(date.getTime())) {
        return { date: '', time: '' };
    }

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: userTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;

    return {
        date: `${year}-${month}-${day}`,
        time: `${hour}:${minute}`
    };
}

/**
 * Get timezone abbreviation/offset display
 * @returns {string} e.g., "EST (UTC-5)" or "PST (UTC-8)"
 */
export function getTimezoneDisplay() {
    const userTz = getUserTimezone();
    const now = new Date();

    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: userTz,
            timeZoneName: 'short'
        });

        const parts = formatter.formatToParts(now);
        const tzName = parts.find(p => p.type === 'timeZoneName')?.value || userTz;

        return `${userTz} (${tzName})`;
    } catch (e) {
        return userTz;
    }
}

// Expose functions globally for non-module scripts
if (typeof window !== 'undefined') {
    window.getUserTimezone = getUserTimezone;
    window.setUserTimezone = setUserTimezone;
    window.formatInUserTimezone = formatInUserTimezone;
    window.convertToUTC = convertToUTC;
    window.getLocalDateTimeFromUTC = getLocalDateTimeFromUTC;
    window.getTimezoneDisplay = getTimezoneDisplay;
}
