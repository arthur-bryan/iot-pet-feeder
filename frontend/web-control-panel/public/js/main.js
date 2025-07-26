// public/js/main.js

// IMPORTANT: This placeholder will be replaced by the Amplify build process
// with the actual API Gateway URL from your deployment environment.
const API_BASE_URL = "REPLACE_API_BASE_URL"; // <<< CHANGED TO PLACEHOLDER

const feedButton = document.getElementById('feedButton');
const feedMessage = document.getElementById('feedMessage');
const eventsContainer = document.getElementById('eventsContainer'); // Now refers to tbody
const loadingEvents = document.getElementById('loadingEvents'); // Now refers to a td within a tr
const prevPageButton = document.getElementById('prevPageButton');
const nextPageButton = document.getElementById('nextPageButton');
const pageInfo = document.getElementById('pageInfo');
const deviceStatusElement = document.getElementById('deviceStatus'); // Added back for status display
const statusMessageElement = document.getElementById('statusMessage'); // Added back for status message

const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let totalPages = 1;

// --- Helper Functions ---

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

// --- API Calls ---

// Function to send feed command
async function sendFeedCommand() {
    feedButton.disabled = true;
    feedMessage.textContent = "Sending feed command...";
    feedMessage.className = "text-sm text-gray-600 mt-3"; // Reset class

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/feed/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ "requested_by": "web_user@example.com", "mode": "manual" })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        feedMessage.textContent = `Command sent! Status: ${data.status.toUpperCase()}`;
        feedMessage.className = "text-sm text-green-600 mt-3 font-semibold";

        // Refresh history after sending command
        setTimeout(() => {
            fetchFeedHistory(1); // Go back to first page after a new feed
        }, 1500);

    } catch (error) {
        console.error("Error sending feed command:", error);
        feedMessage.textContent = `Failed to send command: ${error.message}`;
        feedMessage.className = "text-sm text-red-600 mt-3 font-semibold";
    } finally {
        feedButton.disabled = false; // Re-enable button directly here
    }
}

// Function to fetch and display feeding history
async function fetchFeedHistory(page = 1) {
    // Clear previous events and show loading message
    eventsContainer.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500" id="loadingEvents">Loading feeding history...</td></tr>`; // colspan changed to 4
    pageInfo.textContent = `Loading...`;
    prevPageButton.disabled = true;
    nextPageButton.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/feed_history/?page=${page}&limit=${ITEMS_PER_PAGE}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error("HTTP error fetching history:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();

        eventsContainer.innerHTML = ''; // Clear loading message

        if (data.items && data.items.length > 0) {
            data.items.forEach(event => {
                const row = document.createElement('tr');
                row.className = 'history-item'; // Apply styling from CSS

                // Using data-label for responsive table headers
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
        const response = await fetch(`${API_BASE_URL}/status/`); // Assuming /status/ is at root
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        deviceStatusElement.textContent = data.status.toUpperCase();
        statusMessageElement.textContent = `Last updated: ${formatTimestamp(data.last_updated)}`;
    } catch (error) {
        console.error("Error fetching device status:", error);
        deviceStatusElement.textContent = "Error";
        statusMessageElement.textContent = `Could not fetch device status: ${error.message}`;
    }
}

// --- Event Listeners & Initial Load ---

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

// Initial load of feed history and device status
fetchFeedHistory(1);
updateDeviceStatus();

// Periodically refresh history (e.g., every 30 seconds) and device status (e.g., every 5 seconds)
setInterval(() => fetchFeedHistory(currentPage), 30000);
setInterval(updateDeviceStatus, 5000); // Update status every 5 seconds
