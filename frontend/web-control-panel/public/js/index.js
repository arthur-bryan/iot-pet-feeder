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
const refreshButton = document.getElementById('refreshButton');
const userNameDisplay = document.getElementById('userNameDisplay');
const logoutButton = document.getElementById('logoutButton');
// --- NEW Configuration Elements ---
const durationDisplay = document.getElementById('durationDisplay');
const durationInput = document.getElementById('durationInput');
const editDurationButton = document.getElementById('editDurationButton');
const saveDurationButton = document.getElementById('saveDurationButton');
const cancelDurationButton = document.getElementById('cancelDurationButton');
// --- END NEW Elements ---


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

// --- Helper Functions ---

function toggleDurationEditMode(isEditing) {
    if (isEditing) {
        durationDisplay.classList.add('hidden');
        durationInput.classList.remove('hidden');
        editDurationButton.classList.add('hidden');
        saveDurationButton.classList.remove('hidden');
        cancelDurationButton.classList.remove('hidden');
        durationInput.focus();
    } else {
        durationDisplay.classList.remove('hidden');
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
        durationInput.value = duration; // Also set the input value
        console.log("Fetched servo duration:", duration);
    } catch (error) {
        console.error("Error fetching servo duration:", error);
        durationDisplay.textContent = "Error";
        throw error; // Re-throw to be caught by Promise.all
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
            body: JSON.stringify({ "requested_by": currentUserName, "mode": "manual" })
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

// Function to update device status
async function updateDeviceStatus() {
    try {
        console.log(`Fetching device status from: ${API_BASE_URL}/status/`);
        const response = await fetch(`${API_BASE_URL}/status/`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Device status fetch failed:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log("Device status received:", data);
        deviceStatusElement.textContent = data.feeder_state.toUpperCase();
        statusMessageElement.textContent = `Last updated: ${formatTimestamp(data.last_updated)}`;
    } catch (error) {
        console.error("Error fetching device status:", error);
        deviceStatusElement.textContent = "Error";
        statusMessageElement.textContent = `Could not fetch device status: ${error.message}`;
        throw error; // Re-throw to be caught by Promise.all
    }
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
    // Reset input value to current displayed value on cancel
    durationInput.value = durationDisplay.textContent.replace('ms', '').trim();
    toggleDurationEditMode(false);
});


saveDurationButton.addEventListener('click', async () => {
    const newDuration = parseInt(durationInput.value, 10);
    const success = await setServoDuration(newDuration);
    if (success) {
        // Update display only after successful save
        durationDisplay.textContent = newDuration;
        toggleDurationEditMode(false);
    }
    // If not successful, modal will show error, stay in edit mode
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
refreshButton.addEventListener('click', () => {
    fetchFeedHistory(1);
    updateDeviceStatus();
});
closeModalButton.addEventListener('click', hideModal);

// Initial load logic for index.html
document.addEventListener('DOMContentLoaded', async () => {
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
    Amplify.configure(amplifyConfig);
    console.log("Amplify configured from index.js DOMContentLoaded.");

    logoutButton.addEventListener('click', () => {
        sessionStorage.removeItem('guestUserName');
        sessionStorage.removeItem('authenticatedUserEmail');
        window.location.href = 'login.html';
    }); // Attach logout listener here

    let userLoggedIn = false;

    // 1. Try to get current Amplify authenticated user
    try {
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

    // 3. If no user (Amplify or Guest), redirect to login page
    if (!userLoggedIn) {
        console.log("No user session found. Redirecting to login.html");
        window.location.href = 'login.html';
        return;
    }

    // If a user is logged in (either authenticated or guest), load app content
    console.log(`User "${currentUserName}" is logged in. Loading app content.`);

    // Validate API_BASE_URL is available
    if (!API_BASE_URL) {
        console.error("API_BASE_URL is not configured. Check env-config.js");
        showModal('Configuration Error', 'API endpoint is not configured. Please contact support.');
        return;
    }

    // Initial load - await all API calls to ensure data loads
    try {
        await Promise.all([
            fetchServoDuration(),
            fetchFeedHistory(1),
            updateDeviceStatus()
        ]);
        console.log("Initial data loaded successfully.");
    } catch (error) {
        console.error("Error loading initial data:", error);
        showModal('Error', 'Failed to load initial data. Please refresh the page.');
    }

    // Set up periodic refresh intervals
    setInterval(() => fetchFeedHistory(currentPage), 30000);
    setInterval(updateDeviceStatus, 5000);
});