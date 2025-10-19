// public/js/index.js

// API_BASE_URL will now be read from window.ENV
const API_BASE_URL = window.ENV?.VITE_API_BASE_URL;

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
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const settingsToggleButton = document.getElementById('settingsToggleButton');
const settingsDropdown = document.getElementById('settingsDropdown');
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
const timezoneDisplay = document.getElementById('timezoneDisplay');
const timezoneSelect = document.getElementById('timezoneSelect');
const editTimezoneButton = document.getElementById('editTimezoneButton');
const saveTimezoneButton = document.getElementById('saveTimezoneButton');
const cancelTimezoneButton = document.getElementById('cancelTimezoneButton');
const emailNotificationsToggle = document.getElementById('emailNotificationsToggle');
const emailDisplay = document.getElementById('emailDisplay');
const emailInput = document.getElementById('emailInput');
const editEmailButton = document.getElementById('editEmailButton');
const saveEmailButton = document.getElementById('saveEmailButton');
const cancelEmailButton = document.getElementById('cancelEmailButton');
const deleteAllEventsButton = document.getElementById('deleteAllEventsButton');
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
let aggressivePollingActive = false; // Track if we're in aggressive polling mode

// --- Helper Functions ---

// Handle page visibility changes to stop/start polling
function handleVisibilityChange() {
    if (document.hidden) {
        console.log("📴 Page hidden - stopping auto-refresh to save costs");
        isPageVisible = false;
        if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
            statusPollingInterval = null;
        }
        if (historyPollingInterval) {
            clearInterval(historyPollingInterval);
            historyPollingInterval = null;
        }
    } else {
        console.log("👁️ Page visible - resuming auto-refresh");
        isPageVisible = true;
        // Immediately fetch fresh data
        updateDeviceStatus();
        fetchFeedHistory(currentPage);

        // Also refresh chart if we're in chart view
        if (currentView === 'chart') {
            loadChartData(currentTimeInterval);
        }

        // Restart intervals
        startPolling();
    }
}

function startPolling() {
    // Clear any existing intervals first
    if (statusPollingInterval) clearInterval(statusPollingInterval);
    if (historyPollingInterval) clearInterval(historyPollingInterval);

    console.log("⏰ Starting event-driven polling strategy");
    console.log("   - Device status: every 3 seconds (real-time feel)");
    console.log("   - Feed history + Chart: every 10 seconds (catch consumption/refill events)");
    console.log("   - Aggressive mode: 1s polling after user actions");
    console.log("   - Polling stops when tab is hidden to save costs");

    // Device status: every 3 seconds for near real-time updates
    // ESP32 now publishes on events (weight changes, servo state, etc.)
    statusPollingInterval = setInterval(() => {
        if (isPageVisible && !aggressivePollingActive) {
            console.log("Auto-refresh: Updating device status...");
            updateDeviceStatus();
        }
    }, 3000);

    // Feed history + Chart: every 10 seconds to catch consumption/refill events faster
    historyPollingInterval = setInterval(() => {
        if (isPageVisible && !aggressivePollingActive) {
            console.log("Auto-refresh: Fetching feed history...");
            fetchFeedHistory(currentPage);

            // Also refresh chart if we're in chart view
            if (currentView === 'chart') {
                console.log("Auto-refresh: Refreshing chart...");
                loadChartData(currentTimeInterval);
            }
        }
    }, 10000);
}

// Start aggressive polling after user actions (feed button, config changes)
function startAggressivePolling(durationSeconds = 15) {
    console.log(`🚀 Starting aggressive polling for ${durationSeconds} seconds`);
    aggressivePollingActive = true;

    // Clear existing intervals
    if (statusPollingInterval) clearInterval(statusPollingInterval);
    if (historyPollingInterval) clearInterval(historyPollingInterval);

    let pollCount = 0;
    const maxPolls = durationSeconds;

    // Poll every 1 second for near-instant updates
    statusPollingInterval = setInterval(() => {
        if (pollCount < maxPolls && isPageVisible) {
            console.log(`Aggressive poll ${pollCount + 1}/${maxPolls}`);
            updateDeviceStatus();
            pollCount++;
        } else {
            console.log("✅ Aggressive polling complete, returning to normal");
            aggressivePollingActive = false;
            startPolling(); // Return to normal polling
        }
    }, 1000);

    // Also poll history and chart at 5s intervals during aggressive mode
    historyPollingInterval = setInterval(() => {
        if (pollCount < maxPolls && isPageVisible) {
            fetchFeedHistory(currentPage);

            // Also refresh chart if we're in chart view
            if (currentView === 'chart') {
                loadChartData(currentTimeInterval);
            }
        }
    }, 5000);
}

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    if (newTheme === 'dark') {
        html.classList.add('dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        html.classList.remove('dark');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }

    localStorage.setItem('theme', newTheme);
    console.log(`Theme changed to: ${newTheme}`);
}

function toggleSettingsDropdown() {
    settingsDropdown.classList.toggle('hidden');
}

function closeSettingsDropdown(event) {
    if (!settingsToggleButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
        settingsDropdown.classList.add('hidden');
    }
}

function initializeTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    const html = document.documentElement;

    if (theme === 'dark') {
        html.classList.add('dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        html.classList.remove('dark');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
    console.log(`Theme initialized: ${theme}`);
}

function initializeTimezonePicker() {
    // Populate timezone select with options from COMMON_TIMEZONES (defined in timezone-utils.js)
    timezoneSelect.innerHTML = '';
    COMMON_TIMEZONES.forEach(tz => {
        const option = document.createElement('option');
        option.value = tz.value;
        option.textContent = tz.label;
        timezoneSelect.appendChild(option);
    });

    // Set current timezone
    const currentTz = getUserTimezone();
    timezoneSelect.value = currentTz;
    timezoneDisplay.textContent = getTimezoneDisplay();

    console.log(`Timezone picker initialized: ${currentTz}`);
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

function toggleTimezoneEditMode(isEditing) {
    if (isEditing) {
        timezoneDisplay.classList.add('hidden');
        timezoneSelect.classList.remove('hidden');
        editTimezoneButton.classList.add('hidden');
        saveTimezoneButton.classList.remove('hidden');
        cancelTimezoneButton.classList.remove('hidden');
        timezoneSelect.focus();
    } else {
        timezoneDisplay.classList.remove('hidden');
        timezoneSelect.classList.add('hidden');
        editTimezoneButton.classList.remove('hidden');
        saveTimezoneButton.classList.add('hidden');
        cancelTimezoneButton.classList.add('hidden');
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
        console.error("Error formatting timestamp:", isoString, e);
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
        'manual_feed': { icon: '🍽️', label: 'Manual Feed', color: 'text-blue-600 dark:text-blue-400' },
        'consumption': { icon: '🐾', label: 'Pet Ate', color: 'text-green-600 dark:text-green-400' },
        'refill': { icon: '🔄', label: 'Refilled', color: 'text-purple-600 dark:text-purple-400' },
        'scheduled_feed': { icon: '⏰', label: 'Scheduled', color: 'text-orange-600 dark:text-orange-400' }
    };

    const type = types[eventType] || { icon: '❓', label: eventType || 'Unknown', color: 'text-gray-600 dark:text-gray-400' };
    return `<span class="${type.color} flex items-center gap-1"><span>${type.icon}</span><span class="font-medium">${type.label}</span></span>`;
}

function formatWeightChange(weightBefore, weightAfter, weightDelta) {
    // If no weight data available
    if (weightBefore === undefined || weightBefore === null || weightAfter === undefined || weightAfter === null) {
        return '<span class="text-gray-400 dark:text-gray-500 text-xs">No data</span>';
    }

    // Calculate delta if not provided
    const delta = weightDelta !== undefined && weightDelta !== null ? weightDelta : (weightAfter - weightBefore);
    const deltaAbs = Math.abs(delta);

    // Determine color and icon based on change
    let icon = '';
    let colorClass = '';

    if (delta > 0) {
        // Weight increased (refill)
        icon = '⬆️';
        colorClass = 'text-green-600 dark:text-green-400';
    } else if (delta < 0) {
        // Weight decreased (consumption)
        icon = '⬇️';
        colorClass = 'text-red-600 dark:text-red-400';
    } else {
        // No change
        icon = '➖';
        colorClass = 'text-gray-400 dark:text-gray-500';
    }

    return `
        <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-1 ${colorClass}">
                <span>${icon}</span>
                <span class="font-semibold">${delta > 0 ? '+' : ''}${delta.toFixed(1)}g</span>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
                ${weightBefore.toFixed(1)}g → ${weightAfter.toFixed(1)}g
            </div>
        </div>
    `;
}

/**
 * Shows a custom modal with a given title and message.
 * @param {string} title The title of the modal.
 * @param {string} message The message content of the modal.
 */
function showModal(title, message) {
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
        console.log(`Fetching servo duration from: ${API_BASE_URL}/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS`);
        const response = await fetch(`${API_BASE_URL}/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Servo duration fetch failed:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        const duration = data.value || 'N/A';
        durationDisplay.textContent = duration;
        durationInput.value = duration;
        console.log("Fetched servo duration:", duration);
    } catch (error) {
        console.error("Error fetching servo duration:", error);
        durationDisplay.textContent = "Error";
        throw error;
    }
}

async function fetchWeightThreshold() {
    try {
        console.log(`Fetching weight threshold from: ${API_BASE_URL}/api/v1/config/WEIGHT_THRESHOLD_G`);
        const response = await fetch(`${API_BASE_URL}/api/v1/config/WEIGHT_THRESHOLD_G`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Weight threshold fetch failed:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        const threshold = data.value || 450;
        weightThresholdDisplay.textContent = threshold;
        weightThresholdInput.value = threshold;
        console.log("Fetched weight threshold:", threshold);
    } catch (error) {
        console.error("Error fetching weight threshold:", error);
        weightThresholdDisplay.textContent = "Error";
        throw error;
    }
}

async function setServoDuration(newDuration) {
    if (isNaN(newDuration) || newDuration < 1000 || newDuration > 60000) {
        showModal('Invalid Value', 'Please enter a hold duration between 1000 ms and 60000 ms (1 to 60 seconds).');
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: newDuration, key: "SERVO_OPEN_HOLD_DURATION_MS" })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Updated servo duration:", data);
        showModal('Success', `Hold duration updated to ${data.value} ms.`);
        return true;

    } catch (error) {
        console.error("Error setting servo duration:", error);
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
        const response = await fetch(`${API_BASE_URL}/api/v1/config/WEIGHT_THRESHOLD_G`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: newThreshold, key: "WEIGHT_THRESHOLD_G" })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Updated weight threshold:", data);
        showModal('Success', `Weight threshold updated to ${data.value}g.`);
        return true;

    } catch (error) {
        console.error("Error setting weight threshold:", error);
        showModal('Error', `Failed to save threshold: ${error.message}`);
        return false;
    }
}

async function fetchEmailConfig() {
    try {
        console.log(`Fetching email config from: ${API_BASE_URL}/api/v1/config/EMAIL_NOTIFICATIONS`);
        const response = await fetch(`${API_BASE_URL}/api/v1/config/EMAIL_NOTIFICATIONS`);
        if (!response.ok) {
            if (response.status === 404) {
                // Config not set yet
                console.log("Email config not set yet");
                emailDisplay.textContent = "Not configured";
                emailNotificationsToggle.checked = false;
                return;
            }
            const errorText = await response.text();
            console.error("Email config fetch failed:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        const config = data.value ? JSON.parse(data.value) : null;
        if (config) {
            emailDisplay.textContent = config.email || "Not configured";
            emailInput.value = config.email || "";
            emailNotificationsToggle.checked = config.enabled || false;
        }
        console.log("Fetched email config:", config);
    } catch (error) {
        console.error("Error fetching email config:", error);
        emailDisplay.textContent = "Error";
        throw error;
    }
}

async function subscribeToNotifications(email) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showModal('Invalid Email', 'Please enter a valid email address.');
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/notifications/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Subscription response:", data);

        // Save subscription info to config
        const config = { email, subscription_arn: data.subscription_arn, enabled: false };
        await fetch(`${API_BASE_URL}/api/v1/config/EMAIL_NOTIFICATIONS`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: JSON.stringify(config), key: "EMAIL_NOTIFICATIONS" })
        });

        showModal('Subscription Pending', 'Please check your email and click the confirmation link from AWS SNS to activate notifications.');
        return true;

    } catch (error) {
        console.error("Error subscribing to notifications:", error);
        showModal('Error', `Failed to subscribe: ${error.message}`);
        return false;
    }
}

async function setEmailConfig(email, enabled) {
    try {
        const config = { email, enabled };
        const response = await fetch(`${API_BASE_URL}/api/v1/config/EMAIL_NOTIFICATIONS`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: JSON.stringify(config), key: "EMAIL_NOTIFICATIONS" })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Updated email config:", data);
        showModal('Success', `Email notifications ${enabled ? 'enabled' : 'disabled'}.`);
        return true;

    } catch (error) {
        console.error("Error setting email config:", error);
        showModal('Error', `Failed to save email config: ${error.message}`);
        return false;
    }
}

// Function to send feed command
async function sendFeedCommand() {
    // Check if feeder is busy before sending command
    const currentFeederStatus = deviceStatusElement.textContent.toUpperCase();
    if (currentFeederStatus === 'OPENING' || currentFeederStatus === 'OPEN' || currentFeederStatus === 'CLOSING') {
        showModal('Feeder Busy', 'The feeder is currently busy. Please wait a moment before sending another command.');
        return;
    }

    feedButton.disabled = true;
    feedMessage.textContent = "Sending feed command...";
    feedMessage.className = "text-sm text-gray-600 mt-3";

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/feed/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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

        // Start aggressive polling for 20 seconds (feed cycle duration)
        startAggressivePolling(20);

    } catch (error) {
        console.error("Error sending feed command:", error);
        feedMessage.textContent = `Failed to send command: ${error.message}`;
        feedMessage.className = "text-sm text-red-600 mt-3 font-semibold";
    } finally {
        feedButton.disabled = false;
    }
}

// Function to fetch and display feeding history
async function fetchFeedHistory(page = 1) {
    const mobileContainer = document.getElementById('eventsContainer');
    const desktopContainer = document.getElementById('eventsContainerDesktop');

    mobileContainer.innerHTML = `<div class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</div>`;
    if (desktopContainer) {
        desktopContainer.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</td></tr>`;
    }
    pageInfo.textContent = `Loading...`;
    prevPageButton.disabled = true;
    nextPageButton.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/feed_history/?page=${page}&limit=${ITEMS_PER_PAGE}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        mobileContainer.innerHTML = '';
        if (desktopContainer) desktopContainer.innerHTML = '';

        if (data.items && data.items.length > 0) {
            data.items.forEach(event => {
                // Mobile card
                const card = document.createElement('div');
                card.className = 'bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600';
                card.innerHTML = `
                    <div class="flex items-start justify-between mb-2">
                        <div class="flex-1">
                            ${getEventTypeDisplay(event.event_type)}
                        </div>
                        <span class="${getStatusClass(event.status)} px-2 py-1 rounded-full text-xs font-medium">${event.status.toUpperCase()}</span>
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        ${formatTimestamp(event.timestamp)}
                    </div>
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-gray-500 dark:text-gray-400">${event.requested_by || 'N/A'}</span>
                        ${formatWeightChange(event.weight_before_g, event.weight_after_g, event.weight_delta_g)}
                    </div>
                `;
                mobileContainer.appendChild(card);

                // Desktop row
                if (desktopContainer) {
                    const row = document.createElement('tr');
                    row.className = 'history-item';
                    row.innerHTML = `
                        <td class="py-3 text-sm text-gray-900 dark:text-gray-200">${formatTimestamp(event.timestamp)}</td>
                        <td class="py-3 text-sm">${getEventTypeDisplay(event.event_type)}</td>
                        <td class="py-3 text-sm text-gray-600 dark:text-gray-400">${event.requested_by || 'N/A'}</td>
                        <td class="py-3 text-sm">${formatWeightChange(event.weight_before_g, event.weight_after_g, event.weight_delta_g)}</td>
                        <td class="py-3 text-sm"><span class="${getStatusClass(event.status)} px-2 py-1 rounded-full text-xs font-medium">${event.status.toUpperCase()}</span></td>
                    `;
                    desktopContainer.appendChild(row);
                }
            });

            totalPages = data.total_pages;
            currentPage = data.page;
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            prevPageButton.disabled = currentPage === 1;
            nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
        } else {
            mobileContainer.innerHTML = `<div class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No feeding events found.</div>`;
            if (desktopContainer) {
                desktopContainer.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No feeding events found.</td></tr>`;
            }
            pageInfo.textContent = `Page 0 of 0`;
        }
    } catch (error) {
        console.error("Error fetching feed history:", error);
        mobileContainer.innerHTML = `<div class="py-8 text-center text-sm text-red-600 dark:text-red-400">Error: ${error.message}</div>`;
        if (desktopContainer) {
            desktopContainer.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-sm text-red-600 dark:text-red-400">Error: ${error.message}</td></tr>`;
        }
        pageInfo.textContent = `Error`;
    }
}

// [REMOVED] requestRealtimeStatus - unused endpoint causing 403 errors
// Frontend now relies on getCachedStatus which polls ESP32 shadow state every 3s

// Function to get cached device status from DynamoDB
async function getCachedStatus() {
    try {
        const timestamp = new Date().getTime();
        const url = `${API_BASE_URL}/status/?_t=${timestamp}`;
        console.log(`Fetching cached status from: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Cached status fetch failed:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log("Cached status received:", data);
        updateStatusUI(data);
        return data;
    } catch (error) {
        console.error("Error fetching cached status:", error);
        deviceStatusElement.textContent = "Error";
        statusMessageElement.textContent = `Could not fetch device status: ${error.message}`;
        currentWeightElement.textContent = "--";
        throw error;
    }
}

// Helper function to update status UI elements
function updateStatusUI(statusData) {
    console.log("Updating UI with status:", statusData);
    console.log("Current weight from API:", statusData.current_weight_g, "Type:", typeof statusData.current_weight_g);

    deviceStatusElement.textContent = statusData.feeder_state.toUpperCase();
    statusMessageElement.textContent = `Last updated: ${formatTimestamp(statusData.last_updated)}`;

    // Update current weight display
    const weight = statusData.current_weight_g || 0;
    console.log("Weight to display:", weight);
    currentWeightElement.textContent = weight.toFixed(1);
    console.log("Updated weight display to:", currentWeightElement.textContent);
}

// Function to update device status (kept for backward compatibility with auto-refresh)
async function updateDeviceStatus() {
    // For auto-refresh, use cached status to reduce costs
    return await getCachedStatus();
}

// --- Event Listeners & Initial Load ---
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
        // Config changed - poll aggressively to show immediate effect
        startAggressivePolling(10);
    }
});

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
        // Config changed - poll aggressively to show immediate effect
        startAggressivePolling(10);
    }
});

editTimezoneButton.addEventListener('click', () => {
    toggleTimezoneEditMode(true);
});

cancelTimezoneButton.addEventListener('click', () => {
    // Reset select to current timezone
    timezoneSelect.value = getUserTimezone();
    toggleTimezoneEditMode(false);
});

saveTimezoneButton.addEventListener('click', () => {
    const selectedTimezone = timezoneSelect.value;
    setUserTimezone(selectedTimezone);
    timezoneDisplay.textContent = getTimezoneDisplay();
    toggleTimezoneEditMode(false);

    // Refresh feed history to display times in new timezone
    fetchFeedHistory(currentPage);

    showModal('Success', `Timezone updated to ${selectedTimezone}. All times are now displayed in your selected timezone.`);
});

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

// Delete all events button removed - endpoint disabled for public demo

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
    console.log("🔄 Manual refresh triggered - requesting real-time data from ESP32...");

    // Disable button during refresh
    refreshButton.disabled = true;
    const originalHTML = refreshButton.innerHTML;
    refreshButton.innerHTML = `
        <svg class="w-5 h-5 text-gray-600 dark:text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
    `;

    try {
        // Request real-time status from ESP32 first
        console.log("Requesting real-time status from ESP32...");
        const statusResponse = await fetch(`${API_BASE_URL}/status/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!statusResponse.ok) {
            console.warn("Failed to request real-time status, falling back to cached");
        } else {
            const statusData = await statusResponse.json();
            console.log("Real-time status response:", statusData);
            if (statusData.status) {
                updateStatusUI(statusData.status);
            }
        }

        // Fetch all other data in parallel
        await Promise.all([
            fetchServoDuration(),
            fetchWeightThreshold(),
            fetchFeedHistory(1)
        ]);

        // Also refresh chart if we're in chart view
        if (currentView === 'chart') {
            await loadChartData(currentTimeInterval);
        }

        console.log("✅ Manual refresh completed successfully!");
    } catch (error) {
        console.error("❌ Error during manual refresh:", error);
        showModal('Refresh Error', `Failed to refresh data: ${error.message}`);
    } finally {
        // Re-enable button and restore original HTML
        refreshButton.disabled = false;
        refreshButton.innerHTML = originalHTML;
    }
});
closeModalButton.addEventListener('click', hideModal);
themeToggleButton.addEventListener('click', toggleTheme);
settingsToggleButton.addEventListener('click', toggleSettingsDropdown);

// Close dropdown when clicking outside
document.addEventListener('click', closeSettingsDropdown);

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
    console.log('=== switchView CALLED ===');
    console.log('Switching to view:', newView);
    console.log('Current view was:', currentView);

    currentView = newView;
    viewTypeSelect.value = newView;

    if (newView === 'table') {
        console.log('Switching to TABLE view');
        tableViewContainer.classList.remove('hidden');
        chartViewContainer.classList.add('hidden');
        timeRangeFilters.classList.add('hidden');
        fetchFeedHistory(currentPage);
    } else if (newView === 'chart') {
        console.log('Switching to CHART view');
        console.log('Chart container classes before:', chartViewContainer.className);
        tableViewContainer.classList.add('hidden');
        chartViewContainer.classList.remove('hidden');
        timeRangeFilters.classList.remove('hidden');
        console.log('Chart container classes after:', chartViewContainer.className);
        console.log('About to call loadChartData with interval:', currentTimeInterval);
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
    console.log('=== loadChartData CALLED ===');
    console.log('Interval:', interval, 'Custom range:', customRange);
    console.log('Chart.js available?', typeof Chart !== 'undefined');

    const chartLoadingMessage = document.getElementById('chartLoadingMessage');
    if (chartLoadingMessage) {
        chartLoadingMessage.classList.remove('hidden');
    } else {
        console.error('chartLoadingMessage element not found!');
    }

    try {
        let url, timeRange;
        if (customRange) {
            url = `${API_BASE_URL}/api/v1/feed_history/?start_time=${encodeURIComponent(customRange.start)}&end_time=${encodeURIComponent(customRange.end)}&limit=1000`;
            timeRange = customRange;
        } else {
            timeRange = getTimeRange(interval);
            url = `${API_BASE_URL}/api/v1/feed_history/?start_time=${encodeURIComponent(timeRange.start)}&end_time=${encodeURIComponent(timeRange.end)}&limit=1000`;
        }

        console.log('=== CHART DEBUG ===');
        console.log('Fetching chart data from:', url);
        console.log('Time range:', timeRange);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Chart data received - total items:', data.items ? data.items.length : 0);
        console.log('First 3 items:', data.items ? data.items.slice(0, 3) : []);

        renderWeightChart(data.items || [], timeRange);
    } catch (error) {
        console.error('Error loading chart data:', error);
        showModal('Chart Error', `Failed to load chart data: ${error.message}`);
    } finally {
        chartLoadingMessage.classList.add('hidden');
    }
}

function updateEventStatistics(feedEvents) {
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

    // Update UI elements
    const totalEventsCount = document.getElementById('totalEventsCount');
    const manualFeedCount = document.getElementById('manualFeedCount');
    const consumptionCount = document.getElementById('consumptionCount');
    const refillCount = document.getElementById('refillCount');

    if (totalEventsCount) totalEventsCount.textContent = stats.total;
    if (manualFeedCount) manualFeedCount.textContent = stats.manual_feed + (stats.scheduled_feed || 0);  // Combine manual and scheduled
    if (consumptionCount) consumptionCount.textContent = stats.consumption;
    if (refillCount) refillCount.textContent = stats.refill;

    console.log('Event statistics updated:', stats);
}

function renderWeightChart(feedEvents, timeRange) {
    console.log('=== renderWeightChart CALLED ===');
    console.log('Total feedEvents received:', feedEvents.length);
    console.log('Time range:', timeRange);

    // Update event statistics
    updateEventStatistics(feedEvents);

    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('CRITICAL ERROR: Chart.js library is not loaded! typeof Chart:', typeof Chart);
        console.error('window.Chart:', window.Chart);
        showModal('Chart Error', 'Chart.js library failed to load. Please refresh the page.');
        return;
    }
    console.log('Chart.js is loaded. Version:', Chart.version);

    const canvas = document.getElementById('weightChart');
    if (!canvas) {
        console.error('ERROR: Canvas element #weightChart not found!');
        return;
    }
    console.log('Canvas element found:', canvas);

    const ctx = canvas.getContext('2d');
    console.log('Canvas context:', ctx);

    // Filter for completed events with weight data
    const eventsWithWeight = feedEvents.filter(event => {
        const isCompleted = event.status === 'completed';
        const hasWeight = event.weight_after_g !== null && event.weight_after_g !== undefined;
        if (!isCompleted || !hasWeight) {
            console.log('Filtered out event:', {
                feed_id: event.feed_id,
                status: event.status,
                weight_after_g: event.weight_after_g,
                reason: !isCompleted ? 'not completed' : 'no weight data'
            });
        }
        return isCompleted && hasWeight;
    });

    console.log('After filtering: ' + eventsWithWeight.length + ' events with weight data');
    console.log('Filtered events:', eventsWithWeight);

    // Sort by timestamp
    eventsWithWeight.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Include boundary points: find one event before and one after the time range
    // This ensures the chart lines extend to the edges properly without being cut off
    const rangeStart = new Date(timeRange.start);
    const rangeEnd = new Date(timeRange.end);

    // Find the last event before the range starts
    let beforeEvent = null;
    for (let i = eventsWithWeight.length - 1; i >= 0; i--) {
        if (new Date(eventsWithWeight[i].timestamp) < rangeStart) {
            beforeEvent = eventsWithWeight[i];
            break;
        }
    }

    // Find the first event after the range ends
    let afterEvent = null;
    for (let i = 0; i < eventsWithWeight.length; i++) {
        if (new Date(eventsWithWeight[i].timestamp) > rangeEnd) {
            afterEvent = eventsWithWeight[i];
            break;
        }
    }

    // Filter events within range and add boundary points
    let eventsToDisplay = eventsWithWeight.filter(event => {
        const eventTime = new Date(event.timestamp);
        return eventTime >= rangeStart && eventTime <= rangeEnd;
    });

    // Add boundary points if they exist
    if (beforeEvent) {
        eventsToDisplay = [beforeEvent, ...eventsToDisplay];
        console.log('Added boundary point before range:', beforeEvent.timestamp);
    }
    if (afterEvent) {
        eventsToDisplay = [...eventsToDisplay, afterEvent];
        console.log('Added boundary point after range:', afterEvent.timestamp);
    }

    console.log('Events to display (with boundaries):', eventsToDisplay.length);

    // Prepare data points from the filtered events (including boundary points)
    const dataPoints = eventsToDisplay.map(event => ({
        x: new Date(event.timestamp),
        y: event.weight_after_g,
        eventType: event.event_type,
        status: event.status
    }));

    console.log('Data points prepared:', dataPoints.length);
    console.log('First 3 data points:', dataPoints.slice(0, 3));
    console.log('Last 3 data points:', dataPoints.slice(-3));

    // Get theme colors
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)';
    const textColor = isDark ? 'rgba(156, 163, 175, 1)' : 'rgba(75, 85, 99, 1)';
    const lineColor = isDark ? 'rgba(99, 102, 241, 1)' : 'rgba(79, 70, 229, 1)';

    console.log('Theme colors - isDark:', isDark, 'lineColor:', lineColor);

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
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: lineColor,
                pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                pointBorderWidth: 2
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

    console.log(`✅ Chart creation complete! Data points: ${dataPoints.length}`);
    console.log('Chart object:', weightChart);
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

// Update chart theme when theme changes
const originalToggleTheme = toggleTheme;
toggleTheme = function() {
    originalToggleTheme();
    // Re-render chart if in chart view to update colors
    if (currentView === 'chart' && weightChart) {
        loadChartData(currentTimeInterval);
    }
};

// Initial load logic for index.html
document.addEventListener('DOMContentLoaded', async () => {
    console.log("=== DOMContentLoaded event fired ===");

    // Initialize theme icons on page load
    initializeTheme();

    // Initialize timezone picker
    initializeTimezonePicker();

    // Authentication disabled - all users access as Guest
    console.log("Authentication disabled. All users access as Guest.");
    let userLoggedIn = true;
    currentUserName = "Guest";

    console.log(`User "${currentUserName}" is accessing the app. Loading app content.`);
    console.log("window.ENV:", window.ENV);
    console.log("API_BASE_URL value:", API_BASE_URL);

    // Validate API_BASE_URL is available and not a placeholder
    if (!API_BASE_URL || API_BASE_URL.includes('PLACEHOLDER')) {
        console.error("❌ API_BASE_URL is not configured properly. Current value:", API_BASE_URL);
        console.error("To fix this: Update /frontend/web-control-panel/public/env-config.js with your actual API Gateway URL");
        console.error("You can find the API URL by running: terraform output api_gateway_invoke_url");

        // Show error in UI elements instead of modal
        deviceStatusElement.textContent = "Not Configured";
        statusMessageElement.textContent = "API endpoint not configured in env-config.js";
        durationDisplay.textContent = "Error";
        weightThresholdDisplay.textContent = "Error";
        eventsContainer.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-red-600">API endpoint not configured. Please update env-config.js with your API Gateway URL.</td></tr>`;

        console.log("Stopping here - cannot load data without API URL");
        return;
    }

    console.log("✅ API_BASE_URL validated:", API_BASE_URL);

    // Initial load - await all API calls to ensure data loads
    console.log("🚀 Starting initial data load with real-time status...");
    console.log("Calling Promise.all with 5 API functions...");

    try {
        await Promise.all([
            fetchServoDuration(),
            fetchWeightThreshold(),
            fetchEmailConfig(),
            fetchFeedHistory(1),
            getCachedStatus()
        ]);
        console.log("✅ Initial data loaded successfully!");
    } catch (error) {
        console.error("❌ Error loading initial data:", error);
        console.error("Stack trace:", error.stack);
        // Don't show modal, errors are already displayed in individual components
        console.error("Failed to load some or all initial data. Check the errors above for details.");
    }

    console.log("Setting up optimized polling strategy...");

    // Set up page visibility detection to stop polling when tab is hidden
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start polling intervals with optimized timing
    startPolling();

    console.log("✅ Page initialization complete!");
    console.log("💡 Event-driven polling strategy active:");
    console.log("   - Polling pauses when tab is hidden");
    console.log("   - Device status: 3s intervals for real-time feel (1200 req/hr base)");
    console.log("   - Aggressive mode: 1s polling for 15-20s after actions");
    console.log("   - Feed history + Chart: 10s intervals (360 req/hr)");
    console.log("   - Chart auto-refreshes when in chart view");
    console.log("   - ESP32 publishes events (consumption, refill, manual_feed)");
    console.log("   - Total: ~1560 req/hr idle, peaks during active use");
});