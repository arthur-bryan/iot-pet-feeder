// public/js/schedules.js

// --- Imports ---
import { clearElement, createElement } from './dom-utils.js';
import { formatInUserTimezone } from './timezone-utils.js';
import { Validators } from './validation-utils.js';
import { FocusTrap } from './focus-trap.js';

// API_BASE_URL will be read from window.ENV
const getApiBaseUrl = () => window.ENV?.VITE_API_BASE_URL;

// --- Main App Elements ---
const schedulesContainer = document.getElementById('schedulesContainer');
const _loadingSchedules = document.getElementById('loadingSchedules');
const paginationContainer = document.getElementById('paginationContainer');
const prevPageButton = document.getElementById('prevPageButton');
const nextPageButton = document.getElementById('nextPageButton');
const pageInfo = document.getElementById('pageInfo');
const addScheduleButton = document.getElementById('addScheduleButton');
const themeToggleButton = document.getElementById('themeToggleButton');
const _sunIcon = document.getElementById('sunIcon');
const _moonIcon = document.getElementById('moonIcon');
const timezoneLabel = document.getElementById('timezoneLabel');

// --- Modal Elements ---
const scheduleModal = document.getElementById('scheduleModal');
const modalTitle = document.getElementById('modalTitle');
const closeModalButton = document.getElementById('closeModalButton');
const scheduleForm = document.getElementById('scheduleForm');
const scheduleDate = document.getElementById('scheduleDate');
const scheduleTime = document.getElementById('scheduleTime');
const feedCycles = document.getElementById('feedCycles');
const recurrence = document.getElementById('recurrence');
const cancelButton = document.getElementById('cancelButton');
const saveScheduleButton = document.getElementById('saveScheduleButton');

// --- Confirmation Modal Elements ---
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const cancelConfirmButton = document.getElementById('cancelConfirmButton');
const confirmActionButton = document.getElementById('confirmActionButton');

// --- Pagination State ---
const ITEMS_PER_PAGE = 20;
let currentPage = 1;
let totalPages = 1;
let hasNextPage = false;
let editingScheduleId = null;

// --- Helper Functions ---

function toggleTheme() {
    Theme.toggle();
}

function initializeTheme() {
    Theme.initialize();
}

function formatDateTime(isoString) {
    try {
        // Use timezone utility function from timezone-utils.js
        return formatInUserTimezone(isoString, 'datetime');
    } catch (e) {
        return isoString;
    }
}

function getRecurrenceBadge(recurrence) {
    const badges = {
        'none': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">One-time</span>',
        'daily': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">Daily</span>'
    };
    return badges[recurrence] || badges['none'];
}

function showScheduleModal(scheduleData = null) {
    if (scheduleData) {
        // Edit mode
        modalTitle.textContent = 'Edit Schedule';
        editingScheduleId = scheduleData.schedule_id;

        // Convert UTC time to user's timezone
        const localDateTime = getLocalDateTimeFromUTC(scheduleData.scheduled_time);
        scheduleDate.value = localDateTime.date;
        scheduleTime.value = localDateTime.time;
        feedCycles.value = scheduleData.feed_cycles;
        recurrence.value = scheduleData.recurrence;
    } else {
        // Add mode
        modalTitle.textContent = 'Add Schedule';
        editingScheduleId = null;
        scheduleForm.reset();

        // Set default date/time to current time in user's timezone
        const now = new Date();
        const localDateTime = getLocalDateTimeFromUTC(now.toISOString());
        scheduleDate.value = localDateTime.date;
        scheduleTime.value = localDateTime.time;
        feedCycles.value = 1;
    }

    scheduleModal.classList.remove('hidden');
}

function hideScheduleModal() {
    scheduleModal.classList.add('hidden');
    editingScheduleId = null;
    scheduleForm.reset();
}

function showConfirmModal(title, message, onConfirm) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;

    // Remove old event listeners and add new one
    const newConfirmButton = confirmActionButton.cloneNode(true);
    confirmActionButton.parentNode.replaceChild(newConfirmButton, confirmActionButton);

    newConfirmButton.addEventListener('click', () => {
        onConfirm();
        hideConfirmModal();
    });

    confirmModal.classList.remove('hidden');
}

function hideConfirmModal() {
    confirmModal.classList.add('hidden');
}

// --- API Calls ---

function createSchedulesLoadingState() {
    const container = createElement('div', { className: 'py-12 text-center' });
    const spinner = createElement('div', { className: 'animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4' });
    spinner.innerHTML = `<svg fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>`;
    container.appendChild(spinner);
    container.appendChild(createElement('p', {
        className: 'text-sm text-gray-500 dark:text-gray-400',
        textContent: 'Loading schedules...'
    }));
    return container;
}

function createSchedulesEmptyState() {
    const container = createElement('div', { className: 'py-12 text-center' });
    const icon = createElement('div', { className: 'w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4' });
    icon.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>`;
    container.appendChild(icon);
    container.appendChild(createElement('p', {
        className: 'text-gray-500 dark:text-gray-400 font-medium',
        textContent: 'No schedules yet'
    }));
    container.appendChild(createElement('p', {
        className: 'text-sm text-gray-400 dark:text-gray-500 mt-1',
        textContent: 'Click "Add Schedule" to create your first feeding schedule'
    }));
    return container;
}

function createSchedulesErrorState(errorMessage) {
    const container = createElement('div', { className: 'py-12 text-center' });
    const icon = createElement('div', { className: 'w-16 h-16 text-red-300 dark:text-red-600 mx-auto mb-4' });
    icon.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>`;
    container.appendChild(icon);
    container.appendChild(createElement('p', {
        className: 'text-red-600 dark:text-red-400 font-medium',
        textContent: 'Error loading schedules'
    }));
    container.appendChild(createElement('p', {
        className: 'text-sm text-gray-500 dark:text-gray-400 mt-1',
        textContent: errorMessage
    }));
    return container;
}

async function fetchSchedules(page = 1) {
    try {
        clearElement(schedulesContainer);
        schedulesContainer.appendChild(createSchedulesLoadingState());

        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/schedules?page=${page}&page_size=${ITEMS_PER_PAGE}`, {
            headers: authHeaders
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        clearElement(schedulesContainer);

        if (data.schedules && data.schedules.length > 0) {
            data.schedules.forEach(schedule => {
                const scheduleCard = createScheduleCard(schedule);
                schedulesContainer.appendChild(scheduleCard);
            });

            currentPage = data.page;
            hasNextPage = data.has_next;
            totalPages = Math.ceil(data.total / ITEMS_PER_PAGE);

            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            prevPageButton.disabled = currentPage === 1;
            nextPageButton.disabled = !hasNextPage;
            paginationContainer.classList.remove('hidden');
        } else {
            schedulesContainer.appendChild(createSchedulesEmptyState());
            paginationContainer.classList.add('hidden');
        }

    } catch (error) {
        clearElement(schedulesContainer);
        schedulesContainer.appendChild(createSchedulesErrorState(error.message));
    }
}

function createScheduleCard(schedule) {
    const card = createElement('div', {
        className: `bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all ${!schedule.enabled ? 'opacity-60' : ''}`
    });

    const wrapper = createElement('div', { className: 'flex items-start justify-between' });

    // Left content
    const leftContent = createElement('div', { className: 'flex-1' });

    // Header row with time and recurrence badge
    const headerRow = createElement('div', { className: 'flex items-center gap-3 mb-2' });
    const timeContainer = createElement('div', { className: 'flex items-center gap-2' });

    const clockIcon = createElement('div', {
        className: `w-5 h-5 ${schedule.enabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-600'}`
    });
    clockIcon.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>`;
    timeContainer.appendChild(clockIcon);

    timeContainer.appendChild(createElement('span', {
        className: 'font-semibold text-gray-900 dark:text-white',
        textContent: formatDateTime(schedule.scheduled_time)
    }));
    headerRow.appendChild(timeContainer);

    // Recurrence badge
    const recurrenceBadgeContainer = createElement('span');
    recurrenceBadgeContainer.innerHTML = getRecurrenceBadge(schedule.recurrence);
    headerRow.appendChild(recurrenceBadgeContainer);
    leftContent.appendChild(headerRow);

    // Info row with cycles and requested by
    const infoRow = createElement('div', { className: 'flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2' });

    const cyclesContainer = createElement('div', { className: 'flex items-center gap-1' });
    const cyclesIcon = createElement('div', { className: 'w-4 h-4' });
    cyclesIcon.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>`;
    cyclesContainer.appendChild(cyclesIcon);
    cyclesContainer.appendChild(createElement('span', {
        textContent: `${schedule.feed_cycles} cycle${schedule.feed_cycles > 1 ? 's' : ''}`
    }));
    infoRow.appendChild(cyclesContainer);

    const userContainer = createElement('div', { className: 'flex items-center gap-1' });
    const userIcon = createElement('div', { className: 'w-4 h-4' });
    userIcon.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
    </svg>`;
    userContainer.appendChild(userIcon);
    userContainer.appendChild(createElement('span', { textContent: schedule.requested_by }));
    infoRow.appendChild(userContainer);
    leftContent.appendChild(infoRow);

    // Created date
    leftContent.appendChild(createElement('div', {
        className: 'text-xs text-gray-400 dark:text-gray-500',
        textContent: `Created: ${formatDateTime(schedule.created_at)}`
    }));

    wrapper.appendChild(leftContent);

    // Right controls
    const rightControls = createElement('div', { className: 'flex flex-col sm:flex-row items-end sm:items-center gap-2 ml-2 sm:ml-4' });

    // Toggle button
    const toggleButton = createElement('button', {
        className: `toggle-button relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${schedule.enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`
    });
    toggleButton.appendChild(createElement('span', { className: 'sr-only', textContent: 'Toggle schedule' }));
    toggleButton.appendChild(createElement('span', {
        className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${schedule.enabled ? 'translate-x-6' : 'translate-x-1'}`
    }));
    toggleButton.addEventListener('click', () => toggleSchedule(schedule.schedule_id, !schedule.enabled));
    rightControls.appendChild(toggleButton);

    // Action buttons
    const actionButtons = createElement('div', { className: 'flex items-center gap-1' });

    // Edit button
    const editButton = createElement('button', {
        className: 'edit-button p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors',
        attributes: { title: 'Edit schedule' }
    });
    editButton.innerHTML = `<svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
    </svg>`;
    editButton.addEventListener('click', () => showScheduleModal(schedule));
    actionButtons.appendChild(editButton);

    // Delete button
    const deleteButton = createElement('button', {
        className: 'delete-button p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors',
        attributes: { title: 'Delete schedule' }
    });
    deleteButton.innerHTML = `<svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>`;
    deleteButton.addEventListener('click', () => confirmDeleteSchedule(schedule.schedule_id));
    actionButtons.appendChild(deleteButton);

    rightControls.appendChild(actionButtons);
    wrapper.appendChild(rightControls);
    card.appendChild(wrapper);

    return card;
}

async function createSchedule(scheduleData) {
    const authHeaders = await auth.getAuthHeaders();
    const response = await fetch(`${getApiBaseUrl()}/api/v1/schedules`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders
        },
        body: JSON.stringify(scheduleData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

async function updateSchedule(scheduleId, scheduleData) {
    const authHeaders = await auth.getAuthHeaders();
    const response = await fetch(`${getApiBaseUrl()}/api/v1/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders
        },
        body: JSON.stringify(scheduleData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

async function toggleSchedule(scheduleId, enabled) {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/schedules/${scheduleId}/toggle?enabled=${enabled}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await fetchSchedules(currentPage);
    } catch (error) {
        alert(`Failed to ${enabled ? 'enable' : 'disable'} schedule: ${error.message}`);
    }
}

async function deleteSchedule(scheduleId) {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/schedules/${scheduleId}`, {
            method: 'DELETE',
            headers: authHeaders
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await fetchSchedules(currentPage);
    } catch (error) {
        alert(`Failed to delete schedule: ${error.message}`);
    }
}

function confirmDeleteSchedule(scheduleId) {
    showConfirmModal(
        'Delete Schedule',
        'Are you sure you want to delete this schedule? This action cannot be undone.',
        () => deleteSchedule(scheduleId)
    );
}

// --- Event Listeners ---

addScheduleButton.addEventListener('click', () => showScheduleModal());
closeModalButton.addEventListener('click', hideScheduleModal);
cancelButton.addEventListener('click', hideScheduleModal);
cancelConfirmButton.addEventListener('click', hideConfirmModal);
themeToggleButton.addEventListener('click', toggleTheme);

scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    clearFormErrors(scheduleForm);

    const dateValue = scheduleDate.value;
    const timeValue = scheduleTime.value;
    const cyclesValue = feedCycles.value;
    const recurrenceValue = recurrence.value;

    const validations = [
        {
            element: scheduleDate,
            validator: Validators.required,
            args: [dateValue, 'Date']
        },
        {
            element: scheduleTime,
            validator: Validators.required,
            args: [timeValue, 'Time']
        },
        {
            element: feedCycles,
            validator: Validators.integerInRange,
            args: [cyclesValue, 1, 10, 'Feed cycles']
        },
        {
            element: recurrence,
            validator: Validators.oneOf,
            args: [recurrenceValue, ['none', 'daily'], 'Recurrence']
        }
    ];

    // Only validate future date for new schedules
    if (!editingScheduleId) {
        validations.push({
            element: scheduleDate,
            validator: Validators.futureDate,
            args: [dateValue, timeValue, true]
        });
    }

    const validation = validateForm(validations);
    if (!validation.valid) {
        return;
    }

    const scheduledTime = convertToUTC(dateValue, timeValue);

    const session = await auth.getCurrentSession();
    const requestedBy = session?.email || "web_user";

    const scheduleData = {
        scheduled_time: scheduledTime,
        feed_cycles: parseInt(cyclesValue, 10),
        recurrence: recurrenceValue,
        requested_by: requestedBy,
        enabled: true
    };

    try {
        saveScheduleButton.disabled = true;
        saveScheduleButton.textContent = 'Saving...';

        if (editingScheduleId) {
            await updateSchedule(editingScheduleId, scheduleData);
        } else {
            await createSchedule(scheduleData);
        }

        hideScheduleModal();
        await fetchSchedules(currentPage);
    } catch (error) {
        alert(`Failed to save schedule: ${error.message}`);
    } finally {
        saveScheduleButton.disabled = false;
        saveScheduleButton.textContent = 'Save Schedule';
    }
});

prevPageButton.addEventListener('click', () => {
    if (currentPage > 1) {
        fetchSchedules(currentPage - 1);
    }
});

nextPageButton.addEventListener('click', () => {
    if (hasNextPage) {
        fetchSchedules(currentPage + 1);
    }
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
    initializeTheme();

    // Setup focus trap for modal accessibility
    FocusTrap.setupAutoTrap('scheduleModal');
    FocusTrap.setupAutoTrap('confirmModal');

    const authInitialized = await auth.initAuth();
    if (!authInitialized) {
        return;
    }

    if (timezoneLabel) {
        const tzDisplay = getTimezoneDisplay();
        timezoneLabel.textContent = `(${tzDisplay})`;
    }

    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl || apiBaseUrl.includes('PLACEHOLDER')) {
        clearElement(schedulesContainer);
        schedulesContainer.appendChild(createSchedulesErrorState('API not configured. Please update env-config.js'));
        return;
    }

    await fetchSchedules(1);
});
