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

// --- Helper Functions for Modal ---
function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    messageModal.classList.remove('hidden');
}

function hideModal() {
    messageModal.classList.add('hidden');
}

// --- Login Logic ---

async function handleGoogleLogin() {
    try {
        // Ensure Amplify is defined before calling its methods
        if (typeof Amplify === 'undefined' || !Amplify.Auth) {
            console.error("Amplify or Amplify.Auth is not defined when handleGoogleLogin is called.");
            showModal('Login Error', 'Amplify library not fully loaded. Please try again.');
            return;
        }
        await Amplify.Auth.federatedSignIn({ provider: 'Google' });
    } catch (error) {
        console.error("Error during Google federated sign-in:", error);
        showModal('Login Error', `Failed to initiate Google login: ${error.message}`);
    }
}

// --- Event Listeners & Initial Load ---

guestLoginButton.addEventListener('click', handleGuestLogin);
closeModalButton.addEventListener('click', hideModal);

// Initial load logic for login.html
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
    console.log("Amplify configured from login.js DOMContentLoaded.");

    // Attach Google Login Button listener here to ensure Amplify is available
    googleLoginButton.addEventListener('click', handleGoogleLogin);

    // Amplify Auth Hub Listener to handle sign-in events after redirect
    Amplify.Hub.listen('auth', ({ payload }) => {
        const { event } = payload;
        console.log("Auth event:", event, payload);

        if (event === 'signedIn') {
            console.log('User signed in successfully!');
            sessionStorage.setItem('authenticatedUserEmail', payload.data.signInDetails.loginId);
            sessionStorage.removeItem('guestUserName');
            window.location.href = 'index.html';
        } else if (event === 'signedOut') {
            console.log('User signed out.');
            sessionStorage.removeItem('authenticatedUserEmail');
            sessionStorage.removeItem('guestUserName');
        } else if (event === 'signInWithRedirect') {
            showModal('Authentication', 'Redirecting to Google for sign-in...');
        } else if (event === 'signInWithRedirect_failure') {
            showModal('Login Failed', `Google sign-in failed: ${payload.data?.message || 'Unknown error'}. Please try again.`);
        } else if (event === 'autoSignIn') {
            console.log('Auto sign-in successful.');
            sessionStorage.setItem('authenticatedUserEmail', payload.data.signInDetails.loginId);
            sessionStorage.removeItem('guestUserName');
            window.location.href = 'index.html';
        } else if (event === 'autoSignIn_failure') {
            console.log('Auto sign-in failed:', payload.data);
            if (payload.data && payload.data.message && payload.data.message.includes('User is not confirmed')) {
                showModal('Approval Pending', 'Your account requires admin approval. Please wait for an administrator to activate your access.');
            } else {
                showModal('Session Expired', 'Your session has expired or auto-login failed. Please sign in again.');
            }
        }
    });

    const storedGuestName = sessionStorage.getItem('guestUserName');
    if (storedGuestName) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const user = await Amplify.Auth.getCurrentUser();
        if (user) {
            console.log("Existing Amplify session found:", user);
            sessionStorage.setItem('authenticatedUserEmail', user.signInDetails.loginId);
            window.location.href = 'index.html';
        } else {
            console.log("No existing Amplify session.");
            guestNameInput.focus();
        }
    } catch (error) {
        console.log("Error checking current Amplify user (likely no session):", error);
        guestNameInput.focus();
    }
});
