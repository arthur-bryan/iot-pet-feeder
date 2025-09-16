// Read API base URL from environment
const API_BASE_URL = window.ENV?.VITE_API_BASE_URL;
const API_V1_PATH = '/api/v1';

// --- DOM Elements ---
const feedButton = document.getElementById('feedButton');
const feedButtonText = document.getElementById('feedButtonText');
const eventsContainer = document.getElementById('eventsContainer');
const prevPageButton = document.getElementById('prevPageButton');
const nextPageButton = document.getElementById('nextPageButton');
const pageInfo = document.getElementById('pageInfo');
const deviceStatusElement = document.getElementById('deviceStatus');
const statusMessageElement = document.getElementById('statusMessage');
const refreshButton = document.getElementById('refreshButton');
const userNameDisplay = document.getElementById('userNameDisplay');
const logoutButton = document.getElementById('logoutButton');

// Modal Elements
const messageModal = document.getElementById('messageModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const closeModalButton = document.getElementById('closeModalButton');

const ITEMS_PER_PAGE = 10;
const API_TIMEOUT = 5000; // 5-second timeout for API calls
let currentPage = 1;
let totalPages = 1;
let currentUserName = 'Guest';
let statusPollingInterval = null;

// --- Modal Helpers ---
const showModal = (title, message) => {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    messageModal.classList.remove('hidden');
    closeModalButton.focus();
};

const hideModal = () => {
    modalTitle.textContent = "";
    modalMessage.textContent = "";
    messageModal.classList.add('hidden');
};

// Modal accessibility: close on Esc key
window.addEventListener('keydown', e => {
    if (!messageModal.classList.contains('hidden') && e.key === 'Escape') {
        hideModal();
    }
});
closeModalButton.addEventListener('click', hideModal);

// --- Helper Functions ---
const setStatusDisplay = (color, text) => {
    deviceStatusElement.querySelector('div').className = `w-3 h-3 rounded-full bg-${color}-500`;
    deviceStatusElement.querySelector('span').textContent = text;
};

const formatTimestamp = isoString => {
    try {
        const date = new Date(isoString);
        return date.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } catch (e) {
        console.error("Invalid date string:", isoString);
        return isoString;
    }
};

/**
 * Wraps a fetch call with a timeout.
 * @param {string} url The URL to fetch.
 * @param {object} options Fetch options.
 * @param {number} timeout The timeout in milliseconds.
 * @returns {Promise<Response>} The fetch response.
 */
const fetchWithTimeout = (url, options = {}, timeout = API_TIMEOUT) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('API request timed out')), timeout)
        )
    ]);
};

// --- API and Data Functions ---
const fetchFeedHistory = async (page = 1) => {
    eventsContainer.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500" id="loadingEvents">Loading feeding history...</td></tr>`;
    pageInfo.textContent = `Loading...`;
    prevPageButton.disabled = true;
    nextPageButton.disabled = true;
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/feed_history/?page=${page}&limit=${ITEMS_PER_PAGE}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        eventsContainer.innerHTML = '';
        // Support both 'items' and 'events' for compatibility
        const events = data.items || data.events || [];
        if (events.length > 0) {
            events.forEach(event => {
                const row = document.createElement('tr');
                row.className = 'history-item';
                row.innerHTML = `
                    <td data-label="Timestamp">${formatTimestamp(event.timestamp)}</td>
                    <td data-label="Trigger">${event.requested_by || event.trigger_method || 'N/A'}</td>
                    <td data-label="Mode">${event.mode || 'N/A'}</td>
                    <td data-label="Status" class="${getStatusClass(event.status)}">${event.status ? event.status.toUpperCase() : 'N/A'}</td>
                `;
                eventsContainer.appendChild(row);
            });
            totalPages = data.total_pages || Math.ceil((data.total_count || events.length) / ITEMS_PER_PAGE) || 1;
            currentPage = data.page || page;
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            prevPageButton.disabled = currentPage === 1;
            nextPageButton.disabled = currentPage === totalPages || totalPages === 0;
        } else {
            eventsContainer.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">No feeding events found.</td></tr>`;
            pageInfo.textContent = 'Page 0 of 0';
        }
    } catch (error) {
        console.error("Error fetching feed history:", error);
        eventsContainer.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-red-600">Error loading history: ${error.message}</td></tr>`;
        pageInfo.textContent = 'Error';
    }
};

const updateDeviceStatus = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/status/`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        deviceStatusElement.textContent = (data.feeder_state || data.status || 'Unknown').toUpperCase();
        statusMessageElement.textContent = `Last updated: ${formatTimestamp(data.last_updated || data.timestamp || new Date().toISOString())}`;
    } catch (error) {
        console.error("Error fetching device status:", error);
        deviceStatusElement.textContent = "Error";
        statusMessageElement.textContent = `Could not fetch device status: ${error.message}`;
    }
};

async function sendFeedCommand(event) {
    console.log('Feed Now button clicked');
    if (event) event.preventDefault(); // Prevent form submit if inside a form
    // Defensive: check if button is disabled
    if (feedButton.disabled) {
        console.log('Feed button is disabled, aborting.');
        return;
    }
    // Check if feeder is busy before sending command
    const currentFeederStatus = deviceStatusElement.textContent.toUpperCase();
    if (currentFeederStatus === 'OPENING' || currentFeederStatus === 'OPEN' || currentFeederStatus === 'CLOSING') {
        showModal('Feeder Busy', 'The feeder is currently busy. Please wait a moment before sending another command.');
        console.log('Feeder busy, aborting.');
        return;
    }
    feedButton.disabled = true;
    if (typeof feedButtonText !== 'undefined' && feedButtonText) {
        feedButtonText.textContent = "Dispensing...";
    }
    feedMessage.textContent = "Sending feed command...";
    feedMessage.className = "text-sm text-gray-600 mt-3";
    try {
        console.log('Sending fetch to /api/v1/feed/');
        const response = await fetch(`${API_BASE_URL}/api/v1/feed/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ "requested_by": currentUserName, "mode": "manual" })
        });
        if (!response.ok) {
            const errorText = await response.text();
            showModal('Feed Error', `HTTP error! status: ${response.status} - ${errorText}`);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        feedMessage.textContent = `Command sent! Status: ${(data.status || data.result || 'OK').toUpperCase()}`;
        feedMessage.className = "text-sm text-green-600 mt-3 font-semibold";
        showModal('Feed Command Sent', `Status: ${(data.status || data.result || 'OK').toUpperCase()}`);
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
                updateDeviceStatus();
                pollCount++;
            } else {
                clearInterval(statusPollingInterval);
                statusPollingInterval = null;
            }
        }, pollIntervalMs);
    } catch (error) {
        console.error("Error sending feed command:", error);
        feedMessage.textContent = `Failed to send command: ${error.message}`;
        feedMessage.className = "text-sm text-red-600 mt-3 font-semibold";
        showModal('Feed Error', `Failed to send command: ${error.message}`);
    } finally {
        feedButton.disabled = false;
        if (typeof feedButtonText !== 'undefined' && feedButtonText) {
            feedButtonText.textContent = "FEED NOW";
        }
    }
}

function getStatusClass(status) {
    switch (status?.toLowerCase()) {
        case 'queued': return 'status-queued';
        case 'sent': return 'status-sent';
        case 'completed': return 'status-completed';
        case 'failed': return 'status-failed';
        default: return '';
    }
}

// --- Event Handlers ---
const handleLogout = () => {
    sessionStorage.removeItem('guestUserName');
    sessionStorage.removeItem('authenticatedUserEmail');
    window.location.href = 'login.html';
};

// --- Initial Load and App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const storedGuestName = sessionStorage.getItem('guestUserName');
    const authenticatedUserEmail = sessionStorage.getItem('authenticatedUserEmail');

    if (storedGuestName) {
        currentUserName = storedGuestName;
    } else if (authenticatedUserEmail) {
        currentUserName = authenticatedUserEmail;
    } else {
        // No valid session found, redirect to login page
        window.location.href = 'login.html';
        return;
    }

    userNameDisplay.textContent = `Welcome, ${currentUserName}!`;

    // Initial data load and polling
    fetchFeedHistory(1);
    updateDeviceStatus();
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
    }
    statusPollingInterval = setInterval(updateDeviceStatus, 5000);

    // Pagination Event Listeners
    prevPageButton.addEventListener('click', () => currentPage > 1 && fetchFeedHistory(currentPage - 1));
    nextPageButton.addEventListener('click', () => currentPage < totalPages && fetchFeedHistory(currentPage + 1));

    // Main App Event Listeners
    feedButton.addEventListener('click', sendFeedCommand);
    refreshButton.addEventListener('click', () => { fetchFeedHistory(1); updateDeviceStatus(); });
    logoutButton.addEventListener('click', handleLogout);
});
