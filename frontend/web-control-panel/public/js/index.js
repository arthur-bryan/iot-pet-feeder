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

// --- API and Data Functions ---
const fetchFeedHistory = async (page = 1) => {
    currentPage = page;
    eventsContainer.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-500">Loading history...</td></tr>';
    prevPageButton.disabled = true;
    nextPageButton.disabled = true;

    const limit = ITEMS_PER_PAGE;
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    try {
        const url = `${API_BASE_URL}${API_V1_PATH}/feed_history/?page=${currentPage}&limit=${limit}`;
        // Removed custom headers
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("Feeder history not found. The API may not be deployed or the path is incorrect.");
            } else if (response.status === 401) {
                throw new Error("Unauthorized. Please log in again.");
            }
            throw new Error(`Error fetching history: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();

        // Clear previous entries
        eventsContainer.innerHTML = '';
        if (data.events && data.events.length > 0) {
            data.events.forEach(event => {
                const row = document.createElement('tr');
                row.className = "hover:bg-gray-100";
                row.innerHTML = `
                    <td class="py-3 px-5 text-sm text-gray-700">${formatTimestamp(event.timestamp)}</td>
                    <td class="py-3 px-5 text-sm font-medium text-gray-900">${event.trigger_method}</td>
                    <td class="py-3 px-5 text-sm text-gray-500">${event.status || 'Success'}</td>
                `;
                eventsContainer.appendChild(row);
            });
        } else {
            eventsContainer.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-500">No feeding events recorded.</td></tr>';
        }

        // Update pagination
        const totalItems = data.total_count || 0;
        totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageButton.disabled = currentPage <= 1;
        nextPageButton.disabled = currentPage >= totalPages;

    } catch (error) {
        console.error('Failed to fetch feeding history:', error);
        eventsContainer.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-red-500">Error: ${error.message}</td></tr>`;
        showModal('API Error', `Failed to load feeding history: ${error.message}`);
    }
};

const updateDeviceStatus = async () => {
    try {
        const url = `${API_BASE_URL}/status/`;
        // Removed custom headers
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                statusMessageElement.textContent = "Feeder not found. Please check your setup.";
                setStatusDisplay('red', 'Error');
                return;
            }
            throw new Error(`Error fetching status: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        statusMessageElement.textContent = `Status: ${data.feeder_state} | Network: ${data.network_status}`;
        setStatusDisplay('green', 'Online');

    } catch (error) {
        console.error('Failed to fetch device status:', error);
        statusMessageElement.textContent = "Could not connect to device.";
        setStatusDisplay('red', 'Offline');
    }
};

const sendFeedCommand = async () => {
    feedButton.disabled = true;
    feedButtonText.textContent = 'Dispensing...';
    try {
        const url = `${API_BASE_URL}${API_V1_PATH}/feed/`;
        // Removed custom headers
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ "requested_by": currentUserName, "mode": "manual" })
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("API endpoint not found. The API may not be deployed or the path is incorrect.");
            } else if (response.status === 401) {
                throw new Error("Unauthorized. Please log in again.");
            }
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        showModal('Command Sent', 'Feeding command sent successfully! The feeder will dispense food shortly.');
    } catch (error) {
        console.error('Failed to send feed command:', error);
        showModal('Error', `Failed to send feed command: ${error.message}`);
    } finally {
        feedButton.disabled = false;
        feedButtonText.textContent = 'FEED NOW';
        setTimeout(updateDeviceStatus, 2000); // Check status after a short delay
    }
};

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
