/**
 * Pet Feeder Main Application
 * @fileoverview Main dashboard functionality including feed commands, history, and device status
 * @version 1.0.0
 */

// --- Imports ---
import { clearElement, createElement, createTableEmptyRow, createTableErrorRow } from './dom-utils.js';
import { formatInUserTimezone } from './timezone-utils.js';
import { FocusTrap } from './focus-trap.js';

// --- Constants ---
const getApiBaseUrl = () => window.ENV?.VITE_API_BASE_URL;
const POLLING_STATUS_BASE_MS = 15000;
const POLLING_STATUS_MAX_MS = 60000;
const POLLING_HISTORY_BASE_MS = 30000;
const POLLING_HISTORY_MAX_MS = 120000;
const JITTER_MAX_MS = 2000;
const MAX_API_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// --- Main App Elements ---
const feedButton = document.getElementById('feedButton');
const feedMessage = document.getElementById('feedMessage');
const eventsContainer = document.getElementById('eventsContainer');
const prevPageButton = document.getElementById('prevPageButton');
const nextPageButton = document.getElementById('nextPageButton');
const pageInfo = document.getElementById('pageInfo');
const deviceStatusElement = document.getElementById('deviceStatus');
const statusMessageElement = document.getElementById('statusMessage');
const currentWeightElement = document.getElementById('currentWeight');
const refreshButton = document.getElementById('refreshButton');
const themeToggleButton = document.getElementById('themeToggleButton');
const _sunIcon = document.getElementById('sunIcon');
const _moonIcon = document.getElementById('moonIcon');
// --- Configuration Elements ---
const durationDisplay = document.getElementById('durationDisplay');
const durationInput = document.getElementById('durationInput');
const editDurationButton = document.getElementById('editDurationButton');
const saveDurationButton = document.getElementById('saveDurationButton');
const cancelDurationButton = document.getElementById('cancelDurationButton');
const weightThresholdDisplay = document.getElementById('weightThresholdDisplay');
const weightThresholdInput = document.getElementById('weightThresholdInput');
const editWeightThresholdButton = document.getElementById('editWeightThresholdButton');
const saveWeightThresholdButton = document.getElementById('saveWeightThresholdButton');
const cancelWeightThresholdButton = document.getElementById('cancelWeightThresholdButton');
const emailNotificationsToggle = document.getElementById('emailNotificationsToggle');
const emailDisplay = document.getElementById('emailDisplay');
const emailInput = document.getElementById('emailInput');
const editEmailButton = document.getElementById('editEmailButton');
const saveEmailButton = document.getElementById('saveEmailButton');
const cancelEmailButton = document.getElementById('cancelEmailButton');
// --- END Configuration Elements ---


// --- Modal Elements ---
const messageModal = document.getElementById('messageModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const closeModalButton = document.getElementById('closeModalButton');

const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let totalPages = 1;
let currentUserName = "Guest";

let statusPollingInterval = null;
let historyPollingInterval = null;
let isPageVisible = true;

// Cache for smart updates - only update DOM when data changes
let cachedStatus = null;
let cachedHistoryHash = null;

// Adaptive polling configuration
const POLLING_CONFIG = {
    status: {
        base: POLLING_STATUS_BASE_MS,
        max: POLLING_STATUS_MAX_MS,
        current: POLLING_STATUS_BASE_MS,
        unchangedCount: 0
    },
    history: {
        base: POLLING_HISTORY_BASE_MS,
        max: POLLING_HISTORY_MAX_MS,
        current: POLLING_HISTORY_BASE_MS,
        unchangedCount: 0
    }
};

/**
 * Add random jitter to polling interval to prevent synchronized requests
 * @param {number} interval - Base interval in milliseconds
 * @returns {number} Interval with random jitter added
 */
function addJitter(interval) {
    return interval + Math.random() * JITTER_MAX_MS;
}

/**
 * Fetch with retry logic for resilient API calls
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} retries - Number of retries remaining
 * @returns {Promise<Response>} Fetch response
 */
async function _fetchWithRetry(url, options = {}, retries = MAX_API_RETRIES) {
    try {
        const response = await fetch(url, options);
        if (!response.ok && retries > 0 && response.status >= 500) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            return _fetchWithRetry(url, options, retries - 1);
        }
        return response;
    } catch (error) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            return _fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}

// --- Helper Functions ---

// Handle page visibility changes to stop/start polling
function handleVisibilityChange() {
    if (document.hidden) {
        isPageVisible = false;
        stopPolling();
    } else {
        isPageVisible = true;
        // Reset intervals to base when returning
        POLLING_CONFIG.status.current = POLLING_CONFIG.status.base;
        POLLING_CONFIG.history.current = POLLING_CONFIG.history.base;

        // Fetch fresh data immediately
        updateDeviceStatus();
        fetchFeedHistory(currentPage);
        if (currentView === 'chart') {
            loadChartData(currentTimeInterval);
        }
        startPolling();
    }
}

function stopPolling() {
    if (statusPollingInterval) {
        clearTimeout(statusPollingInterval);
        statusPollingInterval = null;
    }
    if (historyPollingInterval) {
        clearTimeout(historyPollingInterval);
        historyPollingInterval = null;
    }
}

function startPolling() {
    stopPolling();
    scheduleStatusPoll();
    scheduleHistoryPoll();
}

function scheduleStatusPoll() {
    if (!isPageVisible) return;

    const interval = addJitter(POLLING_CONFIG.status.current);
    statusPollingInterval = setTimeout(async () => {
        if (!isPageVisible) return;

        const hadChanges = await pollStatus();

        // Adaptive backoff: increase interval when no changes
        if (hadChanges) {
            POLLING_CONFIG.status.current = POLLING_CONFIG.status.base;
            POLLING_CONFIG.status.unchangedCount = 0;
        } else {
            POLLING_CONFIG.status.unchangedCount++;
            if (POLLING_CONFIG.status.unchangedCount >= 3) {
                POLLING_CONFIG.status.current = Math.min(
                    POLLING_CONFIG.status.current * 1.5,
                    POLLING_CONFIG.status.max
                );
            }
        }

        scheduleStatusPoll();
    }, interval);
}

function scheduleHistoryPoll() {
    if (!isPageVisible) return;

    const interval = addJitter(POLLING_CONFIG.history.current);
    historyPollingInterval = setTimeout(async () => {
        if (!isPageVisible) return;

        const hadChanges = await pollHistory();

        // Adaptive backoff: increase interval when no changes
        if (hadChanges) {
            POLLING_CONFIG.history.current = POLLING_CONFIG.history.base;
            POLLING_CONFIG.history.unchangedCount = 0;
        } else {
            POLLING_CONFIG.history.unchangedCount++;
            if (POLLING_CONFIG.history.unchangedCount >= 2) {
                POLLING_CONFIG.history.current = Math.min(
                    POLLING_CONFIG.history.current * 1.5,
                    POLLING_CONFIG.history.max
                );
            }
        }

        scheduleHistoryPoll();
    }, interval);
}

async function pollStatus() {
    try {
        const data = await getCachedStatus();
        return data !== null;
    } catch (error) {
        if (window.ErrorHandler) {
            window.ErrorHandler.handle(error, 'pollStatus');
        }
        return false;
    }
}

async function pollHistory() {
    try {
        await fetchFeedHistory(currentPage);
        // Chart shares history data, no separate request needed
        if (currentView === 'chart') {
            await loadChartData(currentTimeInterval);
        }
        return true;
    } catch (error) {
        if (window.ErrorHandler) {
            window.ErrorHandler.handle(error, 'pollHistory');
        }
        return false;
    }
}

// Temporarily increase polling frequency after user actions
function boostPolling() {
    POLLING_CONFIG.status.current = POLLING_CONFIG.status.base;
    POLLING_CONFIG.status.unchangedCount = 0;
    POLLING_CONFIG.history.current = POLLING_CONFIG.history.base;
    POLLING_CONFIG.history.unchangedCount = 0;

    // Restart polling with boosted intervals
    startPolling();
}

function toggleTheme() {
    Theme.toggle(function() {
        if (typeof currentView !== 'undefined' && currentView === 'chart' && typeof weightChart !== 'undefined' && weightChart) {
            loadChartData(currentTimeInterval);
        }
    });
}

function toggleSettingsDropdown() {
    const dropdown = document.getElementById('settingsDropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function closeSettingsDropdown(event) {
    const toggleBtn = document.getElementById('settingsToggleButton');
    const dropdown = document.getElementById('settingsDropdown');
    if (toggleBtn && dropdown && !toggleBtn.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
}

function initializeTheme() {
    Theme.initialize();
}

function toggleWeightThresholdEditMode(isEditing) {
    const weightUnit = weightThresholdDisplay.nextElementSibling; // Get the "g" label
    if (isEditing) {
        weightThresholdDisplay.classList.add('hidden');
        if (weightUnit) weightUnit.classList.add('hidden');
        weightThresholdInput.classList.remove('hidden');
        editWeightThresholdButton.classList.add('hidden');
        saveWeightThresholdButton.classList.remove('hidden');
        cancelWeightThresholdButton.classList.remove('hidden');
        weightThresholdInput.focus();
    } else {
        weightThresholdDisplay.classList.remove('hidden');
        if (weightUnit) weightUnit.classList.remove('hidden');
        weightThresholdInput.classList.add('hidden');
        editWeightThresholdButton.classList.remove('hidden');
        saveWeightThresholdButton.classList.add('hidden');
        cancelWeightThresholdButton.classList.add('hidden');
    }
}

function toggleDurationEditMode(isEditing) {
    const durationUnit = durationDisplay.nextElementSibling; // Get the "ms" label
    if (isEditing) {
        durationDisplay.classList.add('hidden');
        if (durationUnit) durationUnit.classList.add('hidden');
        durationInput.classList.remove('hidden');
        editDurationButton.classList.add('hidden');
        saveDurationButton.classList.remove('hidden');
        cancelDurationButton.classList.remove('hidden');
        durationInput.focus();
    } else {
        durationDisplay.classList.remove('hidden');
        if (durationUnit) durationUnit.classList.remove('hidden');
        durationInput.classList.add('hidden');
        editDurationButton.classList.remove('hidden');
        saveDurationButton.classList.add('hidden');
        cancelDurationButton.classList.add('hidden');
    }
}

function toggleEmailEditMode(isEditing) {
    if (isEditing) {
        emailDisplay.classList.add('hidden');
        emailInput.classList.remove('hidden');
        editEmailButton.classList.add('hidden');
        saveEmailButton.classList.remove('hidden');
        cancelEmailButton.classList.remove('hidden');
        emailInput.focus();
    } else {
        emailDisplay.classList.remove('hidden');
        emailInput.classList.add('hidden');
        editEmailButton.classList.remove('hidden');
        saveEmailButton.classList.add('hidden');
        cancelEmailButton.classList.add('hidden');
    }
}

function formatTimestamp(isoString) {
    try {
        // Use timezone utility function from timezone-utils.js
        return formatInUserTimezone(isoString, 'datetime');
    } catch (e) {
        return isoString;
    }
}

function getStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'queued': return 'status-queued';
        case 'sent': return 'status-sent';
        case 'completed': return 'status-completed';
        case 'failed': return 'status-failed';
        default: return '';
    }
}

function getEventTypeDisplay(eventType) {
    const types = {
        'manual_feed': { label: 'Manual Feed', color: 'text-blue-600 dark:text-blue-400' },
        'consumption': { label: 'Pet Ate', color: 'text-green-600 dark:text-green-400' },
        'refill': { label: 'Refilled', color: 'text-purple-600 dark:text-purple-400' },
        'scheduled_feed': { label: 'Scheduled', color: 'text-orange-600 dark:text-orange-400' }
    };

    const type = types[eventType] || { label: eventType || 'Unknown', color: 'text-gray-600 dark:text-gray-400' };
    const outer = createElement('span', { className: type.color });
    const inner = createElement('span', { className: 'font-medium', textContent: type.label });
    outer.appendChild(inner);
    return outer;
}

function formatWeightChange(weightBefore, weightAfter, weightDelta) {
    // If no weight data available
    if (weightBefore === undefined || weightBefore === null || weightAfter === undefined || weightAfter === null) {
        return createElement('span', {
            className: 'text-gray-400 dark:text-gray-500 text-xs',
            textContent: 'No data'
        });
    }

    // Calculate delta if not provided
    const delta = weightDelta !== undefined && weightDelta !== null ? weightDelta : (weightAfter - weightBefore);

    // Determine color and icon based on change
    let icon = '';
    let colorClass = '';

    if (delta > 0) {
        icon = '⬆️';
        colorClass = 'text-green-600 dark:text-green-400';
    } else if (delta < 0) {
        icon = '⬇️';
        colorClass = 'text-red-600 dark:text-red-400';
    } else {
        icon = '➖';
        colorClass = 'text-gray-400 dark:text-gray-500';
    }

    const container = createElement('div', { className: 'flex flex-col gap-0.5' });
    const deltaRow = createElement('div', { className: `flex items-center gap-1 ${colorClass}` });
    deltaRow.appendChild(createElement('span', { textContent: icon }));
    deltaRow.appendChild(createElement('span', {
        className: 'font-semibold',
        textContent: `${delta > 0 ? '+' : ''}${delta.toFixed(1)}g`
    }));
    container.appendChild(deltaRow);

    const rangeRow = createElement('div', {
        className: 'text-xs text-gray-500 dark:text-gray-400',
        textContent: `${weightBefore.toFixed(1)}g → ${weightAfter.toFixed(1)}g`
    });
    container.appendChild(rangeRow);

    return container;
}

/**
 * Shows a custom modal with a given title and message.
 * @param {string} title The title of the modal.
 * @param {string} message The message content of the modal.
 */
function showModal(title, message) {
    if (!modalTitle || !modalMessage || !messageModal) {
        console.error('Modal elements not found');
        return;
    }
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    messageModal.classList.remove('hidden');
}

/**
 * Hides the custom modal.
 */
function hideModal() {
    messageModal.classList.add('hidden');
}

// --- API Calls ---

async function fetchServoDuration() {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS`, {
            headers: authHeaders
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const duration = data.value || 'N/A';
        if (durationDisplay) durationDisplay.textContent = duration;
        if (durationInput) durationInput.value = duration;
    } catch (error) {
        if (durationDisplay) durationDisplay.textContent = "Error";
        throw error;
    }
}

async function fetchWeightThreshold() {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/config/WEIGHT_THRESHOLD_G`, {
            headers: authHeaders
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const threshold = data.value || 450;
        if (weightThresholdDisplay) weightThresholdDisplay.textContent = threshold;
        if (weightThresholdInput) weightThresholdInput.value = threshold;
    } catch (error) {
        if (weightThresholdDisplay) weightThresholdDisplay.textContent = "Error";
        throw error;
    }
}

async function setServoDuration(newDuration) {
    if (isNaN(newDuration) || newDuration < 1000 || newDuration > 60000) {
        showModal('Invalid Value', 'Please enter a hold duration between 1000 ms and 60000 ms (1 to 60 seconds).');
        return false;
    }

    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ value: newDuration, key: "SERVO_OPEN_HOLD_DURATION_MS" })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        showModal('Success', `Hold duration updated to ${data.value} ms.`);
        return true;

    } catch (error) {
        showModal('Error', `Failed to save duration: ${error.message}`);
        return false;
    }
}

async function setWeightThreshold(newThreshold) {
    if (isNaN(newThreshold) || newThreshold < 50 || newThreshold > 5000) {
        showModal('Invalid Value', 'Please enter a weight threshold between 50g and 5000g.');
        return false;
    }

    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/config/WEIGHT_THRESHOLD_G`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ value: newThreshold, key: "WEIGHT_THRESHOLD_G" })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        showModal('Success', `Weight threshold updated to ${data.value}g.`);
        return true;

    } catch (error) {
        showModal('Error', `Failed to save threshold: ${error.message}`);
        return false;
    }
}

async function fetchEmailConfig() {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/config/EMAIL_NOTIFICATIONS`, {
            headers: authHeaders
        });
        if (!response.ok) {
            if (response.status === 404) {
                if (emailDisplay) emailDisplay.textContent = "Not configured";
                if (emailNotificationsToggle) emailNotificationsToggle.checked = false;
                return;
            }
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const config = data.value ? JSON.parse(data.value) : null;
        if (config) {
            if (emailDisplay) emailDisplay.textContent = config.email || "Not configured";
            if (emailInput) emailInput.value = config.email || "";
            if (emailNotificationsToggle) emailNotificationsToggle.checked = config.enabled || false;
        }
    } catch (error) {
        if (emailDisplay) emailDisplay.textContent = "Error";
        throw error;
    }
}

async function subscribeToNotifications(email) {
    const validation = Validators.email(email);
    if (!validation.valid) {
        showModal('Invalid Email', validation.message);
        return false;
    }

    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/notifications/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Save subscription info to config
        const config = { email, subscription_arn: data.subscription_arn, enabled: false };
        const authHeaders2 = await auth.getAuthHeaders();
        await fetch(`${getApiBaseUrl()}/api/v1/config/EMAIL_NOTIFICATIONS`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders2
            },
            body: JSON.stringify({ value: JSON.stringify(config), key: "EMAIL_NOTIFICATIONS" })
        });

        showModal('Subscription Pending', 'Please check your email and click the confirmation link from AWS SNS to activate notifications.');
        return true;

    } catch (error) {
        showModal('Error', `Failed to subscribe: ${error.message}`);
        return false;
    }
}

async function setEmailConfig(email, enabled) {
    try {
        const config = { email, enabled };
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/config/EMAIL_NOTIFICATIONS`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ value: JSON.stringify(config), key: "EMAIL_NOTIFICATIONS" })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        await response.json();
        showModal('Success', `Email notifications ${enabled ? 'enabled' : 'disabled'}.`);
        return true;

    } catch (error) {
        showModal('Error', `Failed to save email config: ${error.message}`);
        return false;
    }
}

// Function to send feed command
async function sendFeedCommand() {
    // Check if feeder is busy before sending command
    const currentFeederStatus = deviceStatusElement?.textContent?.toUpperCase() || '';
    if (currentFeederStatus === 'OPENING' || currentFeederStatus === 'OPEN' || currentFeederStatus === 'CLOSING') {
        showModal('Feeder Busy', 'The feeder is currently busy. Please wait a moment before sending another command.');
        return;
    }

    feedButton.disabled = true;
    feedMessage.textContent = "Sending feed command...";
    feedMessage.className = "text-sm text-gray-600 mt-3";

    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/feeds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ "requested_by": currentUserName, "mode": "api" })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        feedMessage.textContent = `Command sent! Status: ${data.status.toUpperCase()}`;
        feedMessage.className = "text-sm text-green-600 mt-3 font-semibold";

        // Immediately update status and history
        updateDeviceStatus();
        setTimeout(() => {
            fetchFeedHistory(1);
        }, 1000);

        // Boost polling to catch status updates faster
        boostPolling();

    } catch (error) {
        feedMessage.textContent = `Failed to send command: ${error.message}`;
        feedMessage.className = "text-sm text-red-600 mt-3 font-semibold";
    } finally {
        feedButton.disabled = false;
    }
}

// Generate hash for history data to detect changes
function generateHistoryHash(items, page) {
    if (!items || items.length === 0) return `empty-${page}`;
    const ids = items.map(e => `${e.feed_id}:${e.status}`).join('|');
    return `${page}-${ids}`;
}

// Helper to create a feed event mobile card (safe DOM manipulation)
function createFeedEventCard(event) {
    const card = createElement('div', {
        className: 'bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600'
    });

    // Header row
    const headerRow = createElement('div', { className: 'flex items-start justify-between mb-2' });
    const eventTypeContainer = createElement('div', { className: 'flex-1' });
    eventTypeContainer.appendChild(getEventTypeDisplay(event.event_type));
    headerRow.appendChild(eventTypeContainer);

    const statusBadge = createElement('span', {
        className: `${getStatusClass(event.status)} px-2 py-1 rounded-full text-xs font-medium`,
        textContent: (event.status || '').toUpperCase()
    });
    headerRow.appendChild(statusBadge);
    card.appendChild(headerRow);

    // Timestamp row
    const timestampRow = createElement('div', {
        className: 'text-xs text-gray-600 dark:text-gray-400 mb-2',
        textContent: formatTimestamp(event.timestamp)
    });
    card.appendChild(timestampRow);

    // Footer row
    const footerRow = createElement('div', { className: 'flex items-center justify-between text-sm' });
    const requestedBy = createElement('span', {
        className: 'text-gray-500 dark:text-gray-400',
        textContent: event.requested_by || 'N/A'
    });
    footerRow.appendChild(requestedBy);
    footerRow.appendChild(formatWeightChange(event.weight_before_g, event.weight_after_g, event.weight_delta_g));
    card.appendChild(footerRow);

    return card;
}

// Helper to create a feed event desktop row (safe DOM manipulation)
function createFeedEventRow(event) {
    const row = createElement('tr', { className: 'history-item' });

    // Timestamp cell
    const timestampCell = createElement('td', {
        className: 'py-3 text-sm text-gray-900 dark:text-gray-200',
        textContent: formatTimestamp(event.timestamp)
    });
    row.appendChild(timestampCell);

    // Event type cell
    const eventTypeCell = createElement('td', { className: 'py-3 text-sm' });
    eventTypeCell.appendChild(getEventTypeDisplay(event.event_type));
    row.appendChild(eventTypeCell);

    // Requested by cell
    const requestedByCell = createElement('td', {
        className: 'py-3 text-sm text-gray-600 dark:text-gray-400',
        textContent: event.requested_by || 'N/A'
    });
    row.appendChild(requestedByCell);

    // Weight change cell
    const weightCell = createElement('td', { className: 'py-3 text-sm' });
    weightCell.appendChild(formatWeightChange(event.weight_before_g, event.weight_after_g, event.weight_delta_g));
    row.appendChild(weightCell);

    // Status cell
    const statusCell = createElement('td', { className: 'py-3 text-sm' });
    const statusBadge = createElement('span', {
        className: `${getStatusClass(event.status)} px-2 py-1 rounded-full text-xs font-medium`,
        textContent: (event.status || '').toUpperCase()
    });
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    return row;
}

// Function to fetch and display feeding history (smart update - skips DOM if data unchanged)
async function fetchFeedHistory(page = 1, forceRefresh = false) {
    const mobileContainer = document.getElementById('eventsContainer');
    const desktopContainer = document.getElementById('eventsContainerDesktop');

    // Only show loading on initial load or forced refresh
    if (!cachedHistoryHash || forceRefresh) {
        clearElement(mobileContainer);
        mobileContainer.appendChild(createEmptyElement('Loading...'));
        if (desktopContainer) {
            clearElement(desktopContainer);
            desktopContainer.appendChild(createTableEmptyRow('Loading...', 5));
        }
        pageInfo.textContent = 'Loading...';
        prevPageButton.disabled = true;
        nextPageButton.disabled = true;
    }

    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/feed-events?page=${page}&limit=${ITEMS_PER_PAGE}`, {
            headers: authHeaders
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Check if data changed using hash comparison
        const newHash = generateHistoryHash(data.items, page);
        if (!forceRefresh && cachedHistoryHash === newHash) {
            return; // Data unchanged, skip DOM updates
        }
        cachedHistoryHash = newHash;

        clearElement(mobileContainer);
        if (desktopContainer) clearElement(desktopContainer);

        if (data.items && data.items.length > 0) {
            data.items.forEach(event => {
                mobileContainer.appendChild(createFeedEventCard(event));
                if (desktopContainer) {
                    desktopContainer.appendChild(createFeedEventRow(event));
                }
            });

            totalPages = data.total_pages;
            currentPage = data.page;
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            prevPageButton.disabled = currentPage === 1;
            nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
        } else {
            mobileContainer.appendChild(createEmptyElement('No feeding events found.'));
            if (desktopContainer) {
                desktopContainer.appendChild(createTableEmptyRow('No feeding events found.', 5));
            }
            pageInfo.textContent = 'Page 0 of 0';
        }
    } catch (error) {
        clearElement(mobileContainer);
        mobileContainer.appendChild(createErrorElement(error.message));
        if (desktopContainer) {
            clearElement(desktopContainer);
            desktopContainer.appendChild(createTableErrorRow(error.message, 5));
        }
        pageInfo.textContent = 'Error';
    }
}

// [REMOVED] requestRealtimeStatus - unused endpoint causing 403 errors
// Frontend now relies on getCachedStatus which polls ESP32 shadow state every 3s

// Function to get cached device status from DynamoDB
async function getCachedStatus() {
    try {
        const timestamp = new Date().getTime();
        const url = `${getApiBaseUrl()}/api/v1/status?_t=${timestamp}`;

        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(url, {
            headers: authHeaders
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        updateStatusUI(data);
        return data;
    } catch (error) {
        if (deviceStatusElement) deviceStatusElement.textContent = "Error";
        if (statusMessageElement) statusMessageElement.textContent = "Could not fetch device status";
        if (currentWeightElement) currentWeightElement.textContent = "--";
        throw error;
    }
}

// Helper function to update status UI elements (smart update - only changes DOM if data changed)
function updateStatusUI(statusData) {
    // Compare with cached status to avoid unnecessary DOM updates
    const newState = statusData.feeder_state?.toUpperCase() || '';
    const newWeight = (statusData.current_weight_g || 0).toFixed(1);
    const newTimestamp = formatTimestamp(statusData.last_updated);

    const hasChanges = !cachedStatus ||
        cachedStatus.state !== newState ||
        cachedStatus.weight !== newWeight ||
        cachedStatus.timestamp !== newTimestamp;

    if (!hasChanges) {
        return; // No changes, skip DOM updates
    }

    // Update cache
    cachedStatus = { state: newState, weight: newWeight, timestamp: newTimestamp };

    // Only update DOM elements that changed
    if (deviceStatusElement && deviceStatusElement.textContent !== newState) {
        deviceStatusElement.textContent = newState;
    }

    const newStatusMessage = `Last updated: ${newTimestamp}`;
    if (statusMessageElement && statusMessageElement.textContent !== newStatusMessage) {
        statusMessageElement.textContent = newStatusMessage;
    }

    if (currentWeightElement && currentWeightElement.textContent !== newWeight) {
        currentWeightElement.textContent = newWeight;
    }
}

// Function to update device status (kept for backward compatibility with auto-refresh)
async function updateDeviceStatus() {
    // For auto-refresh, use cached status to reduce costs
    return await getCachedStatus();
}

// --- Event Listeners & Initial Load ---

// Settings event listeners (only if settings elements exist - legacy support)
if (editDurationButton && saveDurationButton && cancelDurationButton) {
    editDurationButton.addEventListener('click', () => {
        toggleDurationEditMode(true);
    });

    cancelDurationButton.addEventListener('click', () => {
        durationInput.value = durationDisplay.textContent.trim();
        toggleDurationEditMode(false);
    });

    saveDurationButton.addEventListener('click', async () => {
        const newDuration = parseInt(durationInput.value, 10);
        const success = await setServoDuration(newDuration);
        if (success) {
            durationDisplay.textContent = newDuration;
            toggleDurationEditMode(false);
            boostPolling();
        }
    });
}

if (editWeightThresholdButton && saveWeightThresholdButton && cancelWeightThresholdButton) {
    editWeightThresholdButton.addEventListener('click', () => {
        toggleWeightThresholdEditMode(true);
    });

    cancelWeightThresholdButton.addEventListener('click', () => {
        weightThresholdInput.value = weightThresholdDisplay.textContent.trim();
        toggleWeightThresholdEditMode(false);
    });

    saveWeightThresholdButton.addEventListener('click', async () => {
        const newThreshold = parseInt(weightThresholdInput.value, 10);
        const success = await setWeightThreshold(newThreshold);
        if (success) {
            weightThresholdDisplay.textContent = newThreshold;
            toggleWeightThresholdEditMode(false);
            boostPolling();
        }
    });
}

if (editEmailButton && saveEmailButton && cancelEmailButton && emailNotificationsToggle) {
    editEmailButton.addEventListener('click', () => {
        toggleEmailEditMode(true);
    });

    cancelEmailButton.addEventListener('click', () => {
        emailInput.value = emailDisplay.textContent.trim();
        toggleEmailEditMode(false);
    });

    saveEmailButton.addEventListener('click', async () => {
        const email = emailInput.value.trim();

        // First subscribe the email to SNS
        const success = await subscribeToNotifications(email);
        if (success) {
            emailDisplay.textContent = `${email} (pending confirmation)`;
            emailNotificationsToggle.checked = false;
            emailNotificationsToggle.disabled = true;
            toggleEmailEditMode(false);
        }
    });

    emailNotificationsToggle.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        const currentEmail = emailDisplay.textContent.trim();

        if (currentEmail === "Not configured" || currentEmail === "Error") {
            showModal('Email Required', 'Please configure your email address first before enabling notifications.');
            e.target.checked = false;
            return;
        }

        await setEmailConfig(currentEmail, enabled);
    });
}

feedButton.addEventListener('click', sendFeedCommand);
prevPageButton.addEventListener('click', () => {
    if (currentPage > 1) {
        fetchFeedHistory(currentPage - 1);
    }
});
nextPageButton.addEventListener('click', () => {
    if (currentPage < totalPages) {
        fetchFeedHistory(currentPage + 1);
    }
});
refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true;
    const originalHTML = refreshButton.innerHTML;
    refreshButton.innerHTML = `
        <svg class="w-5 h-5 text-gray-600 dark:text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
    `;

    try {
        const authHeaders = await auth.getAuthHeaders();
        const statusResponse = await fetch(`${getApiBaseUrl()}/api/v1/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            }
        });

        if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.status) {
                updateStatusUI(statusData.status);
            }
        }

        await Promise.all([
            fetchServoDuration(),
            fetchWeightThreshold(),
            fetchFeedHistory(1, true)
        ]);

        if (currentView === 'chart') {
            await loadChartData(currentTimeInterval);
        }

        // Reset polling intervals after manual refresh
        boostPolling();
    } catch (error) {
        if (window.ErrorHandler) {
            window.ErrorHandler.handle(error, 'refreshData');
        }
        const msg = error?.message || 'Unknown error';
        if (modalTitle && modalMessage) {
            showModal('Refresh Error', `Failed to refresh data: ${msg}`);
        }
    } finally {
        refreshButton.disabled = false;
        refreshButton.innerHTML = originalHTML;
    }
});
closeModalButton.addEventListener('click', hideModal);
themeToggleButton.addEventListener('click', toggleTheme);

// Navigation button handlers
const schedulesButton = document.getElementById('schedulesButton');
if (schedulesButton) {
    schedulesButton.addEventListener('click', () => {
        window.location.href = 'schedules.html';
    });
}

const settingsButton = document.getElementById('settingsButton');
if (settingsButton) {
    settingsButton.addEventListener('click', () => {
        window.location.href = 'settings.html';
    });
}

// Settings dropdown (only if elements exist - legacy support)
const settingsToggleButton = document.getElementById('settingsToggleButton');
const settingsDropdown = document.getElementById('settingsDropdown');
if (settingsToggleButton && settingsDropdown) {
    settingsToggleButton.addEventListener('click', toggleSettingsDropdown);
    document.addEventListener('click', closeSettingsDropdown);
}

// --- Chart View Functionality ---

let weightChart = null;
let currentView = 'table'; // 'table' or 'chart'
let currentTimeInterval = '24h';

const viewTypeSelect = document.getElementById('viewTypeSelect');
const prevViewButton = document.getElementById('prevViewButton');
const nextViewButton = document.getElementById('nextViewButton');
const tableViewContainer = document.getElementById('tableViewContainer');
const chartViewContainer = document.getElementById('chartViewContainer');
const timeRangeFilters = document.getElementById('timeRangeFilters');
const quickTimeRange = document.getElementById('quickTimeRange');
const toggleCustomRange = document.getElementById('toggleCustomRange');
const customRangeContainer = document.getElementById('customRangeContainer');
const customStartTime = document.getElementById('customStartTime');
const customEndTime = document.getElementById('customEndTime');
const applyCustomRange = document.getElementById('applyCustomRange');

function switchView(newView) {
    currentView = newView;
    viewTypeSelect.value = newView;

    if (newView === 'table') {
        tableViewContainer.classList.remove('hidden');
        chartViewContainer.classList.add('hidden');
        timeRangeFilters.classList.add('hidden');
        fetchFeedHistory(currentPage);
    } else if (newView === 'chart') {
        tableViewContainer.classList.add('hidden');
        chartViewContainer.classList.remove('hidden');
        timeRangeFilters.classList.remove('hidden');
        loadChartData(currentTimeInterval);
    }
}

function getTimeRange(interval) {
    const now = new Date();
    const start = new Date();

    switch(interval) {
        case '15m':
            start.setMinutes(now.getMinutes() - 15);
            break;
        case '30m':
            start.setMinutes(now.getMinutes() - 30);
            break;
        case '1h':
            start.setHours(now.getHours() - 1);
            break;
        case '3h':
            start.setHours(now.getHours() - 3);
            break;
        case '6h':
            start.setHours(now.getHours() - 6);
            break;
        case '12h':
            start.setHours(now.getHours() - 12);
            break;
        case '24h':
            start.setDate(now.getDate() - 1);
            break;
        case '48h':
            start.setDate(now.getDate() - 2);
            break;
        case '7d':
            start.setDate(now.getDate() - 7);
            break;
        case '30d':
            start.setDate(now.getDate() - 30);
            break;
        case '90d':
            start.setDate(now.getDate() - 90);
            break;
        default:
            start.setDate(now.getDate() - 1);
    }

    return {
        start: start.toISOString(),
        end: now.toISOString()
    };
}

async function loadChartData(interval, customRange = null) {
    const chartLoadingMessage = document.getElementById('chartLoadingMessage');
    if (chartLoadingMessage) {
        chartLoadingMessage.classList.remove('hidden');
    }

    try {
        let timeRange;
        if (customRange) {
            timeRange = customRange;
        } else {
            timeRange = getTimeRange(interval);
        }

        const authHeaders = await auth.getAuthHeaders();

        // Fetch events within time range
        const rangeUrl = `${getApiBaseUrl()}/api/v1/feed-events?start_time=${encodeURIComponent(timeRange.start)}&end_time=${encodeURIComponent(timeRange.end)}&limit=1000`;
        const rangeResponse = await fetch(rangeUrl, { headers: authHeaders });

        if (!rangeResponse.ok) {
            throw new Error(`HTTP ${rangeResponse.status}`);
        }

        const rangeData = await rangeResponse.json();
        let events = rangeData.items || [];

        // If no events in range, fetch most recent event before range to show current weight
        if (events.length === 0) {
            const latestUrl = `${getApiBaseUrl()}/api/v1/feed-events?end_time=${encodeURIComponent(timeRange.start)}&limit=1`;
            const latestResponse = await fetch(latestUrl, { headers: authHeaders });

            if (latestResponse.ok) {
                const latestData = await latestResponse.json();
                if (latestData.items && latestData.items.length > 0) {
                    events = latestData.items;
                }
            }
        }

        renderWeightChart(events, timeRange, rangeData.items?.length || 0);
    } catch (error) {
        showModal('Chart Error', `Failed to load chart data: ${error.message}`);
    } finally {
        if (chartLoadingMessage) {
            chartLoadingMessage.classList.add('hidden');
        }
    }
}

function updateEventStatistics(feedEvents, actualCount = null) {
    // If actualCount is 0, no events in range - show zeros
    if (actualCount === 0) {
        const totalEventsCount = document.getElementById('totalEventsCount');
        const manualFeedCount = document.getElementById('manualFeedCount');
        const consumptionCount = document.getElementById('consumptionCount');
        const refillCount = document.getElementById('refillCount');

        if (totalEventsCount) totalEventsCount.textContent = 0;
        if (manualFeedCount) manualFeedCount.textContent = 0;
        if (consumptionCount) consumptionCount.textContent = 0;
        if (refillCount) refillCount.textContent = 0;
        return;
    }

    // Count events by type
    const stats = {
        total: feedEvents.length,
        manual_feed: 0,
        consumption: 0,
        refill: 0,
        scheduled_feed: 0
    };

    feedEvents.forEach(event => {
        const eventType = event.event_type || 'unknown';
        if (stats.hasOwnProperty(eventType)) {
            stats[eventType]++;
        }
    });

    const totalEventsCount = document.getElementById('totalEventsCount');
    const manualFeedCount = document.getElementById('manualFeedCount');
    const consumptionCount = document.getElementById('consumptionCount');
    const refillCount = document.getElementById('refillCount');

    if (totalEventsCount) totalEventsCount.textContent = stats.total;
    if (manualFeedCount) manualFeedCount.textContent = stats.manual_feed + (stats.scheduled_feed || 0);
    if (consumptionCount) consumptionCount.textContent = stats.consumption;
    if (refillCount) refillCount.textContent = stats.refill;
}

function renderWeightChart(feedEvents, timeRange, actualEventsInRange = null) {
    // Only count events actually in the time range for statistics
    const eventsForStats = actualEventsInRange !== null ? actualEventsInRange : feedEvents.length;
    updateEventStatistics(feedEvents, eventsForStats);

    if (typeof Chart === 'undefined') {
        showModal('Chart Error', 'Chart.js library failed to load. Please refresh the page.');
        return;
    }

    const canvas = document.getElementById('weightChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Filter for completed events with weight data
    const eventsWithWeight = feedEvents.filter(event => {
        return event.status === 'completed' &&
               event.weight_after_g !== null &&
               event.weight_after_g !== undefined;
    });

    // Sort by timestamp
    eventsWithWeight.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const rangeStart = new Date(timeRange.start);
    const rangeEnd = new Date(timeRange.end);

    // Separate events: before range and within range
    const eventsBefore = eventsWithWeight.filter(e => new Date(e.timestamp) < rangeStart);
    const eventsInRange = eventsWithWeight.filter(e => {
        const t = new Date(e.timestamp);
        return t >= rangeStart && t <= rangeEnd;
    });

    // Get the most recent event before range (for baseline weight)
    const lastBeforeEvent = eventsBefore.length > 0 ? eventsBefore[eventsBefore.length - 1] : null;

    // Build data points
    const dataPoints = [];

    // If we have a baseline from before the range, start the line at range start with that weight
    if (lastBeforeEvent) {
        dataPoints.push({
            x: rangeStart,
            y: lastBeforeEvent.weight_after_g,
            eventType: 'baseline',
            status: 'projected',
            isSynthetic: true
        });
    }

    // Add all events within range
    eventsInRange.forEach(event => {
        dataPoints.push({
            x: new Date(event.timestamp),
            y: event.weight_after_g,
            eventType: event.event_type,
            status: event.status
        });
    });

    // Extend line to range end with last known weight
    if (dataPoints.length > 0) {
        const lastPoint = dataPoints[dataPoints.length - 1];
        if (lastPoint.x < rangeEnd) {
            dataPoints.push({
                x: rangeEnd,
                y: lastPoint.y,
                eventType: 'current',
                status: 'projected',
                isSynthetic: true
            });
        }
    }

    // Get theme colors
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)';
    const textColor = isDark ? 'rgba(156, 163, 175, 1)' : 'rgba(75, 85, 99, 1)';
    const lineColor = isDark ? 'rgba(99, 102, 241, 1)' : 'rgba(79, 70, 229, 1)';

    // Destroy existing chart
    if (weightChart) {
        weightChart.destroy();
    }

    // Create new chart
    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Food Weight (g)',
                data: dataPoints,
                borderColor: lineColor,
                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(79, 70, 229, 0.1)',
                borderWidth: 2,
                fill: true,
                stepped: 'after',  // Stepped line chart - weight changes are instantaneous
                tension: 0,  // No curve - straight lines
                pointRadius: dataPoints.map(p => p.isSynthetic ? 3 : 5),
                pointHoverRadius: dataPoints.map(p => p.isSynthetic ? 5 : 7),
                pointBackgroundColor: dataPoints.map(p => p.isSynthetic ? (isDark ? 'rgba(99, 102, 241, 0.5)' : 'rgba(79, 70, 229, 0.5)') : lineColor),
                pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                pointBorderWidth: dataPoints.map(p => p.isSynthetic ? 1 : 2),
                pointStyle: dataPoints.map(p => p.isSynthetic ? 'rectRot' : 'circle')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: textColor,
                        font: {
                            family: 'Inter',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    titleColor: isDark ? '#f9fafb' : '#111827',
                    bodyColor: isDark ? '#d1d5db' : '#374151',
                    borderColor: isDark ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 0.8)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        title: function(context) {
                            const date = new Date(context[0].parsed.x);
                            return formatTimestamp(date.toISOString());
                        },
                        label: function(context) {
                            const point = context.raw;
                            if (point.isSynthetic) {
                                return [
                                    `Weight: ${point.y.toFixed(1)}g`,
                                    `(Current projected weight)`
                                ];
                            }
                            return [
                                `Weight: ${point.y.toFixed(1)}g`,
                                `Event: ${point.eventType || 'N/A'}`,
                                `Status: ${point.status || 'N/A'}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    min: new Date(timeRange.start),
                    max: new Date(timeRange.end),
                    time: {
                        displayFormats: {
                            hour: 'MMM d, HH:mm',
                            day: 'MMM d',
                            week: 'MMM d',
                            month: 'MMM yyyy'
                        }
                    },
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time',
                        color: textColor,
                        font: {
                            family: 'Inter',
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            family: 'Inter',
                            size: 11
                        },
                        callback: function(value) {
                            return value + 'g';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Weight (grams)',
                        color: textColor,
                        font: {
                            family: 'Inter',
                            size: 12,
                            weight: '500'
                        }
                    }
                }
            }
        }
    });
}

// Event listeners for view controls
viewTypeSelect.addEventListener('change', (e) => {
    switchView(e.target.value);
});

prevViewButton.addEventListener('click', () => {
    switchView(currentView === 'table' ? 'chart' : 'table');
});

nextViewButton.addEventListener('click', () => {
    switchView(currentView === 'table' ? 'chart' : 'table');
});

// Quick time range dropdown
quickTimeRange.addEventListener('change', (e) => {
    currentTimeInterval = e.target.value;
    loadChartData(currentTimeInterval);

    // Hide custom range when switching to quick range
    customRangeContainer.classList.add('hidden');
});

// Toggle custom range visibility
toggleCustomRange.addEventListener('click', () => {
    customRangeContainer.classList.toggle('hidden');
});

// Custom time range
applyCustomRange.addEventListener('click', () => {
    const startValue = customStartTime.value;
    const endValue = customEndTime.value;

    if (!startValue || !endValue) {
        showModal('Invalid Range', 'Please select both start and end times.');
        return;
    }

    const start = new Date(startValue);
    const end = new Date(endValue);

    if (start >= end) {
        showModal('Invalid Range', 'Start time must be before end time.');
        return;
    }

    // Reset dropdown to default (24h) since we're using custom range
    quickTimeRange.value = '24h';
    currentTimeInterval = '24h';

    loadChartData(null, {
        start: start.toISOString(),
        end: end.toISOString()
    });
});

// Initial load logic
document.addEventListener('DOMContentLoaded', async () => {
    initializeTheme();

    // Setup focus trap for modal accessibility
    FocusTrap.setupAutoTrap('messageModal');

    const authInitialized = await auth.initAuth();
    if (!authInitialized) {
        return;
    }

    const session = await auth.getCurrentSession();
    currentUserName = session?.email || "Guest";

    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl || apiBaseUrl.includes('PLACEHOLDER')) {
        deviceStatusElement.textContent = "Not Configured";
        statusMessageElement.textContent = "API endpoint not configured";
        if (durationDisplay) durationDisplay.textContent = "Error";
        if (weightThresholdDisplay) weightThresholdDisplay.textContent = "Error";
        clearElement(eventsContainer);
        eventsContainer.appendChild(createTableErrorRow('API endpoint not configured', 4));
        return;
    }

    try {
        await Promise.all([
            fetchServoDuration(),
            fetchWeightThreshold(),
            fetchEmailConfig(),
            fetchFeedHistory(1),
            getCachedStatus()
        ]);
    } catch (error) {
        if (window.ErrorHandler) {
            window.ErrorHandler.handle(error, 'initialLoad');
        }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();
});