// public/js/settings.js

// --- Imports ---
import { clearElement, createElement } from './dom-utils.js';
import { Validators, showFieldError } from './validation-utils.js';

const getApiBaseUrl = () => window.ENV?.VITE_API_BASE_URL;

// Theme elements
const themeToggleButton = document.getElementById('themeToggleButton');
const _sunIcon = document.getElementById('sunIcon');
const _moonIcon = document.getElementById('moonIcon');

// Device settings elements
const durationDisplay = document.getElementById('durationDisplay');
const durationInput = document.getElementById('durationInput');
const editDurationButton = document.getElementById('editDurationButton');
const saveDurationButton = document.getElementById('saveDurationButton');
const cancelDurationButton = document.getElementById('cancelDurationButton');

const weightThresholdDisplay = document.getElementById('weightThresholdDisplay');
const weightThresholdInput = document.getElementById('weightThresholdInput');
const editWeightThresholdButton = document.getElementById('editWeightThresholdButton');
const saveWeightThresholdButton = document.getElementById('saveWeightThresholdButton');
const cancelWeightThresholdButton = document.getElementById('cancelWeightThresholdButton');

const deviceStatusIndicator = document.getElementById('deviceStatusIndicator');

// Notification elements
const notificationsToggle = document.getElementById('notificationsToggle');
const emailSection = document.getElementById('emailSection');
const emailInput = document.getElementById('emailInput');
const saveEmailButton = document.getElementById('saveEmailButton');
const emailStatus = document.getElementById('emailStatus');

const petAteToggle = document.getElementById('petAteToggle');
const feedingsToggle = document.getElementById('feedingsToggle');

// Current email config state
let currentEmailConfig = null;

// Theme functions
function toggleTheme() {
    Theme.toggle();
}

function initializeTheme() {
    Theme.initialize();
}

// Toggle button helper
function setToggleState(button, enabled) {
    button.setAttribute('data-enabled', enabled);
    if (enabled) {
        button.classList.remove('bg-gray-300', 'dark:bg-gray-600');
        button.classList.add('bg-indigo-600');
        button.querySelector('span:last-child').classList.remove('translate-x-1');
        button.querySelector('span:last-child').classList.add('translate-x-6');
    } else {
        button.classList.add('bg-gray-300', 'dark:bg-gray-600');
        button.classList.remove('bg-indigo-600');
        button.querySelector('span:last-child').classList.add('translate-x-1');
        button.querySelector('span:last-child').classList.remove('translate-x-6');
    }
}

// Device Settings Functions

async function loadDuration() {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS`, {
            headers: authHeaders
        });

        if (!response.ok) throw new Error('Failed to load duration');

        const data = await response.json();
        durationDisplay.textContent = data.value;
        durationInput.value = data.value;
    } catch (error) {
        durationDisplay.textContent = 'Error';
    }
}

async function saveDuration() {
    try {
        const validation = Validators.integerInRange(durationInput.value, 1000, 5000, 'Duration');
        if (!validation.valid) {
            showFieldError(durationInput, validation.message);
            return;
        }
        clearFieldError(durationInput);

        const value = parseInt(durationInput.value);
        saveDurationButton.disabled = true;
        saveDurationButton.textContent = 'Saving...';

        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ value })
        });

        if (!response.ok) throw new Error('Failed to save duration');

        const data = await response.json();
        durationDisplay.textContent = data.value;
        toggleDurationEditMode(false);
    } catch (error) {
        alert(`Failed to save duration: ${error.message}`);
    } finally {
        saveDurationButton.disabled = false;
        saveDurationButton.textContent = 'Save';
    }
}

function toggleDurationEditMode(isEditing) {
    if (isEditing) {
        durationDisplay.classList.add('hidden');
        durationInput.classList.remove('hidden');
        editDurationButton.classList.add('hidden');
        saveDurationButton.classList.remove('hidden');
        cancelDurationButton.classList.remove('hidden');
        durationInput.focus();
    } else {
        durationDisplay.classList.remove('hidden');
        durationInput.classList.add('hidden');
        editDurationButton.classList.remove('hidden');
        saveDurationButton.classList.add('hidden');
        cancelDurationButton.classList.add('hidden');
        durationInput.value = durationDisplay.textContent;
    }
}

async function loadWeightThreshold() {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/config/WEIGHT_THRESHOLD_G`, {
            headers: authHeaders
        });

        if (!response.ok) throw new Error('Failed to load weight threshold');

        const data = await response.json();
        weightThresholdDisplay.textContent = data.value;
        weightThresholdInput.value = data.value;
    } catch (error) {
        weightThresholdDisplay.textContent = 'Error';
    }
}

async function saveWeightThreshold() {
    try {
        const validation = Validators.integerInRange(weightThresholdInput.value, 100, 1000, 'Weight threshold');
        if (!validation.valid) {
            showFieldError(weightThresholdInput, validation.message);
            return;
        }
        clearFieldError(weightThresholdInput);

        const value = parseInt(weightThresholdInput.value);
        saveWeightThresholdButton.disabled = true;
        saveWeightThresholdButton.textContent = 'Saving...';

        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/config/WEIGHT_THRESHOLD_G`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ value })
        });

        if (!response.ok) throw new Error('Failed to save weight threshold');

        const data = await response.json();
        weightThresholdDisplay.textContent = data.value;
        toggleWeightThresholdEditMode(false);
    } catch (error) {
        alert(`Failed to save weight threshold: ${error.message}`);
    } finally {
        saveWeightThresholdButton.disabled = false;
        saveWeightThresholdButton.textContent = 'Save';
    }
}

function toggleWeightThresholdEditMode(isEditing) {
    if (isEditing) {
        weightThresholdDisplay.classList.add('hidden');
        weightThresholdInput.classList.remove('hidden');
        editWeightThresholdButton.classList.add('hidden');
        saveWeightThresholdButton.classList.remove('hidden');
        cancelWeightThresholdButton.classList.remove('hidden');
        weightThresholdInput.focus();
    } else {
        weightThresholdDisplay.classList.remove('hidden');
        weightThresholdInput.classList.add('hidden');
        editWeightThresholdButton.classList.remove('hidden');
        saveWeightThresholdButton.classList.add('hidden');
        cancelWeightThresholdButton.classList.add('hidden');
        weightThresholdInput.value = weightThresholdDisplay.textContent;
    }
}

async function loadDeviceStatus() {
    if (!deviceStatusIndicator) return;

    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/status`, {
            headers: authHeaders
        });

        if (!response.ok) throw new Error('Failed to load device status');

        const data = await response.json();
        const isConnected = data.mqtt_connected === true || data.wifi_connected === true;

        clearElement(deviceStatusIndicator);
        deviceStatusIndicator.appendChild(createElement('span', {
            className: `w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`
        }));
        deviceStatusIndicator.appendChild(createElement('span', {
            className: `text-sm ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`,
            textContent: isConnected ? 'Connected' : 'Disconnected'
        }));
    } catch (error) {
        if (deviceStatusIndicator) {
            clearElement(deviceStatusIndicator);
            deviceStatusIndicator.appendChild(createElement('span', {
                className: 'w-2 h-2 rounded-full bg-red-500'
            }));
            deviceStatusIndicator.appendChild(createElement('span', {
                className: 'text-sm text-red-600 dark:text-red-400',
                textContent: 'Error'
            }));
        }
    }
}

// Notification Functions

async function loadEmailConfig() {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/config/EMAIL_NOTIFICATIONS`, {
            headers: authHeaders
        });

        if (!response.ok) throw new Error('Failed to load email config');

        const data = await response.json();
        const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;

        currentEmailConfig = config;

        // Set notifications toggle
        setToggleState(notificationsToggle, config.enabled || false);

        // Show/hide email section
        if (config.enabled) {
            emailSection.classList.remove('hidden');
        } else {
            emailSection.classList.add('hidden');
        }

        // Set email input
        emailInput.value = config.email || '';

        // Set preferences
        const preferences = config.preferences || {
            pet_ate: false,
            feedings: true,
            failures: true
        };

        setToggleState(petAteToggle, preferences.pet_ate);
        setToggleState(feedingsToggle, preferences.feedings);

    } catch (error) {
        if (window.ErrorHandler) {
            window.ErrorHandler.handle(error, 'loadEmailConfig');
        }
    }
}

async function saveEmailConfig(updatedConfig) {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/config/EMAIL_NOTIFICATIONS`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ value: JSON.stringify(updatedConfig) })
        });

        if (!response.ok) throw new Error('Failed to save email config');

        currentEmailConfig = updatedConfig;
        return true;
    } catch (error) {
        throw error;
    }
}

async function toggleNotifications() {
    const currentEnabled = notificationsToggle.getAttribute('data-enabled') === 'true';
    const newEnabled = !currentEnabled;

    try {
        const updatedConfig = {
            ...currentEmailConfig,
            enabled: newEnabled
        };

        await saveEmailConfig(updatedConfig);
        setToggleState(notificationsToggle, newEnabled);

        if (newEnabled) {
            emailSection.classList.remove('hidden');
        } else {
            emailSection.classList.add('hidden');
        }
    } catch (error) {
        alert(`Failed to toggle notifications: ${error.message}`);
    }
}

async function saveEmail() {
    const email = emailInput.value.trim();
    const validation = Validators.email(email);
    if (!validation.valid) {
        showFieldError(emailInput, validation.message);
        return;
    }
    clearFieldError(emailInput);

    try {
        saveEmailButton.disabled = true;
        saveEmailButton.textContent = 'Saving...';
        emailStatus.classList.add('hidden');

        // First, subscribe to SNS
        const authHeaders = await auth.getAuthHeaders();
        const subscribeResponse = await fetch(`${getApiBaseUrl()}/api/v1/notifications/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ email })
        });

        if (!subscribeResponse.ok) throw new Error('Failed to subscribe to notifications');

        const subscribeData = await subscribeResponse.json();

        // Update email config
        const updatedConfig = {
            ...currentEmailConfig,
            email,
            subscription_arn: subscribeData.subscription_arn
        };

        await saveEmailConfig(updatedConfig);

        emailStatus.textContent = subscribeData.message;
        emailStatus.classList.remove('hidden');
        emailStatus.classList.add('text-green-600', 'dark:text-green-400');

    } catch (error) {
        emailStatus.textContent = `Error: ${error.message}`;
        emailStatus.classList.remove('hidden');
        emailStatus.classList.add('text-red-600', 'dark:text-red-400');
    } finally {
        saveEmailButton.disabled = false;
        saveEmailButton.textContent = 'Save Email';
    }
}

async function togglePreference(type) {
    const toggle = type === 'pet_ate' ? petAteToggle : feedingsToggle;
    const currentEnabled = toggle.getAttribute('data-enabled') === 'true';
    const newEnabled = !currentEnabled;

    try {
        const updatedConfig = {
            ...currentEmailConfig,
            preferences: {
                ...currentEmailConfig.preferences,
                [type]: newEnabled
            }
        };

        await saveEmailConfig(updatedConfig);
        setToggleState(toggle, newEnabled);
    } catch (error) {
        alert(`Failed to update preference: ${error.message}`);
    }
}

// Event Listeners

themeToggleButton.addEventListener('click', toggleTheme);

editDurationButton.addEventListener('click', () => toggleDurationEditMode(true));
saveDurationButton.addEventListener('click', saveDuration);
cancelDurationButton.addEventListener('click', () => toggleDurationEditMode(false));

editWeightThresholdButton.addEventListener('click', () => toggleWeightThresholdEditMode(true));
saveWeightThresholdButton.addEventListener('click', saveWeightThreshold);
cancelWeightThresholdButton.addEventListener('click', () => toggleWeightThresholdEditMode(false));

notificationsToggle.addEventListener('click', toggleNotifications);
saveEmailButton.addEventListener('click', saveEmail);

petAteToggle.addEventListener('click', () => togglePreference('pet_ate'));
feedingsToggle.addEventListener('click', () => togglePreference('feedings'));

// Initial Load

document.addEventListener('DOMContentLoaded', async () => {
    initializeTheme();

    const authInitialized = await auth.initAuth();
    if (!authInitialized) {
        return;
    }

    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl || apiBaseUrl.includes('PLACEHOLDER')) {
        alert('API not configured. Please update env-config.js');
        return;
    }

    await Promise.all([
        loadDuration(),
        loadWeightThreshold(),
        loadDeviceStatus(),
        loadEmailConfig()
    ]);
});
