// public/js/login.js

// --- Global Environment Variables from Amplify Build ---
// These are injected by the Amplify build process based on Terraform outputs
// and are available globally on the window object.
const amplifyConfig = {
    Auth: {
        Cognito: {
            userPoolId: window.ENV?.VITE_USER_POOL_ID,
            userPoolClientId: window.ENV?.VITE_USER_POOL_CLIENT_ID,
            region: window.ENV?.VITE_REGION,
            // REQUIRED: The Google client ID from Google Cloud Console
            // This is NOT the Cognito User Pool Client ID.
            // This should be the same client ID you configured in Cognito Identity Provider.
            identityProviders: {
                google: {
                    clientId: window.ENV?.VITE_GOOGLE_CLIENT_ID, // This needs to be passed via Amplify environment variables
                    scopes: ['email', 'profile', 'openid']
                }
            },
            loginWith: {
                oauth: {
                    domain: `${window.ENV?.VITE_USER_POOL_DOMAIN}.auth.${window.ENV?.VITE_REGION}.amazoncognito.com`,
                    // The redirectSignIn and redirectSignOut URLs MUST match what you configured in Cognito.
                    // For now, use the Amplify app's default domain.
                    redirectSignIn: `${window.location.origin}/`,
                    redirectSignOut: `${window.location.origin}/`,
                    responseType: 'code' // or 'token'
                }
            }
        }
    }
};

// Configure Amplify
Amplify.configure(amplifyConfig);

// --- Login Page Elements ---
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

function handleGuestLogin() {
    const guestName = guestNameInput.value.trim();
    if (guestName) {
        sessionStorage.setItem('guestUserName', guestName); // Store guest name in session storage
        window.location.href = 'index.html'; // Redirect to the main application page
    } else {
        showModal('Input Required', 'Please enter your name to continue as a guest.');
    }
}

async function handleGoogleLogin() {
    try {
        // This will redirect to Google for authentication, then back to your app
        await Amplify.Auth.federatedSignIn({ provider: 'Google' });
        // The Hub listener will handle the redirect back
    } catch (error) {
        console.error("Error during Google federated sign-in:", error);
        showModal('Login Error', `Failed to initiate Google login: ${error.message}`);
    }
}

// --- Event Listeners & Initial Load ---

// Event listener for guest login button
guestLoginButton.addEventListener('click', handleGuestLogin);

// Event listener for Google login button
googleLoginButton.addEventListener('click', handleGoogleLogin);

// Event listener for closing the modal
closeModalButton.addEventListener('click', hideModal);

// Amplify Auth Hub Listener to handle sign-in events after redirect
Amplify.Hub.listen('auth', ({ payload }) => {
    const { event } = payload;
    console.log("Auth event:", event, payload);

    if (event === 'signedIn') {
        console.log('User signed in successfully!');
        // Store the authenticated user's email or username in session storage
        // This will be retrieved by index.js
        sessionStorage.setItem('authenticatedUserEmail', payload.data.signInDetails.loginId); // Or payload.data.username, payload.data.attributes.email
        sessionStorage.removeItem('guestUserName'); // Clear guest session if authenticated
        window.location.href = 'index.html'; // Redirect to the main application page
    } else if (event === 'signedOut') {
        console.log('User signed out.');
        sessionStorage.removeItem('authenticatedUserEmail');
        sessionStorage.removeItem('guestUserName');
        // Optionally redirect to login page if signed out from index.html
    } else if (event === 'signInWithRedirect') {
        showModal('Authentication', 'Redirecting to Google for sign-in...');
    } else if (event === 'signInWithRedirect_failure') {
        showModal('Login Failed', `Google sign-in failed: ${payload.data?.message || 'Unknown error'}. Please try again.`);
    } else if (event === 'autoSignIn') {
        // Auto sign-in happens when a user returns to the app and has a valid session
        console.log('Auto sign-in successful.');
        sessionStorage.setItem('authenticatedUserEmail', payload.data.signInDetails.loginId);
        sessionStorage.removeItem('guestUserName');
        window.location.href = 'index.html';
    } else if (event === 'autoSignIn_failure') {
        console.log('Auto sign-in failed:', payload.data);
        // This could happen if the user is not confirmed (pending admin approval)
        // Check if the error indicates user not confirmed
        if (payload.data && payload.data.message && payload.data.message.includes('User is not confirmed')) {
            showModal('Approval Pending', 'Your account requires admin approval. Please wait for an administrator to activate your access.');
        } else {
            showModal('Session Expired', 'Your session has expired or auto-login failed. Please sign in again.');
        }
    }
});


// Initial load logic for login.html
document.addEventListener('DOMContentLoaded', async () => {
    // Check for an existing guest session first
    const storedGuestName = sessionStorage.getItem('guestUserName');
    if (storedGuestName) {
        window.location.href = 'index.html';
        return; // Exit if guest is already logged in
    }

    // Try to automatically sign in with Amplify (e.g., if returning from federated login)
    try {
        const user = await Amplify.Auth.getCurrentUser();
        if (user) {
            console.log("Existing Amplify session found:", user);
            sessionStorage.setItem('authenticatedUserEmail', user.signInDetails.loginId); // Or user.username, user.attributes.email
            window.location.href = 'index.html';
        } else {
            console.log("No existing Amplify session.");
            guestNameInput.focus(); // Focus on guest input if no session found
        }
    } catch (error) {
        console.log("Error checking current Amplify user (likely no session):", error);
        // This often means no active session, which is fine for the login page.
        // If the error indicates "User is not confirmed", the Hub listener will catch it.
        guestNameInput.focus();
    }
});
