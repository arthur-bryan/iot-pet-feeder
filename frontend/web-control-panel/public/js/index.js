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
const userNameDisplay = document.getElementById('userNameDisplay');
const themeToggleButton = document.getElementById('themeToggleButton');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
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
        // Restart intervals
        startPolling();
    }
}

function startPolling() {
    // Clear any existing intervals first
    if (statusPollingInterval) clearInterval(statusPollingInterval);
    if (historyPollingInterval) clearInterval(historyPollingInterval);

    console.log("⏰ Starting optimized polling intervals");
    console.log("   - Device status: every 10 seconds (reduced from 5s)");
    console.log("   - Feed history: every 60 seconds (reduced from 30s)");
    console.log("   - Polling stops when tab is hidden to save costs");

    // Device status: every 10 seconds (reduced from 5)
    // This matches better with ESP32 15-min updates
    statusPollingInterval = setInterval(() => {
        if (isPageVisible) {
            console.log("Auto-refresh: Updating device status...");
            updateDeviceStatus();
        }
    }, 10000);

    // Feed history: every 60 seconds (reduced from 30)
    // History doesn't change frequently, so less polling is fine
    historyPollingInterval = setInterval(() => {
        if (isPageVisible) {
            console.log("Auto-refresh: Fetching feed history...");
            fetchFeedHistory(currentPage);
        }
    }, 60000);
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

function formatTimestamp(isoString) {
    try {
        const date = new Date(isoString);
        const options = {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        };
        return date.toLocaleString(undefined, options);
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

        setTimeout(() => {
            fetchFeedHistory(1);
        }, 1500);

        let pollCount = 0;
        const maxPolls = 5;
        const pollIntervalMs = 1000;

        if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
        }

        statusPollingInterval = setInterval(() => {
            if (pollCount < maxPolls) {
                console.log(`Polling status... (${pollCount + 1}/${maxPolls})`);
                updateDeviceStatus();
                pollCount++;
            } else {
                clearInterval(statusPollingInterval);
                statusPollingInterval = null;
                console.log("Status polling finished.");
            }
        }, pollIntervalMs);

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
    eventsContainer.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500" id="loadingEvents">Loading feeding history...</td></tr>`;
    pageInfo.textContent = `Loading...`;
    prevPageButton.disabled = true;
    nextPageButton.disabled = true;

    try {
        console.log(`Fetching feed history from: ${API_BASE_URL}/api/v1/feed_history/?page=${page}&limit=${ITEMS_PER_PAGE}`);
        const response = await fetch(`${API_BASE_URL}/api/v1/feed_history/?page=${page}&limit=${ITEMS_PER_PAGE}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("HTTP error fetching history:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log("Feed history received:", data);

        eventsContainer.innerHTML = '';

        if (data.items && data.items.length > 0) {
            data.items.forEach(event => {
                const row = document.createElement('tr');
                row.className = 'history-item';

                row.innerHTML = `
                    <td data-label="Timestamp">${formatTimestamp(event.timestamp)}</td>
                    <td data-label="Trigger">${event.requested_by || 'N/A'}</td>
                    <td data-label="Mode">${event.mode || 'N/A'}</td>
                    <td data-label="Status" class="${getStatusClass(event.status)}">${event.status.toUpperCase() || 'N/A'}</td>
                `;
                eventsContainer.appendChild(row);
            });

            totalPages = data.total_pages;
            currentPage = data.page;
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

            prevPageButton.disabled = currentPage === 1;
            nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
        } else {
            eventsContainer.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">No feeding events found.</td></tr>`;
            pageInfo.textContent = `Page 0 of 0`;
        }

    } catch (error) {
        console.error("Error fetching feed history:", error);
        eventsContainer.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-red-600">Error loading history: ${error.message}</td></tr>`;
        pageInfo.textContent = `Error`;
    }
}

// Function to request real-time device status from ESP32
async function requestRealtimeStatus() {
    try {
        console.log(`Requesting real-time status from: ${API_BASE_URL}/status/request`);

        const response = await fetch(`${API_BASE_URL}/status/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Real-time status request failed:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Real-time status response:", data);

        if (data.status) {
            updateStatusUI(data.status);
            return data.status;
        } else {
            console.warn("Device may be offline - no status received");
            // Try to get cached status as fallback
            return await getCachedStatus();
        }
    } catch (error) {
        console.error("Error requesting real-time status:", error);
        // Fallback to cached status
        return await getCachedStatus();
    }
}

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

// --- Authentication & Session Management ---

async function handleLogout() {
    try {
        // Ensure Amplify is defined before calling its methods
        if (typeof Amplify === 'undefined' || !Amplify.Auth) {
            console.error("Amplify or Amplify.Auth is not defined when handleLogout is called.");
            showModal('Logout Error', 'Amplify library not fully loaded. Please try again.');
            return;
        }
        await Amplify.Auth.signOut();
        sessionStorage.removeItem('authenticatedUserEmail');
        sessionStorage.removeItem('guestUserName');
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Error during logout:", error);
        showModal('Logout Error', `Failed to log out: ${error.message}`);
    }
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
    }
});

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
    console.log("🔄 Manual refresh triggered - requesting real-time data...");

    // Disable button during refresh
    refreshButton.disabled = true;
    const originalText = refreshButton.innerHTML;
    refreshButton.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Refreshing...
    `;

    try {
        // Fetch all data in parallel
        // Use requestRealtimeStatus() instead of updateDeviceStatus() for real-time data
        await Promise.all([
            fetchServoDuration(),
            fetchWeightThreshold(),
            fetchFeedHistory(1),
            requestRealtimeStatus()
        ]);
        console.log("✅ Manual refresh completed successfully!");
    } catch (error) {
        console.error("❌ Error during manual refresh:", error);
    } finally {
        // Re-enable button and restore original text
        refreshButton.disabled = false;
        refreshButton.innerHTML = originalText;
    }
});
closeModalButton.addEventListener('click', hideModal);
themeToggleButton.addEventListener('click', toggleTheme);

// Initial load logic for index.html
document.addEventListener('DOMContentLoaded', async () => {
    console.log("=== DOMContentLoaded event fired ===");

    // Initialize theme icons on page load
    initializeTheme();

    // Check if Amplify is loaded
    if (typeof Amplify === 'undefined') {
        console.warn("Amplify library not loaded yet, waiting...");
        // Wait a bit for Amplify to load
        await new Promise(resolve => setTimeout(resolve, 500));

        if (typeof Amplify === 'undefined') {
            console.error("Amplify library failed to load. Continuing without authentication...");
        }
    }

    // Define amplifyConfig here, within DOMContentLoaded, to ensure window.ENV is available
    const amplifyConfig = {
        Auth: {
            Cognito: {
                userPoolId: window.ENV?.VITE_USER_POOL_ID,
                userPoolClientId: window.ENV?.VITE_USER_POOL_CLIENT_ID,
                region: window.ENV?.VITE_REGION,
                identityProviders: {
                    google: {
                        clientId: window.ENV?.VITE_GOOGLE_CLIENT_ID,
                        scopes: ['email', 'profile', 'openid']
                    }
                },
                loginWith: {
                    oauth: {
                        domain: `${window.ENV?.VITE_USER_POOL_DOMAIN}.auth.${window.ENV?.VITE_REGION}.amazoncognito.com`,
                        redirectSignIn: `${window.location.origin}/`,
                        redirectSignOut: `${window.location.origin}/`,
                        responseType: 'code'
                    }
                }
            }
        }
    };

    // Configure Amplify here, after the library is loaded and DOM is ready
    if (typeof Amplify !== 'undefined') {
        Amplify.configure(amplifyConfig);
        console.log("Amplify configured from index.js DOMContentLoaded.");
    }

    let userLoggedIn = false;

    // 1. Try to get current Amplify authenticated user
    if (typeof Amplify !== 'undefined' && Amplify.Auth) {
        try {
            console.log("Checking for Amplify authenticated user...");
            const user = await Amplify.Auth.getCurrentUser();
            if (user) {
                console.log("Amplify authenticated user found:", user);
                currentUserName = user.signInDetails.loginId || user.username || user.attributes.email || "Authenticated User";
                sessionStorage.setItem('authenticatedUserEmail', currentUserName);
                sessionStorage.removeItem('guestUserName');
                userNameDisplay.textContent = `Welcome, ${currentUserName}!`;
                userLoggedIn = true;
            }
        } catch (error) {
            console.log("No Amplify authenticated session found or error:", error);
        }
    } else {
        console.log("Amplify not available, skipping authentication check.");
    }

    // 2. If no Amplify user, check for guest session
    if (!userLoggedIn) {
        const storedGuestName = sessionStorage.getItem('guestUserName');
        if (storedGuestName) {
            console.log("Guest session found:", storedGuestName);
            currentUserName = storedGuestName;
            userNameDisplay.textContent = `Welcome, ${currentUserName}!`;
            userLoggedIn = true;
        }
    }

    // 3. If no user session, allow access as Guest (authentication disabled)
    if (!userLoggedIn) {
        console.log("No user session found. Allowing access as Guest (authentication disabled).");
        currentUserName = "Guest";
        userNameDisplay.textContent = `Welcome, ${currentUserName}!`;
        userLoggedIn = true;
    }

    // If a user is logged in (or accessing as guest), load app content
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
    console.log("Calling Promise.all with 4 API functions...");

    try {
        await Promise.all([
            fetchServoDuration(),
            fetchWeightThreshold(),
            fetchFeedHistory(1),
            requestRealtimeStatus()  // Request real-time status on initial load
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
    console.log("💡 Cost optimization active:");
    console.log("   - Polling pauses when tab is hidden");
    console.log("   - Device status: 10s intervals (360 req/hr vs old 720)");
    console.log("   - Feed history: 60s intervals (60 req/hr vs old 120)");
    console.log("   - Total: ~420 req/hr per active user (50% reduction!)");
});