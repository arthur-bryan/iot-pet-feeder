// public/js/main.js

// IMPORTANT: Replace with the actual URL of your deployed FastAPI backend
// This should be the base URL of your API Gateway stage.
// e.g., "https://e90m1jcfzj.execute-api.us-east-2.amazonaws.com/prd"
const API_BASE_URL = "https://e90m1jcfzj.execute-api.us-east-2.amazonaws.com/prd";

const feedButton = document.getElementById('feedButton');
const feedMessage = document.getElementById('feedMessage');

// Function to send feed command
async function sendFeedCommand() {
    feedButton.disabled = true; // Disable button to prevent multiple clicks
    feedMessage.textContent = "Sending feed command...";
    feedMessage.className = "text-sm text-gray-600 mt-3"; // Reset class

    try {
        // Corrected URL: API_BASE_URL + router prefix + endpoint path
        const response = await fetch(`${API_BASE_URL}/api/v1/feed/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // For now, hardcode 'requested_by'. In a real app, this comes from login.
            body: JSON.stringify({ "requested_by": "web_user@example.com" })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        feedMessage.textContent = data.message;
        feedMessage.className = "text-sm text-green-600 mt-3 font-semibold"; // Success message styling

    } catch (error) {
        console.error("Error sending feed command:", error);
        feedMessage.textContent = `Failed to send command: ${error.message}`;
        feedMessage.className = "text-sm text-red-600 mt-3 font-semibold"; // Error message styling
    } finally {
        feedButton.disabled = false; // Re-enable button
    }
}

// --- Event Listeners & Initial Load ---
feedButton.addEventListener('click', sendFeedCommand);

// Initial message clear
feedMessage.textContent = "";