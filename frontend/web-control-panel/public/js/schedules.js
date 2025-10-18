// public/js/schedules.js

// API_BASE_URL will be read from window.ENV
const API_BASE_URL = window.ENV?.VITE_API_BASE_URL;

// --- Main App Elements ---
const schedulesContainer = document.getElementById('schedulesContainer');
const loadingSchedules = document.getElementById('loadingSchedules');
const paginationContainer = document.getElementById('paginationContainer');
const prevPageButton = document.getElementById('prevPageButton');
const nextPageButton = document.getElementById('nextPageButton');
const pageInfo = document.getElementById('pageInfo');
const addScheduleButton = document.getElementById('addScheduleButton');
const themeToggleButton = document.getElementById('themeToggleButton');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
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
    const html = document.documentElement;
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    if (newTheme === 'dark') {
        html.classList.add('dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        html.classList.remove('dark');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }

    localStorage.setItem('theme', newTheme);
}

function initializeTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    const html = document.documentElement;

    if (theme === 'dark') {
        html.classList.add('dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        html.classList.remove('dark');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
}

function formatDateTime(isoString) {
    try {
        // Use timezone utility function from timezone-utils.js
        return formatInUserTimezone(isoString, 'datetime');
    } catch (e) {
        console.error("Error formatting datetime:", isoString, e);
        return isoString;
    }
}

function getRecurrenceBadge(recurrence) {
    const badges = {
        'none': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">One-time</span>',
        'daily': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">Daily</span>',
        'weekly': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">Weekly</span>'
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

async function fetchSchedules(page = 1) {
    try {
        schedulesContainer.innerHTML = `
            <div class="py-12 text-center">
                <svg class="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-sm text-gray-500 dark:text-gray-400">Loading schedules...</p>
            </div>
        `;

        console.log(`Fetching schedules from: ${API_BASE_URL}/api/v1/schedules?page=${page}&page_size=${ITEMS_PER_PAGE}`);
        const response = await fetch(`${API_BASE_URL}/api/v1/schedules?page=${page}&page_size=${ITEMS_PER_PAGE}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("HTTP error fetching schedules:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Schedules received:", data);

        schedulesContainer.innerHTML = '';

        if (data.schedules && data.schedules.length > 0) {
            data.schedules.forEach(schedule => {
                const scheduleCard = createScheduleCard(schedule);
                schedulesContainer.appendChild(scheduleCard);
            });

            // Update pagination
            currentPage = data.page;
            hasNextPage = data.has_next;
            totalPages = Math.ceil(data.total / ITEMS_PER_PAGE);

            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            prevPageButton.disabled = currentPage === 1;
            nextPageButton.disabled = !hasNextPage;
            paginationContainer.classList.remove('hidden');
        } else {
            schedulesContainer.innerHTML = `
                <div class="py-12 text-center">
                    <svg class="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p class="text-gray-500 dark:text-gray-400 font-medium">No schedules yet</p>
                    <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Click "Add Schedule" to create your first feeding schedule</p>
                </div>
            `;
            paginationContainer.classList.add('hidden');
        }

    } catch (error) {
        console.error("Error fetching schedules:", error);
        schedulesContainer.innerHTML = `
            <div class="py-12 text-center">
                <svg class="w-16 h-16 text-red-300 dark:text-red-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p class="text-red-600 dark:text-red-400 font-medium">Error loading schedules</p>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${error.message}</p>
            </div>
        `;
    }
}

function createScheduleCard(schedule) {
    const card = document.createElement('div');
    card.className = `bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all ${!schedule.enabled ? 'opacity-60' : ''}`;

    card.innerHTML = `
        <div class="flex items-start justify-between">
            <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 ${schedule.enabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span class="font-semibold text-gray-900 dark:text-white">${formatDateTime(schedule.scheduled_time)}</span>
                    </div>
                    ${getRecurrenceBadge(schedule.recurrence)}
                </div>

                <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <div class="flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                        <span>${schedule.feed_cycles} cycle${schedule.feed_cycles > 1 ? 's' : ''}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        <span>${schedule.requested_by}</span>
                    </div>
                </div>

                <div class="text-xs text-gray-400 dark:text-gray-500">
                    Created: ${formatDateTime(schedule.created_at)}
                </div>
            </div>

            <div class="flex items-center gap-2 ml-4">
                <!-- Toggle Switch -->
                <button class="toggle-button relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${schedule.enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}" data-schedule-id="${schedule.schedule_id}" data-enabled="${schedule.enabled}">
                    <span class="sr-only">Toggle schedule</span>
                    <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${schedule.enabled ? 'translate-x-6' : 'translate-x-1'}"></span>
                </button>

                <!-- Edit Button -->
                <button class="edit-button p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" data-schedule='${JSON.stringify(schedule)}' title="Edit schedule">
                    <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                </button>

                <!-- Delete Button -->
                <button class="delete-button p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors" data-schedule-id="${schedule.schedule_id}" title="Delete schedule">
                    <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        </div>
    `;

    // Add event listeners
    const toggleButton = card.querySelector('.toggle-button');
    const editButton = card.querySelector('.edit-button');
    const deleteButton = card.querySelector('.delete-button');

    toggleButton.addEventListener('click', () => toggleSchedule(schedule.schedule_id, !schedule.enabled));
    editButton.addEventListener('click', () => showScheduleModal(schedule));
    deleteButton.addEventListener('click', () => confirmDeleteSchedule(schedule.schedule_id));

    return card;
}

async function createSchedule(scheduleData) {
    try {
        console.log("Creating schedule:", scheduleData);
        const response = await fetch(`${API_BASE_URL}/api/v1/schedules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scheduleData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error creating schedule:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Schedule created:", data);
        return data;
    } catch (error) {
        console.error("Error creating schedule:", error);
        throw error;
    }
}

async function updateSchedule(scheduleId, scheduleData) {
    try {
        console.log("Updating schedule:", scheduleId, scheduleData);
        const response = await fetch(`${API_BASE_URL}/api/v1/schedules/${scheduleId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scheduleData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error updating schedule:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Schedule updated:", data);
        return data;
    } catch (error) {
        console.error("Error updating schedule:", error);
        throw error;
    }
}

async function toggleSchedule(scheduleId, enabled) {
    try {
        console.log(`Toggling schedule ${scheduleId} to ${enabled}`);
        const response = await fetch(`${API_BASE_URL}/api/v1/schedules/${scheduleId}/toggle?enabled=${enabled}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error toggling schedule:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Schedule toggled:", data);

        // Refresh the list
        await fetchSchedules(currentPage);
    } catch (error) {
        console.error("Error toggling schedule:", error);
        alert(`Failed to ${enabled ? 'enable' : 'disable'} schedule: ${error.message}`);
    }
}

async function deleteSchedule(scheduleId) {
    try {
        console.log("Deleting schedule:", scheduleId);
        const response = await fetch(`${API_BASE_URL}/api/v1/schedules/${scheduleId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error deleting schedule:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log("Schedule deleted successfully");

        // Refresh the list
        await fetchSchedules(currentPage);
    } catch (error) {
        console.error("Error deleting schedule:", error);
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

    // Convert user's local time to UTC
    const dateValue = scheduleDate.value;
    const timeValue = scheduleTime.value;
    const scheduledTime = convertToUTC(dateValue, timeValue);

    const scheduleData = {
        scheduled_time: scheduledTime,
        feed_cycles: parseInt(feedCycles.value, 10),
        recurrence: recurrence.value,
        requested_by: "web_user", // You can replace this with actual user from auth
        enabled: true
    };

    try {
        saveScheduleButton.disabled = true;
        saveScheduleButton.textContent = 'Saving...';

        if (editingScheduleId) {
            // Update existing schedule
            await updateSchedule(editingScheduleId, scheduleData);
        } else {
            // Create new schedule
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
    console.log("=== Schedules Page DOMContentLoaded ===");

    initializeTheme();

    // Update timezone label to show user's selected timezone
    if (timezoneLabel) {
        const tzDisplay = getTimezoneDisplay();
        timezoneLabel.textContent = `(${tzDisplay})`;
        console.log(`Timezone label updated: ${tzDisplay}`);
    }

    // Validate API_BASE_URL
    if (!API_BASE_URL || API_BASE_URL.includes('PLACEHOLDER')) {
        console.error("❌ API_BASE_URL is not configured properly");
        schedulesContainer.innerHTML = `
            <div class="py-12 text-center">
                <svg class="w-16 h-16 text-red-300 dark:text-red-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p class="text-red-600 dark:text-red-400 font-medium">API Not Configured</p>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Please update env-config.js with your API Gateway URL</p>
            </div>
        `;
        return;
    }

    console.log("✅ API_BASE_URL validated:", API_BASE_URL);

    // Load schedules
    await fetchSchedules(1);

    console.log("✅ Schedules page initialization complete!");
});
