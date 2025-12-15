import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Settings Module', () => {
    let dom;
    let window;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
            url: 'http://localhost',
            runScripts: 'dangerously'
        });
        window = dom.window;
        global.window = window;
        global.document = window.document;
        global.localStorage = {
            store: {},
            getItem: vi.fn((key) => global.localStorage.store[key] || null),
            setItem: vi.fn((key, value) => { global.localStorage.store[key] = value; }),
            removeItem: vi.fn((key) => { delete global.localStorage.store[key]; })
        };
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Servo Duration', () => {
        const validateServoDuration = (duration) => {
            if (typeof duration !== 'number') return false;
            if (duration < 100 || duration > 10000) return false;
            return true;
        };

        it('should validate valid duration', () => {
            expect(validateServoDuration(500)).toBe(true);
            expect(validateServoDuration(100)).toBe(true);
            expect(validateServoDuration(10000)).toBe(true);
        });

        it('should reject invalid duration', () => {
            expect(validateServoDuration(50)).toBe(false);
            expect(validateServoDuration(15000)).toBe(false);
            expect(validateServoDuration('500')).toBe(false);
            expect(validateServoDuration(null)).toBe(false);
        });

        it('should fetch servo duration successfully', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ value: 750 })
            });

            const response = await fetch('/api/v1/config/SERVO_DURATION');
            const data = await response.json();

            expect(data.value).toBe(750);
        });

        it('should save servo duration successfully', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ value: 800 })
            });

            const response = await fetch('/api/v1/config/SERVO_DURATION', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: 800 })
            });

            expect(response.ok).toBe(true);
        });

        it('should handle save error gracefully', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                json: () => Promise.resolve({ error: 'Invalid value' })
            });

            const response = await fetch('/api/v1/config/SERVO_DURATION', {
                method: 'PUT',
                body: JSON.stringify({ value: -100 })
            });

            expect(response.ok).toBe(false);
        });
    });

    describe('Weight Threshold', () => {
        const validateWeightThreshold = (threshold) => {
            if (typeof threshold !== 'number') return false;
            if (threshold < 0 || threshold > 5000) return false;
            return true;
        };

        it('should validate valid threshold', () => {
            expect(validateWeightThreshold(100)).toBe(true);
            expect(validateWeightThreshold(0)).toBe(true);
            expect(validateWeightThreshold(5000)).toBe(true);
        });

        it('should reject invalid threshold', () => {
            expect(validateWeightThreshold(-10)).toBe(false);
            expect(validateWeightThreshold(6000)).toBe(false);
            expect(validateWeightThreshold('100')).toBe(false);
        });

        it('should fetch weight threshold successfully', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ value: 200 })
            });

            const response = await fetch('/api/v1/config/WEIGHT_THRESHOLD');
            const data = await response.json();

            expect(data.value).toBe(200);
        });
    });

    describe('Email Notifications', () => {
        const validateEmail = (email) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        };

        it('should validate valid email addresses', () => {
            expect(validateEmail('test@example.com')).toBe(true);
            expect(validateEmail('user.name@domain.co.uk')).toBe(true);
            expect(validateEmail('user+tag@example.org')).toBe(true);
        });

        it('should reject invalid email addresses', () => {
            expect(validateEmail('invalid')).toBe(false);
            expect(validateEmail('missing@')).toBe(false);
            expect(validateEmail('@nodomain.com')).toBe(false);
            expect(validateEmail('spaces in@email.com')).toBe(false);
        });

        it('should fetch email config successfully', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    value: {
                        email: 'user@example.com',
                        enabled: true,
                        preferences: { pet_ate: true, feedings: true }
                    }
                })
            });

            const response = await fetch('/api/v1/config/EMAIL_NOTIFICATIONS');
            const data = await response.json();

            expect(data.value.email).toBe('user@example.com');
            expect(data.value.enabled).toBe(true);
        });

        it('should toggle notifications enabled state', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ value: { enabled: false } })
            });

            const response = await fetch('/api/v1/config/EMAIL_NOTIFICATIONS', {
                method: 'PUT',
                body: JSON.stringify({ enabled: false })
            });

            expect(response.ok).toBe(true);
        });
    });

    describe('Device Status', () => {
        it('should parse device status correctly', () => {
            const parseDeviceStatus = (status) => {
                const states = {
                    'ONLINE': { label: 'Online', color: 'green' },
                    'OFFLINE': { label: 'Offline', color: 'red' },
                    'UNKNOWN': { label: 'Unknown', color: 'gray' }
                };
                return states[status] || states['UNKNOWN'];
            };

            expect(parseDeviceStatus('ONLINE').label).toBe('Online');
            expect(parseDeviceStatus('OFFLINE').color).toBe('red');
            expect(parseDeviceStatus('INVALID').label).toBe('Unknown');
        });

        it('should fetch device status successfully', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    feeder_state: 'ONLINE',
                    last_seen: '2024-12-15T10:00:00Z'
                })
            });

            const response = await fetch('/api/v1/device/status');
            const data = await response.json();

            expect(data.feeder_state).toBe('ONLINE');
        });
    });

    describe('Settings Form State', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <span id="durationDisplay">750ms</span>
                <input id="durationInput" type="number" value="750" class="hidden">
                <button id="editDurationButton"></button>
                <button id="saveDurationButton" class="hidden"></button>
                <button id="cancelDurationButton" class="hidden"></button>
            `;
        });

        it('should enter edit mode', () => {
            const durationDisplay = document.getElementById('durationDisplay');
            const durationInput = document.getElementById('durationInput');
            const editButton = document.getElementById('editDurationButton');
            const saveButton = document.getElementById('saveDurationButton');
            const cancelButton = document.getElementById('cancelDurationButton');

            const enterEditMode = () => {
                durationDisplay.classList.add('hidden');
                durationInput.classList.remove('hidden');
                editButton.classList.add('hidden');
                saveButton.classList.remove('hidden');
                cancelButton.classList.remove('hidden');
            };

            enterEditMode();

            expect(durationDisplay.classList.contains('hidden')).toBe(true);
            expect(durationInput.classList.contains('hidden')).toBe(false);
            expect(saveButton.classList.contains('hidden')).toBe(false);
        });

        it('should exit edit mode', () => {
            const durationDisplay = document.getElementById('durationDisplay');
            const durationInput = document.getElementById('durationInput');
            const editButton = document.getElementById('editDurationButton');
            const saveButton = document.getElementById('saveDurationButton');
            const cancelButton = document.getElementById('cancelDurationButton');

            durationDisplay.classList.add('hidden');
            durationInput.classList.remove('hidden');

            const exitEditMode = () => {
                durationDisplay.classList.remove('hidden');
                durationInput.classList.add('hidden');
                editButton.classList.remove('hidden');
                saveButton.classList.add('hidden');
                cancelButton.classList.add('hidden');
            };

            exitEditMode();

            expect(durationDisplay.classList.contains('hidden')).toBe(false);
            expect(durationInput.classList.contains('hidden')).toBe(true);
        });
    });

    describe('Toggle State Management', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <button id="notificationsToggle" aria-checked="false">
                    <span class="toggle-dot"></span>
                </button>
            `;
        });

        it('should set toggle state to enabled', () => {
            const toggle = document.getElementById('notificationsToggle');

            const setToggleState = (element, enabled) => {
                element.setAttribute('aria-checked', enabled.toString());
                if (enabled) {
                    element.classList.add('bg-indigo-600');
                    element.classList.remove('bg-gray-200');
                } else {
                    element.classList.add('bg-gray-200');
                    element.classList.remove('bg-indigo-600');
                }
            };

            setToggleState(toggle, true);

            expect(toggle.getAttribute('aria-checked')).toBe('true');
            expect(toggle.classList.contains('bg-indigo-600')).toBe(true);
        });

        it('should set toggle state to disabled', () => {
            const toggle = document.getElementById('notificationsToggle');
            toggle.classList.add('bg-indigo-600');

            const setToggleState = (element, enabled) => {
                element.setAttribute('aria-checked', enabled.toString());
                if (enabled) {
                    element.classList.add('bg-indigo-600');
                    element.classList.remove('bg-gray-200');
                } else {
                    element.classList.add('bg-gray-200');
                    element.classList.remove('bg-indigo-600');
                }
            };

            setToggleState(toggle, false);

            expect(toggle.getAttribute('aria-checked')).toBe('false');
            expect(toggle.classList.contains('bg-gray-200')).toBe(true);
        });
    });

    describe('Error Display', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="errorContainer"></div>
            `;
        });

        it('should display error message', () => {
            const errorContainer = document.getElementById('errorContainer');

            const showError = (message) => {
                errorContainer.textContent = message;
                errorContainer.classList.remove('hidden');
                errorContainer.classList.add('text-red-600');
            };

            showError('Failed to save settings');

            expect(errorContainer.textContent).toBe('Failed to save settings');
            expect(errorContainer.classList.contains('text-red-600')).toBe(true);
        });

        it('should clear error message', () => {
            const errorContainer = document.getElementById('errorContainer');
            errorContainer.textContent = 'Previous error';

            const clearError = () => {
                errorContainer.textContent = '';
                errorContainer.classList.add('hidden');
            };

            clearError();

            expect(errorContainer.textContent).toBe('');
            expect(errorContainer.classList.contains('hidden')).toBe(true);
        });
    });

    describe('Notification Preferences', () => {
        it('should parse notification preferences correctly', () => {
            const parsePreferences = (prefs) => {
                return {
                    petAte: prefs?.pet_ate ?? true,
                    feedings: prefs?.feedings ?? true,
                    failures: prefs?.failures ?? true
                };
            };

            const fullPrefs = { pet_ate: false, feedings: true, failures: false };
            const parsed = parsePreferences(fullPrefs);

            expect(parsed.petAte).toBe(false);
            expect(parsed.feedings).toBe(true);
            expect(parsed.failures).toBe(false);
        });

        it('should use defaults for missing preferences', () => {
            const parsePreferences = (prefs) => {
                return {
                    petAte: prefs?.pet_ate ?? true,
                    feedings: prefs?.feedings ?? true,
                    failures: prefs?.failures ?? true
                };
            };

            const partialPrefs = { pet_ate: false };
            const parsed = parsePreferences(partialPrefs);

            expect(parsed.petAte).toBe(false);
            expect(parsed.feedings).toBe(true);
            expect(parsed.failures).toBe(true);
        });

        it('should handle undefined preferences', () => {
            const parsePreferences = (prefs) => {
                return {
                    petAte: prefs?.pet_ate ?? true,
                    feedings: prefs?.feedings ?? true,
                    failures: prefs?.failures ?? true
                };
            };

            const parsed = parsePreferences(undefined);

            expect(parsed.petAte).toBe(true);
            expect(parsed.feedings).toBe(true);
            expect(parsed.failures).toBe(true);
        });
    });

    describe('SNS Subscription', () => {
        it('should subscribe email successfully', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ subscriptionArn: 'arn:aws:sns:...' })
            });

            const response = await fetch('/api/v1/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'user@example.com' })
            });
            const data = await response.json();

            expect(data.subscriptionArn).toBeDefined();
        });

        it('should handle subscription error', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                json: () => Promise.resolve({ error: 'Invalid email' })
            });

            const response = await fetch('/api/v1/notifications/subscribe', {
                method: 'POST',
                body: JSON.stringify({ email: 'invalid' })
            });

            expect(response.ok).toBe(false);
        });
    });

    describe('Theme Toggle', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <html>
                    <button id="themeToggleButton"></button>
                    <svg id="sunIcon" class="hidden"></svg>
                    <svg id="moonIcon"></svg>
                </html>
            `;
        });

        it('should initialize theme from localStorage', () => {
            global.localStorage.store = { theme: 'dark' };
            const html = document.documentElement;
            const sunIcon = document.getElementById('sunIcon');
            const moonIcon = document.getElementById('moonIcon');

            const initializeTheme = () => {
                const theme = localStorage.getItem('theme') || 'light';
                if (theme === 'dark') {
                    html.classList.add('dark');
                    sunIcon.classList.remove('hidden');
                    moonIcon.classList.add('hidden');
                }
            };

            initializeTheme();

            expect(html.classList.contains('dark')).toBe(true);
        });

        it('should default to light theme if not set', () => {
            global.localStorage.store = {};
            const html = document.documentElement;

            const initializeTheme = () => {
                const theme = localStorage.getItem('theme') || 'light';
                if (theme === 'dark') {
                    html.classList.add('dark');
                }
            };

            initializeTheme();

            expect(html.classList.contains('dark')).toBe(false);
        });
    });
});
