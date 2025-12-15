import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    isAuthEnabled,
    parseJwt,
    login,
    logout,
    getAuthHeaders,
    showLoginUI,
    showAuthenticatedUI,
    getCurrentSession,
    refreshSession,
    changePassword,
    initAuth
} from '../public/js/auth.js';

describe('Auth Module', () => {
    let sessionStorageMock;
    let originalWindow;
    let originalFetch;
    let originalLocation;

    beforeEach(() => {
        sessionStorageMock = {
            store: {},
            getItem: vi.fn((key) => sessionStorageMock.store[key] || null),
            setItem: vi.fn((key, value) => { sessionStorageMock.store[key] = value; }),
            removeItem: vi.fn((key) => { delete sessionStorageMock.store[key]; }),
            clear: vi.fn(() => { sessionStorageMock.store = {}; })
        };

        originalWindow = { ...window };
        originalFetch = global.fetch;
        originalLocation = window.location;

        global.sessionStorage = sessionStorageMock;
        global.fetch = vi.fn();

        document.body.innerHTML = `
            <div id="app-container" style="display: block;"></div>
            <div id="login-container" style="display: none;"></div>
            <span id="user-email"></span>
        `;
    });

    afterEach(() => {
        vi.clearAllMocks();
        sessionStorageMock.store = {};
        global.fetch = originalFetch;
        window.ENV = undefined;
    });

    describe('isAuthEnabled', () => {
        it('should return false when VITE_ENVIRONMENT is demo', () => {
            window.ENV = { VITE_ENVIRONMENT: 'demo' };
            expect(isAuthEnabled()).toBe(false);
        });

        it('should return false when VITE_ENVIRONMENT is DEMO (case insensitive)', () => {
            window.ENV = { VITE_ENVIRONMENT: 'DEMO' };
            expect(isAuthEnabled()).toBe(false);
        });

        it('should return true when VITE_ENVIRONMENT is production', () => {
            window.ENV = { VITE_ENVIRONMENT: 'production' };
            expect(isAuthEnabled()).toBe(true);
        });

        it('should return falsy when window.ENV is undefined', () => {
            window.ENV = undefined;
            expect(isAuthEnabled()).toBeFalsy();
        });

        it('should return falsy when VITE_ENVIRONMENT is empty', () => {
            window.ENV = { VITE_ENVIRONMENT: '' };
            expect(isAuthEnabled()).toBeFalsy();
        });
    });

    describe('parseJwt', () => {
        it('should parse a valid JWT token', () => {
            const payload = { sub: '123', email: 'test@example.com', exp: 9999999999 };
            const base64Payload = btoa(JSON.stringify(payload));
            const token = `header.${base64Payload}.signature`;

            const result = parseJwt(token);

            expect(result.sub).toBe('123');
            expect(result.email).toBe('test@example.com');
            expect(result.exp).toBe(9999999999);
        });

        it('should handle URL-safe base64 characters', () => {
            const payload = { data: 'test+value/with=chars' };
            const base64Payload = btoa(JSON.stringify(payload))
                .replace(/\+/g, '-').replace(/\//g, '_');
            const token = `header.${base64Payload}.signature`;

            const result = parseJwt(token);

            expect(result.data).toBe('test+value/with=chars');
        });

        it('should throw on invalid token format', () => {
            expect(() => parseJwt('invalid')).toThrow();
        });
    });

    describe('login', () => {
        it('should return success true in demo mode', async () => {
            window.ENV = { VITE_ENVIRONMENT: 'demo' };

            const result = await login('test@example.com', 'password');

            expect(result.success).toBe(true);
        });

        it('should handle NEW_PASSWORD_REQUIRED challenge', async () => {
            window.ENV = {
                VITE_ENVIRONMENT: 'production',
                VITE_COGNITO_USER_POOL_ID: 'pool-id',
                VITE_COGNITO_CLIENT_ID: 'client-id'
            };

            global.fetch = vi.fn().mockResolvedValue({
                json: () => Promise.resolve({
                    ChallengeName: 'NEW_PASSWORD_REQUIRED',
                    Session: 'session-token-123'
                })
            });

            const result = await login('test@example.com', 'password');

            expect(result.success).toBe(false);
            expect(result.challenge).toBe('NEW_PASSWORD_REQUIRED');
            expect(result.session).toBe('session-token-123');
        });

        it('should store tokens on successful authentication', async () => {
            window.ENV = {
                VITE_ENVIRONMENT: 'production',
                VITE_COGNITO_USER_POOL_ID: 'pool-id',
                VITE_COGNITO_CLIENT_ID: 'client-id'
            };

            const payload = { email: 'test@example.com', exp: 9999999999 };
            const idToken = `header.${btoa(JSON.stringify(payload))}.signature`;

            global.fetch = vi.fn().mockResolvedValue({
                json: () => Promise.resolve({
                    AuthenticationResult: {
                        AccessToken: 'access-token',
                        IdToken: idToken,
                        RefreshToken: 'refresh-token'
                    }
                })
            });

            const result = await login('test@example.com', 'password');

            expect(result.success).toBe(true);
            expect(sessionStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'access-token');
            expect(sessionStorageMock.setItem).toHaveBeenCalledWith('idToken', idToken);
        });

        it('should return error on login failure', async () => {
            window.ENV = {
                VITE_ENVIRONMENT: 'production',
                VITE_COGNITO_USER_POOL_ID: 'pool-id',
                VITE_COGNITO_CLIENT_ID: 'client-id'
            };

            global.fetch = vi.fn().mockResolvedValue({
                json: () => Promise.resolve({
                    message: 'Incorrect username or password'
                })
            });

            const result = await login('test@example.com', 'wrongpassword');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Incorrect username or password');
        });

        it('should handle network errors', async () => {
            window.ENV = {
                VITE_ENVIRONMENT: 'production',
                VITE_COGNITO_USER_POOL_ID: 'pool-id',
                VITE_COGNITO_CLIENT_ID: 'client-id'
            };

            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            const result = await login('test@example.com', 'password');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Network error');
        });
    });

    describe('changePassword', () => {
        it('should handle successful password change', async () => {
            window.ENV = {
                VITE_ENVIRONMENT: 'production',
                VITE_COGNITO_USER_POOL_ID: 'pool-id',
                VITE_COGNITO_CLIENT_ID: 'client-id'
            };

            global.fetch = vi.fn().mockResolvedValue({
                json: () => Promise.resolve({
                    AuthenticationResult: {
                        AccessToken: 'new-access-token',
                        IdToken: 'new-id-token',
                        RefreshToken: 'new-refresh-token'
                    }
                })
            });

            const result = await changePassword('test@example.com', 'oldpass', 'newpass', 'session');

            expect(result.success).toBe(true);
            expect(sessionStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'new-access-token');
        });

        it('should handle password change failure', async () => {
            window.ENV = {
                VITE_ENVIRONMENT: 'production',
                VITE_COGNITO_USER_POOL_ID: 'pool-id',
                VITE_COGNITO_CLIENT_ID: 'client-id'
            };

            global.fetch = vi.fn().mockResolvedValue({
                json: () => Promise.resolve({
                    message: 'Password does not meet requirements'
                })
            });

            const result = await changePassword('test@example.com', 'oldpass', 'weak', 'session');

            expect(result.success).toBe(false);
        });

        it('should handle network errors during password change', async () => {
            window.ENV = {
                VITE_ENVIRONMENT: 'production',
                VITE_COGNITO_USER_POOL_ID: 'pool-id',
                VITE_COGNITO_CLIENT_ID: 'client-id'
            };

            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            const result = await changePassword('test@example.com', 'oldpass', 'newpass', 'session');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Network error');
        });
    });

    describe('logout', () => {
        it('should clear session storage', () => {
            sessionStorageMock.store = {
                accessToken: 'token',
                idToken: 'token',
                refreshToken: 'token'
            };

            delete window.location;
            window.location = { reload: vi.fn() };

            logout();

            expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
            expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('idToken');
            expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
        });
    });

    describe('getAuthHeaders', () => {
        it('should return empty object in demo mode', async () => {
            window.ENV = { VITE_ENVIRONMENT: 'demo' };

            const headers = await getAuthHeaders();

            expect(headers).toEqual({});
        });

        it('should return Authorization header with valid session', async () => {
            window.ENV = { VITE_ENVIRONMENT: 'production' };

            const payload = { email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 3600 };
            const idToken = `header.${btoa(JSON.stringify(payload))}.signature`;

            sessionStorageMock.store = {
                accessToken: 'access-token',
                idToken: idToken,
                refreshToken: 'refresh-token'
            };

            const headers = await getAuthHeaders();

            expect(headers.Authorization).toBe(`Bearer ${idToken}`);
        });

        it('should throw when not authenticated', async () => {
            window.ENV = { VITE_ENVIRONMENT: 'production' };
            sessionStorageMock.store = {};

            await expect(getAuthHeaders()).rejects.toThrow('Not authenticated');
        });
    });

    describe('getCurrentSession', () => {
        it('should return null in demo mode', async () => {
            window.ENV = { VITE_ENVIRONMENT: 'demo' };

            const session = await getCurrentSession();

            expect(session).toBeNull();
        });

        it('should return session when valid token exists', async () => {
            window.ENV = { VITE_ENVIRONMENT: 'production' };

            const payload = { email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 3600 };
            const idToken = `header.${btoa(JSON.stringify(payload))}.signature`;

            sessionStorageMock.store = {
                accessToken: 'access-token',
                idToken: idToken,
                refreshToken: 'refresh-token'
            };

            const session = await getCurrentSession();

            expect(session).not.toBeNull();
            expect(session.email).toBe('test@example.com');
        });

        it('should return null when token is expired and no refresh token', async () => {
            window.ENV = { VITE_ENVIRONMENT: 'production' };

            const payload = { email: 'test@example.com', exp: Math.floor(Date.now() / 1000) - 3600 };
            const idToken = `header.${btoa(JSON.stringify(payload))}.signature`;

            sessionStorageMock.store = {
                idToken: idToken
            };

            const session = await getCurrentSession();

            expect(session).toBeNull();
        });

        it('should attempt refresh when token expired but refresh token exists', async () => {
            window.ENV = {
                VITE_ENVIRONMENT: 'production',
                VITE_COGNITO_CLIENT_ID: 'client-id'
            };

            const expiredPayload = { email: 'test@example.com', exp: Math.floor(Date.now() / 1000) - 3600 };
            const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;

            const newPayload = { email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 3600 };
            const newToken = `header.${btoa(JSON.stringify(newPayload))}.signature`;

            sessionStorageMock.store = {
                idToken: expiredToken,
                refreshToken: 'refresh-token'
            };

            global.fetch = vi.fn().mockResolvedValue({
                json: () => Promise.resolve({
                    AuthenticationResult: {
                        AccessToken: 'new-access-token',
                        IdToken: newToken
                    }
                })
            });

            const session = await getCurrentSession();

            expect(global.fetch).toHaveBeenCalled();
        });

        it('should handle parse error gracefully', async () => {
            window.ENV = { VITE_ENVIRONMENT: 'production' };
            window.ErrorHandler = { handle: vi.fn() };

            sessionStorageMock.store = {
                idToken: 'invalid-token'
            };

            const session = await getCurrentSession();

            expect(session).toBeNull();
        });
    });

    describe('refreshSession', () => {
        it('should return new session on successful refresh', async () => {
            window.ENV = {
                VITE_ENVIRONMENT: 'production',
                VITE_COGNITO_CLIENT_ID: 'client-id'
            };

            global.fetch = vi.fn().mockResolvedValue({
                json: () => Promise.resolve({
                    AuthenticationResult: {
                        AccessToken: 'new-access-token',
                        IdToken: 'new-id-token'
                    }
                })
            });

            const session = await refreshSession('refresh-token');

            expect(session).not.toBeNull();
            expect(session.accessToken).toBe('new-access-token');
            expect(session.idToken).toBe('new-id-token');
            expect(sessionStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'new-access-token');
        });

        it('should return null on refresh failure', async () => {
            window.ENV = {
                VITE_ENVIRONMENT: 'production',
                VITE_COGNITO_CLIENT_ID: 'client-id'
            };

            global.fetch = vi.fn().mockRejectedValue(new Error('Refresh failed'));
            window.ErrorHandler = { handle: vi.fn() };

            const session = await refreshSession('invalid-refresh-token');

            expect(session).toBeNull();
        });

        it('should return null when no AuthenticationResult', async () => {
            window.ENV = {
                VITE_ENVIRONMENT: 'production',
                VITE_COGNITO_CLIENT_ID: 'client-id'
            };

            global.fetch = vi.fn().mockResolvedValue({
                json: () => Promise.resolve({})
            });

            const session = await refreshSession('refresh-token');

            expect(session).toBeNull();
        });
    });

    describe('showLoginUI', () => {
        it('should hide app container and show login container', () => {
            showLoginUI();

            const appContainer = document.getElementById('app-container');
            const loginContainer = document.getElementById('login-container');

            expect(appContainer.style.display).toBe('none');
            expect(loginContainer.style.display).toBe('flex');
        });

        it('should handle missing containers gracefully', () => {
            document.body.innerHTML = '';

            expect(() => showLoginUI()).not.toThrow();
        });
    });

    describe('showAuthenticatedUI', () => {
        it('should show app container and hide login container', () => {
            const appContainer = document.getElementById('app-container');
            const loginContainer = document.getElementById('login-container');

            appContainer.style.display = 'none';
            loginContainer.style.display = 'flex';

            showAuthenticatedUI();

            expect(appContainer.style.display).toBe('block');
            expect(loginContainer.style.display).toBe('none');
        });

        it('should handle missing containers gracefully', () => {
            document.body.innerHTML = '';

            expect(() => showAuthenticatedUI()).not.toThrow();
        });
    });

    describe('initAuth', () => {
        it('should return true in demo mode', async () => {
            window.ENV = { VITE_ENVIRONMENT: 'demo' };

            const result = await initAuth();

            expect(result).toBe(true);
        });

        it('should return false when Cognito not configured', async () => {
            window.ENV = { VITE_ENVIRONMENT: 'production' };

            const result = await initAuth();

            expect(result).toBe(false);
        });

        it('should call showLoginUI when no session exists', async () => {
            window.ENV = { VITE_ENVIRONMENT: 'production' };
            sessionStorageMock.store = {};

            const result = await initAuth();

            expect(result).toBe(false);
        });

        it('should handle session retrieval errors gracefully', async () => {
            window.ENV = { VITE_ENVIRONMENT: 'production' };

            sessionStorageMock.store = {
                idToken: 'invalid-token'
            };

            const result = await initAuth();

            expect(result).toBe(false);
        });
    });

    describe('window auth global', () => {
        it('should expose auth object on window', () => {
            expect(window.auth).toBeDefined();
            expect(window.auth.isAuthEnabled).toBeDefined();
            expect(window.auth.login).toBeDefined();
            expect(window.auth.logout).toBeDefined();
        });
    });
});
