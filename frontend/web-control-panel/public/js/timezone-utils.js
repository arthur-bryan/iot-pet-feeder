// Timezone Utility Functions

// Common timezones list
const COMMON_TIMEZONES = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
    { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
    { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
    { value: 'America/Anchorage', label: 'Alaska' },
    { value: 'Pacific/Honolulu', label: 'Hawaii' },
    { value: 'America/Phoenix', label: 'Arizona' },
    { value: 'America/Toronto', label: 'Toronto' },
    { value: 'America/Vancouver', label: 'Vancouver' },
    { value: 'America/Sao_Paulo', label: 'Brasilia' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Paris', label: 'Paris, Berlin, Rome' },
    { value: 'Europe/Athens', label: 'Athens, Helsinki, Istanbul' },
    { value: 'Europe/Moscow', label: 'Moscow' },
    { value: 'Africa/Cairo', label: 'Cairo' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg' },
    { value: 'Asia/Dubai', label: 'Dubai' },
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Asia/Shanghai', label: 'Beijing, Shanghai' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
    { value: 'Asia/Seoul', label: 'Seoul' },
    { value: 'Asia/Singapore', label: 'Singapore' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
    { value: 'Australia/Sydney', label: 'Sydney' },
    { value: 'Australia/Melbourne', label: 'Melbourne' },
    { value: 'Pacific/Auckland', label: 'Auckland' }
];

/**
 * Get user's  current timezone from localStorage or browser default
 */
function getUserTimezone() {
    const stored = localStorage.getItem('userTimezone');
    if (stored) {
        return stored;
    }
    // Default to browser's timezone
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/**
 * Set user's timezone preference
 */
function setUserTimezone(timezone) {
    localStorage.setItem('userTimezone', timezone);
}

/**
 * Convert UTC ISO string to user's timezone and format it
 * @param {string} utcISOString - UTC timestamp in ISO format
 * @param {string} formatType - 'datetime', 'date', 'time'
 * @returns {string} Formatted date/time string
 */
function formatInUserTimezone(utcISOString, formatType = 'datetime') {
    if (!utcISOString) return 'N/A';

    const userTz = getUserTimezone();
    const date = new Date(utcISOString);

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
function convertToUTC(dateString, timeString) {
    const userTz = getUserTimezone();

    // Create a date string in user's timezone
    const localDateTimeString = `${dateString}T${timeString}:00`;

    // Parse as if it's in the user's timezone
    const date = new Date(localDateTimeString);

    // Get the offset for the user's timezone at this specific date/time
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    // Create date in user's timezone
    const parts = formatter.formatToParts(new Date(localDateTimeString));
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;

    // Create a proper date object with timezone consideration
    const tzDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);

    // Use a more reliable method: create date string and explicitly set timezone
    const options = {
        timeZone: userTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    // Get UTC timestamp by parsing the local time as if it were in the target timezone
    const dateInUserTz = new Date(new Date(localDateTimeString).toLocaleString('en-US', { timeZone: userTz }));
    const dateInUTC = new Date(new Date(localDateTimeString).toLocaleString('en-US', { timeZone: 'UTC' }));

    const offset = dateInUserTz.getTime() - dateInUTC.getTime();
    const utcDate = new Date(date.getTime() - offset);

    return utcDate.toISOString();
}

/**
 * Get date and time components from UTC string in user's timezone
 * @param {string} utcISOString - UTC timestamp
 * @returns {object} { date: 'YYYY-MM-DD', time: 'HH:MM' }
 */
function getLocalDateTimeFromUTC(utcISOString) {
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
function getTimezoneDisplay() {
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
