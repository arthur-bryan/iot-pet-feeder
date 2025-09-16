// public/js/index.js
'use strict';

// Read API base URL from environment
const API_BASE_URL = window.ENV?.VITE_API_BASE_URL;

// --- DOM Elements ---
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
const messageModal = document.getElementById('messageModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const closeModalButton = document.getElementById('closeModalButton');

const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let totalPages = 1;
let currentUserName = 'Guest';
let statusPollingInterval = null;

// --- Helper Functions ---
const formatTimestamp = isoString => {
    try {
        const date = new Date(isoString);
        return date.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
    } catch (e) {
        console.error('Error formatting timestamp:', isoString, e);
        return isoString;
    }
};

const getStatusClass = status => {
    switch (status.toLowerCase()) {
        case 'queued': return 'status-queued';
        case 'sent': return 'status-sent';
        case 'completed': return 'status-completed';
        case 'failed': return 'status-failed';
        default: return '';
    }
};

const showModal = (title, message) => {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    messageModal.classList.remove('hidden');
    closeModalButton.focus();
};
const hideModal = () => {
    messageModal.classList.add('hidden');
};
// Modal accessibility: close on Esc key
window.addEventListener('keydown', e => {
    if (!messageModal.classList.contains('hidden') && e.key === 'Escape') {
        hideModal();
    }
});

// --- Storage Event Listener for Logout Sync ---
window.addEventListener('storage', event => {
    if ((event.key === 'authenticatedUserEmail' || event.key === 'guestUserName') && event.newValue === null) {
        window.location.href = 'login.html';
    }
});

// --- API Calls ---
const sendFeedCommand = async () => {
    const busyStates = ['OPENING', 'OPEN', 'CLOSING'];
    if (busyStates.includes(deviceStatusElement.textContent.toUpperCase())) {
        showModal('Feeder Busy', 'The feeder is currently busy. Please wait before sending another command.');
        return;
    }
    feedButton.disabled = true;
    feedMessage.textContent = 'Sending feed command...';
    feedMessage.className = 'text-sm text-gray-600 mt-3';
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/feed/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requested_by: currentUserName, mode: 'manual' })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
        const data = await response.json();
        feedMessage.textContent = `Command sent! Status: ${data.status.toUpperCase()}`;
        feedMessage.className = 'text-sm text-green-600 mt-3 font-semibold';
        setTimeout(() => fetchFeedHistory(1), 1500);
        let pollCount = 0;
        const maxPolls = 5;
        if (statusPollingInterval) clearInterval(statusPollingInterval);
        statusPollingInterval = setInterval(() => {
            if (pollCount < maxPolls) {
                updateDeviceStatus();
                pollCount++;
            } else {
                clearInterval(statusPollingInterval);
                statusPollingInterval = null;
            }
        }, 1000);
    } catch (error) {
        console.error('Error sending feed command:', error);
        feedMessage.textContent = `Failed to send command: ${error.message}`;
        feedMessage.className = 'text-sm text-red-600 mt-3 font-semibold';
    } finally {
        feedButton.disabled = false;
    }
};

const fetchFeedHistory = async (page = 1) => {
    eventsContainer.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500" id="loadingEvents">Loading feeding history...</td></tr>`;
    pageInfo.textContent = 'Loading...';
    prevPageButton.disabled = true;
    nextPageButton.disabled = true;
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/feed_history/?page=${page}&limit=${ITEMS_PER_PAGE}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
        const data = await response.json();
        eventsContainer.innerHTML = '';
        if (data.items?.length) {
            data.items.forEach(event => {
                const row = document.createElement('tr');
                row.className = 'history-item';
                row.innerHTML = `
                    <td data-label="Timestamp">${formatTimestamp(event.timestamp)}</td>
                    <td data-label="Trigger">${event.requested_by || 'N/A'}</td>
                    <td data-label="Mode">${event.mode || 'N/A'}</td>
                    <td data-label="Status" class="${getStatusClass(event.status)}">${event.status?.toUpperCase() || 'N/A'}</td>
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
            pageInfo.textContent = 'Page 0 of 0';
        }
    } catch (error) {
        console.error('Error fetching feed history:', error);
        eventsContainer.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-red-600">Error loading history: ${error.message}</td></tr>`;
        pageInfo.textContent = 'Error';
    }
};

const updateDeviceStatus = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/status/`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
        const data = await response.json();
        deviceStatusElement.textContent = data.feeder_state?.toUpperCase() || 'Unknown';
        statusMessageElement.textContent = `Last updated: ${formatTimestamp(data.last_updated)}`;
    } catch (error) {
        console.error('Error fetching device status:', error);
        deviceStatusElement.textContent = 'Error';
        statusMessageElement.textContent = `Could not fetch device status: ${error.message}`;
    }
};

const handleLogout = async () => {
    try {
        await Amplify.Auth.signOut();
        sessionStorage.removeItem('authenticatedUserEmail');
        sessionStorage.removeItem('guestUserName');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error during logout:', error);
        showModal('Logout Error', `Failed to log out: ${error.message}`);
    }
};

// --- Event Listeners ---
feedButton.addEventListener('click', sendFeedCommand);
prevPageButton.addEventListener('click', () => currentPage > 1 && fetchFeedHistory(currentPage - 1));
nextPageButton.addEventListener('click', () => currentPage < totalPages && fetchFeedHistory(currentPage + 1));
refreshButton.addEventListener('click', () => { fetchFeedHistory(1); updateDeviceStatus(); });
closeModalButton.addEventListener('click', hideModal);

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
    logoutButton.addEventListener('click', handleLogout);
    let userLoggedIn = false;
    try {
        const user = await Amplify.Auth.getCurrentUser();
        if (user) {
            currentUserName = user.signInDetails?.loginId || user.username || user.attributes?.email || 'Authenticated User';
            sessionStorage.setItem('authenticatedUserEmail', currentUserName);
            sessionStorage.removeItem('guestUserName');
            userNameDisplay.textContent = `Welcome, ${currentUserName}!`;
            userLoggedIn = true;
        }
    } catch (error) {
        console.log('No Amplify authenticated session found or error:', error);
    }
    if (!userLoggedIn) {
        const storedGuestName = sessionStorage.getItem('guestUserName');
        if (storedGuestName) {
            currentUserName = storedGuestName;
            userNameDisplay.textContent = `Welcome, ${currentUserName}!`;
            userLoggedIn = true;
        }
    }
    if (!userLoggedIn) {
        window.location.href = 'login.html';
        return;
    }
    fetchFeedHistory(1);
    updateDeviceStatus();
    setInterval(() => fetchFeedHistory(currentPage), 30000);
    setInterval(updateDeviceStatus, 5000);
});
