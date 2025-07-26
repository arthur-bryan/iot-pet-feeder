// public/js/login.js

// --- Login Page Elements ---
const guestNameInput = document.getElementById('guestNameInput');
const guestLoginButton = document.getElementById('guestLoginButton');
const googleLoginButton = document.getElementById('googleLoginButton'); // Disabled for now

// --- Login Logic ---

function handleGuestLogin() {
    const guestName = guestNameInput.value.trim();
    if (guestName) {
        sessionStorage.setItem('guestUserName', guestName); // Store guest name in session storage
        window.location.href = 'index.html'; // Redirect to the main application page
    } else {
        alert('Please enter your name to continue as a guest.'); // Using alert for simplicity, consider custom modal for production
    }
}

// --- Event Listeners & Initial Load ---

// Event listener for guest login button
guestLoginButton.addEventListener('click', handleGuestLogin);

// Check if guest user is already logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    const storedGuestName = sessionStorage.getItem('guestUserName');
    if (storedGuestName) {
        // If already logged in, redirect to main app immediately
        window.location.href = 'index.html';
    } else {
        // Otherwise, focus on the input field
        guestNameInput.focus();
    }
});
