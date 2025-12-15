/**
 * Authentication Module
 * Handles Cognito authentication for non-demo environments
 */

// Check if authentication is enabled
export function isAuthEnabled() {
    return window.ENV?.VITE_ENVIRONMENT && window.ENV.VITE_ENVIRONMENT.toLowerCase() !== 'demo';
}

// Cognito configuration
const cognitoConfig = {
    userPoolId: window.ENV?.VITE_COGNITO_USER_POOL_ID || '',
    clientId: window.ENV?.VITE_COGNITO_CLIENT_ID || '',
    region: window.ENV?.VITE_REGION || 'us-east-2'
};

// Current session (cached for future use)
let _currentSession = null;
let currentUser = null;

/**
 * Initialize authentication
 */
export async function initAuth() {
    if (!isAuthEnabled()) {
        return true;
    }

    if (!cognitoConfig.userPoolId || !cognitoConfig.clientId) {
        return false;
    }

    // Check if user is already logged in
    try {
        const session = await getCurrentSession();
        if (session) {
            _currentSession = session;
            showAuthenticatedUI();
            return true;
        } else {
            showLoginUI();
            return false;
        }
    } catch (error) {
        showLoginUI();
        return false;
    }
}

/**
 * Get current Cognito session
 */
export async function getCurrentSession() {
    if (!isAuthEnabled()) {
        return null;
    }

    // Check session storage for tokens
    const accessToken = sessionStorage.getItem('accessToken');
    const idToken = sessionStorage.getItem('idToken');
    const refreshToken = sessionStorage.getItem('refreshToken');

    if (idToken) {
        // Verify token is not expired
        try {
            const payload = parseJwt(idToken);
            const now = Math.floor(Date.now() / 1000);

            if (payload.exp > now) {
                return {
                    accessToken,
                    idToken,
                    refreshToken,
                    email: payload.email
                };
            }
        } catch (e) {
            if (window.ErrorHandler) {
                window.ErrorHandler.handle(e, 'parseJwt');
            }
        }
    }

    // Try to refresh if we have refresh token
    if (refreshToken) {
        return await refreshSession(refreshToken);
    }

    return null;
}

/**
 * Parse JWT token
 */
export function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

/**
 * Login with email and password
 */
export async function login(email, password) {
    if (!isAuthEnabled()) {
        return { success: true };
    }

    try {
        const response = await fetch(`https://cognito-idp.${cognitoConfig.region}.amazonaws.com/`, {
            method: 'POST',
            headers: {
                'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
                'Content-Type': 'application/x-amz-json-1.1'
            },
            body: JSON.stringify({
                AuthFlow: 'USER_PASSWORD_AUTH',
                ClientId: cognitoConfig.clientId,
                AuthParameters: {
                    USERNAME: email,
                    PASSWORD: password
                }
            })
        });

        const data = await response.json();

        if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
            return {
                success: false,
                challenge: 'NEW_PASSWORD_REQUIRED',
                session: data.Session,
                message: 'You must change your password on first login'
            };
        }

        if (data.AuthenticationResult) {
            // Store tokens
            sessionStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
            sessionStorage.setItem('idToken', data.AuthenticationResult.IdToken);
            sessionStorage.setItem('refreshToken', data.AuthenticationResult.RefreshToken);

            _currentSession = {
                accessToken: data.AuthenticationResult.AccessToken,
                idToken: data.AuthenticationResult.IdToken,
                refreshToken: data.AuthenticationResult.RefreshToken
            };

            const payload = parseJwt(data.AuthenticationResult.IdToken);
            currentUser = { email: payload.email };

            return { success: true, user: currentUser };
        }

        return { success: false, message: data.message || 'Login failed' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Change password (for NEW_PASSWORD_REQUIRED challenge)
 */
export async function changePassword(email, oldPassword, newPassword, session) {
    try {
        const response = await fetch(`https://cognito-idp.${cognitoConfig.region}.amazonaws.com/`, {
            method: 'POST',
            headers: {
                'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
                'Content-Type': 'application/x-amz-json-1.1'
            },
            body: JSON.stringify({
                ChallengeName: 'NEW_PASSWORD_REQUIRED',
                ClientId: cognitoConfig.clientId,
                ChallengeResponses: {
                    USERNAME: email,
                    PASSWORD: oldPassword,
                    NEW_PASSWORD: newPassword
                },
                Session: session
            })
        });

        const data = await response.json();

        if (data.AuthenticationResult) {
            // Store tokens
            sessionStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
            sessionStorage.setItem('idToken', data.AuthenticationResult.IdToken);
            sessionStorage.setItem('refreshToken', data.AuthenticationResult.RefreshToken);

            _currentSession = {
                accessToken: data.AuthenticationResult.AccessToken,
                idToken: data.AuthenticationResult.IdToken,
                refreshToken: data.AuthenticationResult.RefreshToken
            };

            return { success: true };
        }

        return { success: false, message: data.message || 'Password change failed' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Logout
 */
export function logout() {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('idToken');
    sessionStorage.removeItem('refreshToken');
    _currentSession = null;
    currentUser = null;
    window.location.reload();
}

/**
 * Get authentication headers for API requests
 */
export async function getAuthHeaders() {
    if (!isAuthEnabled()) {
        return {};
    }

    const session = await getCurrentSession();
    if (!session || !session.idToken) {
        // Not logged in - redirect to login
        showLoginUI();
        throw new Error('Not authenticated');
    }

    return {
        'Authorization': `Bearer ${session.idToken}`
    };
}

/**
 * Show login UI
 */
export function showLoginUI() {
    const appContainer = document.getElementById('app-container');
    const loginContainer = document.getElementById('login-container');

    if (appContainer) appContainer.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'flex';
}

/**
 * Show authenticated UI
 */
export function showAuthenticatedUI() {
    const appContainer = document.getElementById('app-container');
    const loginContainer = document.getElementById('login-container');

    if (appContainer) appContainer.style.display = 'block';
    if (loginContainer) loginContainer.style.display = 'none';

    // Update user info
    if (currentUser) {
        const userEmailElement = document.getElementById('user-email');
        if (userEmailElement) {
            userEmailElement.textContent = currentUser.email;
        }
    }
}

/**
 * Refresh session using refresh token
 */
export async function refreshSession(refreshToken) {
    try {
        const response = await fetch(`https://cognito-idp.${cognitoConfig.region}.amazonaws.com/`, {
            method: 'POST',
            headers: {
                'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
                'Content-Type': 'application/x-amz-json-1.1'
            },
            body: JSON.stringify({
                AuthFlow: 'REFRESH_TOKEN_AUTH',
                ClientId: cognitoConfig.clientId,
                AuthParameters: {
                    REFRESH_TOKEN: refreshToken
                }
            })
        });

        const data = await response.json();

        if (data.AuthenticationResult) {
            sessionStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
            sessionStorage.setItem('idToken', data.AuthenticationResult.IdToken);

            return {
                accessToken: data.AuthenticationResult.AccessToken,
                idToken: data.AuthenticationResult.IdToken,
                refreshToken: refreshToken
            };
        }
    } catch (error) {
        if (window.ErrorHandler) {
            window.ErrorHandler.handle(error, 'refreshSession');
        }
    }

    return null;
}

// Export auth object for convenience
export const auth = {
    isAuthEnabled,
    initAuth,
    login,
    changePassword,
    logout,
    getAuthHeaders,
    getCurrentSession
};

// Keep window global for backward compatibility with non-module scripts
if (typeof window !== 'undefined') {
    window.auth = auth;
}
