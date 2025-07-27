// public/js/index.js

// IMPORTANT: This placeholder will be replaced by the Amplify build process
// with the actual API Gateway URL from your deployment environment.
const API_BASE_URL = "REPLACE_API_BASE_URL";

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
const userNameDisplay = document.getElementById('userNameDisplay'); // New element
const logoutButton = document.getElementById('logoutButton');       // New element

// --- Modal Elements ---
const messageModal = document.getElementById('messageModal'); // Re-using the generic modal
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const closeModalButton = document.getElementById('closeModalButton');

const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let totalPages = 1;
let currentUserName = "Guest"; // Default user name, will be overwritten by session storage

let statusPollingInterval = null; // Variable to hold the interval ID for polling

// --- Amplify Configuration ---
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

Amplify.configure(amplifyConfig);

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

/**
 * Shows a custom modal with a given title and message.
 * @param {string} title The title of the modal.
 * @param {string} message The message content of the modal.
 */
function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    messageModal.classList.remove('hidden'); // Show the modal
}

/**
 * Hides the custom modal.
 */
function hideModal() {
    messageModal.classList.add('hidden'); // Hide the modal
}

// --- API Calls ---

// Function to send feed command
async function sendFeedCommand() {
    // Check if feeder is busy before sending command
    const currentFeederStatus = deviceStatusElement.textContent.toUpperCase();
    if (currentFeederStatus === 'OPENING' || currentFeederStatus === 'OPEN' || currentFeederStatus === 'CLOSING') {
        showModal('Feeder Busy', 'The feeder is currently busy. Please wait a moment before sending another command.');
        return; // Exit the function if busy
    }

    feedButton.disabled = true;
    feedMessage.textContent = "Sending feed command...";
    feedMessage.className = "text-sm text-gray-600 mt-3"; // Reset class

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/feed/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Use the currentUserName for requested_by
            body: JSON.stringify({ "requested_by": currentUserName, "mode": "manual" })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        feedMessage.textContent = `Command sent! Status: ${data.status.toUpperCase()}`;
        feedMessage.className = "text-sm text-green-600 mt-3 font-semibold";

        // Refresh history and device status immediately after sending command
        fetchFeedHistory(1); // Go back to first page after a new feed
        updateDeviceStatus(); // Also update device status immediately

        // Start polling for status updates for 5 seconds
        let pollCount = 0;
        const maxPolls = 5; // Poll for 5 seconds
        const pollIntervalMs = 1000; // Every 1 second

        // Clear any existing polling interval to prevent multiple intervals running
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
                statusPollingInterval = null; // Reset the interval ID
                console.log("Status polling finished.");
            }
        }, pollIntervalMs);

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
    eventsContainer.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500" id="loadingEvents">Loading feeding history...</td></tr>`;
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
        const response = await fetch(`${API_BASE_URL}/status/`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        deviceStatusElement.textContent = data.feeder_state.toUpperCase();
        statusMessageElement.textContent = `Last updated: ${formatTimestamp(data.last_updated)}`;
    } catch (error) {
        console.error("Error fetching device status:", error);
        deviceStatusElement.textContent = "Error";
        statusMessageElement.textContent = `Could not fetch device status: ${error.message}`;
    }
}

// --- Authentication & Session Management ---

async function handleLogout() {
    try {
        await Amplify.Auth.signOut();
        sessionStorage.removeItem('authenticatedUserEmail');
        sessionStorage.removeItem('guestUserName');
        window.location.href = 'login.html'; // Redirect to login page after logout
    } catch (error) {
        console.error("Error during logout:", error);
        showModal('Logout Error', `Failed to log out: ${error.message}`);
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

refreshButton.addEventListener('click', () => {
    fetchFeedHistory(1);
    updateDeviceStatus();
});

logoutButton.addEventListener('click', handleLogout); // New event listener for logout

// Event listener for closing the modal
closeModalButton.addEventListener('click', hideModal);

// Initial load logic for index.html
document.addEventListener('DOMContentLoaded', async () => {
    let userLoggedIn = false;

    // 1. Try to get current Amplify authenticated user
    try {
        const user = await Amplify.Auth.getCurrentUser();
        if (user) {
            console.log("Amplify authenticated user found:", user);
            currentUserName = user.signInDetails.loginId || user.username || user.attributes.email || "Authenticated User";
            sessionStorage.setItem('authenticatedUserEmail', currentUserName);
            sessionStorage.removeItem('guestUserName'); // Clear guest session if authenticated
            userNameDisplay.textContent = `Welcome, ${currentUserName}!`;
            userLoggedIn = true;
        }
    } catch (error) {
        console.log("No Amplify authenticated session found or error:", error);
        // This is expected if no user is logged in via Amplify
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
        return; // Stop further execution on this page
    }

    // If a user is logged in (either authenticated or guest), load app content
    console.log(`User "${currentUserName}" is logged in. Loading app content.`);
    fetchFeedHistory(1);
    updateDeviceStatus();

    // Periodically refresh history (e.g., every 30 seconds) and device status (e.g., every 5 seconds)
    setInterval(() => fetchFeedHistory(currentPage), 30000);
    setInterval(updateDeviceStatus, 5000); // Update status every 5 seconds
});
