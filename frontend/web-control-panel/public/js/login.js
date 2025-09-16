// public/js/login.js

// API_BASE_URL will now be read from window.ENV
const API_BASE_URL = window.ENV?.VITE_API_BASE_URL;
// --- Main App Elements ---
const guestNameInput = document.getElementById('guestNameInput');
const guestLoginButton = document.getElementById('guestLoginButton');
const googleLoginButton = document.getElementById('googleLoginButton');

// --- Modal Elements ---
const messageModal = document.getElementById('messageModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const closeModalButton = document.getElementById('closeModalButton');

// --- Modal Helpers ---
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

// --- Helper Functions ---
const isValidGuestName = name => /^[a-zA-Z0-9 _-]{2,32}$/.test(name);
const redirectTo = url => { window.location.href = url; };

// --- Guest Login Logic ---
const handleGuestLogin = () => {
    const guestName = guestNameInput.value.trim();
    if (!isValidGuestName(guestName)) {
        showModal('Invalid Name', 'Please enter a valid name (2-32 characters, letters, numbers, spaces, -, _).');
        guestNameInput.focus();
        return;
    }
    sessionStorage.setItem('guestUserName', guestName);
    sessionStorage.removeItem('authenticatedUserEmail');
    redirectTo('index.html');
};

// --- Google Login Logic ---
const handleGoogleLogin = async () => {
    if (typeof Amplify === 'undefined' || !Amplify.Auth) {
        showModal('Login Error', 'Amplify library not loaded. Please try again.');
        return;
    }
    try {
        await Amplify.Auth.federatedSignIn({ provider: 'Google' });
    } catch (error) {
        console.error('Error during Google federated sign-in:', error);
        showModal('Login Error', `Failed to initiate Google login: ${error.message}`);
    }
};

// --- Event Listeners ---
guestLoginButton.addEventListener('click', handleGuestLogin);
googleLoginButton?.addEventListener('click', handleGoogleLogin);
closeModalButton.addEventListener('click', hideModal);

// --- Storage Event Listener for Logout Sync ---
window.addEventListener('storage', event => {
    if ((event.key === 'authenticatedUserEmail' || event.key === 'guestUserName') && event.newValue === null) {
        redirectTo('login.html');
    }
});

// --- Amplify Hub Listener (singleton) ---
let amplifyHubListenerAttached = false;
function attachAmplifyHubListener() {
    if (amplifyHubListenerAttached) return;
    Amplify.Hub.listen('auth', ({ payload }) => {
        const { event } = payload;
        switch (event) {
            case 'signedIn':
            case 'autoSignIn':
                sessionStorage.setItem('authenticatedUserEmail', payload.data.signInDetails?.loginId);
                sessionStorage.removeItem('guestUserName');
                redirectTo('index.html');
                break;
            case 'signedOut':
                sessionStorage.removeItem('authenticatedUserEmail');
                sessionStorage.removeItem('guestUserName');
                break;
            case 'signInWithRedirect':
                showModal('Authentication', 'Redirecting to Google for sign-in...');
                break;
            case 'signInWithRedirect_failure':
                showModal('Login Failed', `Google sign-in failed: ${payload.data?.message || 'Unknown error'}. Please try again.`);
                break;
            case 'autoSignIn_failure':
                if (payload.data?.message?.includes('User is not confirmed')) {
                    showModal('Approval Pending', 'Your account requires admin approval. Please wait for an administrator to activate your access.');
                } else {
                    showModal('Session Expired', 'Your session has expired or auto-login failed. Please sign in again.');
                }
                break;
        }
    });
    amplifyHubListenerAttached = true;
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
    attachAmplifyHubListener();
    const storedGuestName = sessionStorage.getItem('guestUserName');
    if (storedGuestName) {
        redirectTo('index.html');
        return;
    }
    try {
        const user = await Amplify.Auth.getCurrentUser();
        if (user) {
            sessionStorage.setItem('authenticatedUserEmail', user.signInDetails?.loginId);
            redirectTo('index.html');
        } else {
            guestNameInput.focus();
        }
    } catch (error) {
        guestNameInput.focus();
    }
});
