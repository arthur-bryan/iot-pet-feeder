// Admin Panel JavaScript

// --- Imports ---
import { clearElement, createElement } from './dom-utils.js';
import { FocusTrap } from './focus-trap.js';

const getApiBaseUrl = () => window.ENV?.VITE_API_BASE_URL;

// Theme management
const themeToggleButton = document.getElementById('themeToggleButton');
const _sunIcon = document.getElementById('sunIcon');
const _moonIcon = document.getElementById('moonIcon');

function toggleTheme() {
    Theme.toggle();
}

function initializeTheme() {
    Theme.initialize();
}

// Modal management
function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmButton = document.getElementById('confirmActionButton');
    const _cancelButton = document.getElementById('cancelConfirmButton');

    confirmTitle.textContent = title;
    confirmMessage.textContent = message;

    // Remove old listeners
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    newConfirmButton.addEventListener('click', () => {
        onConfirm();
        hideConfirmModal();
    });

    modal.classList.remove('hidden');
}

function hideConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
}

function showMessage(title, message) {
    const modal = document.getElementById('messageModal');
    const messageTitle = document.getElementById('messageTitle');
    const messageText = document.getElementById('messageText');

    messageTitle.textContent = title;
    messageText.textContent = message;
    modal.classList.remove('hidden');
}

function hideMessage() {
    document.getElementById('messageModal').classList.add('hidden');
}

// API Functions
async function fetchPendingRequests() {
    const container = document.getElementById('pendingRequestsContainer');
    clearElement(container);
    container.appendChild(createEmptyElement('Loading...'));

    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/users/pending`, {
            headers: authHeaders
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        renderPendingRequests(data.requests || []);
    } catch (error) {
        clearElement(container);
        container.appendChild(createErrorElement(error.message));
    }
}

async function fetchUsers() {
    const container = document.getElementById('usersContainer');
    clearElement(container);
    container.appendChild(createEmptyElement('Loading...'));

    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/users`, {
            headers: authHeaders
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        renderUsers(data.users || []);
    } catch (error) {
        clearElement(container);
        container.appendChild(createErrorElement(error.message));
    }
}

async function approveRequest(requestId, email, _fullName) {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/users/approve/${requestId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Approval failed');
        }

        const result = await response.json();

        let messageText;
        if (result.email_sent) {
            messageText = `User ${email} has been approved!

✅ Welcome email sent successfully

The user will receive an email with:
• Temporary password and login instructions
• Link to the application

Next steps for the user:
1. Check email inbox (and spam folder)
2. Log in with temporary password
3. Change password on first login (required by Cognito)
4. Optionally enable feed notifications in Settings`;
        } else {
            messageText = `User ${email} has been approved!

⚠️ Email delivery failed

The user has been created in Cognito, but the welcome email could not be sent.

CRITICAL ACTION REQUIRED:
• Contact system administrator to retrieve the temporary password from CloudWatch Logs
• Temporary passwords are NOT stored - only visible in Lambda logs

The user needs the temporary password to complete first-time login.`;
        }

        showMessage(result.email_sent ? 'User Approved' : 'User Approved - Email Failed', messageText);

        // Refresh both lists
        await Promise.all([fetchPendingRequests(), fetchUsers()]);
    } catch (error) {
        showMessage('Error', `Failed to approve user: ${error.message}`);
    }
}

async function rejectRequest(requestId, email) {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/users/reject/${requestId}`, {
            method: 'POST',
            headers: authHeaders
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Rejection failed');
        }

        showMessage('Success', `Access request from ${email} has been rejected.`);
        await fetchPendingRequests();
    } catch (error) {
        showMessage('Error', `Failed to reject request: ${error.message}`);
    }
}

async function deleteUser(email) {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/users/${encodeURIComponent(email)}`, {
            method: 'DELETE',
            headers: authHeaders
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Deletion failed');
        }

        showMessage('Success', `User ${email} has been deleted.`);
        await fetchUsers();
    } catch (error) {
        showMessage('Error', `Failed to delete user: ${error.message}`);
    }
}

async function deleteAllEvents() {
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/feed-events`, {
            method: 'DELETE',
            headers: authHeaders
        });

        if (response.status === 403) {
            showMessage('Not Allowed', 'Delete all events is disabled in demo environment.');
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        showMessage('Success', `${data.deleted_count} feeding events deleted successfully.`);
    } catch (error) {
        showMessage('Error', `Failed to delete events: ${error.message}`);
    }
}

// Helper to create pending request card (safe DOM manipulation)
function createPendingRequestCard(request, onApprove, onReject) {
    const card = createElement('div', {
        className: 'bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800'
    });

    const wrapper = createElement('div', { className: 'flex items-start justify-between' });

    // Left content
    const leftContent = createElement('div', { className: 'flex-1' });

    // Header with name and badge
    const header = createElement('div', { className: 'flex items-center gap-2 mb-2' });
    header.appendChild(createElement('h3', {
        className: 'font-semibold text-gray-900 dark:text-white',
        textContent: request.full_name
    }));
    header.appendChild(createElement('span', {
        className: 'px-2 py-1 text-xs font-medium rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
        textContent: 'Pending'
    }));
    leftContent.appendChild(header);

    // Email
    leftContent.appendChild(createElement('p', {
        className: 'text-sm text-gray-600 dark:text-gray-400 mb-1',
        textContent: request.email
    }));

    // Request date
    const requestDate = new Date(request.requested_at).toLocaleString();
    leftContent.appendChild(createElement('p', {
        className: 'text-xs text-gray-500 dark:text-gray-500',
        textContent: `Requested: ${requestDate}`
    }));

    wrapper.appendChild(leftContent);

    // Buttons
    const buttonContainer = createElement('div', { className: 'flex gap-2 ml-4' });

    const approveBtn = createElement('button', {
        className: 'px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors',
        textContent: 'Approve'
    });
    approveBtn.addEventListener('click', () => onApprove(request));
    buttonContainer.appendChild(approveBtn);

    const rejectBtn = createElement('button', {
        className: 'px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors',
        textContent: 'Reject'
    });
    rejectBtn.addEventListener('click', () => onReject(request));
    buttonContainer.appendChild(rejectBtn);

    wrapper.appendChild(buttonContainer);
    card.appendChild(wrapper);

    return card;
}

// Render Functions
function renderPendingRequests(requests) {
    const container = document.getElementById('pendingRequestsContainer');
    const countElement = document.getElementById('pendingRequestsCount');

    if (countElement) {
        countElement.textContent = requests.length;
    }

    clearElement(container);

    if (requests.length === 0) {
        const emptyState = createElement('div', { className: 'py-12 text-center' });

        const iconWrapper = createElement('div', {
            className: 'w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4'
        });
        iconWrapper.innerHTML = `<svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
        </svg>`;
        emptyState.appendChild(iconWrapper);

        emptyState.appendChild(createElement('p', {
            className: 'text-sm font-medium text-gray-600 dark:text-gray-400',
            textContent: 'All caught up!'
        }));
        emptyState.appendChild(createElement('p', {
            className: 'text-xs text-gray-500 dark:text-gray-500 mt-1',
            textContent: 'No pending access requests at the moment'
        }));

        container.appendChild(emptyState);
        return;
    }

    requests.forEach(request => {
        const card = createPendingRequestCard(
            request,
            (req) => {
                showConfirmModal(
                    'Approve User',
                    `Are you sure you want to approve ${req.full_name} (${req.email})? A temporary password will be generated.`,
                    () => approveRequest(req.request_id, req.email, req.full_name)
                );
            },
            (req) => {
                showConfirmModal(
                    'Reject Request',
                    `Are you sure you want to reject the access request from ${req.email}?`,
                    () => rejectRequest(req.request_id, req.email)
                );
            }
        );
        container.appendChild(card);
    });
}

// Helper to create user card (safe DOM manipulation)
function createUserCard(user, currentUserEmail, onDelete) {
    const card = createElement('div', {
        className: 'bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700'
    });

    const createdDate = user.UserCreateDate ? new Date(user.UserCreateDate).toLocaleString() : 'N/A';
    const status = user.UserStatus || 'UNKNOWN';
    const isAdmin = user.Groups && user.Groups.includes('admin');
    const isSelf = user.Email === currentUserEmail;

    const statusColors = {
        'CONFIRMED': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
        'FORCE_CHANGE_PASSWORD': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
        'UNCONFIRMED': 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    };

    const wrapper = createElement('div', { className: 'flex items-start justify-between' });

    // Left content
    const leftContent = createElement('div', { className: 'flex-1' });

    // Header with email and badges
    const header = createElement('div', { className: 'flex items-center gap-2 mb-2' });
    header.appendChild(createElement('h3', {
        className: 'font-semibold text-gray-900 dark:text-white',
        textContent: user.Email
    }));
    header.appendChild(createElement('span', {
        className: `px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || statusColors['UNCONFIRMED']}`,
        textContent: status
    }));
    if (isAdmin) {
        header.appendChild(createElement('span', {
            className: 'px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
            textContent: 'Admin'
        }));
    }
    if (isSelf) {
        header.appendChild(createElement('span', {
            className: 'px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
            textContent: 'You'
        }));
    }
    leftContent.appendChild(header);

    leftContent.appendChild(createElement('p', {
        className: 'text-xs text-gray-500 dark:text-gray-500',
        textContent: `Created: ${createdDate}`
    }));

    wrapper.appendChild(leftContent);

    // Delete button (not for self)
    const buttonContainer = createElement('div', { className: 'flex gap-2 ml-4' });
    if (!isSelf) {
        const deleteBtn = createElement('button', {
            className: 'px-4 py-2 text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors',
            textContent: 'Delete'
        });
        deleteBtn.addEventListener('click', () => onDelete(user));
        buttonContainer.appendChild(deleteBtn);
    }
    wrapper.appendChild(buttonContainer);

    card.appendChild(wrapper);
    return card;
}

function renderUsers(users) {
    const container = document.getElementById('usersContainer');
    const totalCountElement = document.getElementById('totalUsersCount');
    const adminCountElement = document.getElementById('adminUsersCount');

    if (totalCountElement) {
        totalCountElement.textContent = users.length;
    }

    const adminCount = users.filter(user => user.Groups && user.Groups.includes('admin')).length;
    if (adminCountElement) {
        adminCountElement.textContent = adminCount;
    }

    clearElement(container);

    if (users.length === 0) {
        const emptyState = createElement('div', { className: 'py-12 text-center' });

        const iconWrapper = createElement('div', {
            className: 'w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4'
        });
        iconWrapper.innerHTML = `<svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>`;
        emptyState.appendChild(iconWrapper);

        emptyState.appendChild(createElement('p', {
            className: 'text-sm font-medium text-gray-600 dark:text-gray-400',
            textContent: 'No users yet'
        }));
        emptyState.appendChild(createElement('p', {
            className: 'text-xs text-gray-500 dark:text-gray-500 mt-1',
            textContent: 'Approve access requests to add users'
        }));

        container.appendChild(emptyState);
        return;
    }

    const currentUserEmail = auth.getCurrentSession()?.email || '';

    users.forEach(user => {
        const card = createUserCard(user, currentUserEmail, (u) => {
            showConfirmModal(
                'Delete User',
                `Are you sure you want to delete ${u.Email}? This action cannot be undone.`,
                () => deleteUser(u.Email)
            );
        });
        container.appendChild(card);
    });
}

// Event Listeners
themeToggleButton?.addEventListener('click', toggleTheme);
document.getElementById('cancelConfirmButton')?.addEventListener('click', hideConfirmModal);
document.getElementById('closeMessageButton')?.addEventListener('click', hideMessage);
document.getElementById('refreshPendingButton')?.addEventListener('click', fetchPendingRequests);
document.getElementById('refreshUsersButton')?.addEventListener('click', fetchUsers);

document.getElementById('deleteAllEventsButton')?.addEventListener('click', () => {
    showConfirmModal(
        'Delete ALL Feeding Events',
        '⚠️ WARNING: This will permanently delete ALL feeding events from the database!\n\nThis includes manual feeds, scheduled feeds, consumption events, and refills. This action cannot be undone.\n\nAre you absolutely sure?',
        deleteAllEvents
    );
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    initializeTheme();

    // Setup focus trap for modal accessibility
    FocusTrap.setupAutoTrap('confirmModal');
    FocusTrap.setupAutoTrap('messageModal');

    // Check authentication
    const authInitialized = await auth.initAuth();
    if (!authInitialized) {
        window.location.href = 'index.html';
        return;
    }

    // Check if user is admin
    try {
        const authHeaders = await auth.getAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/v1/users/pending`, {
            headers: authHeaders
        });

        if (!response.ok) {
            // User is not admin, redirect
            alert('Access denied. Admin privileges required.');
            window.location.href = 'index.html';
            return;
        }

        // Load data
        await Promise.all([fetchPendingRequests(), fetchUsers()]);
    } catch (error) {
        alert('Error checking admin access. Redirecting to dashboard.');
        window.location.href = 'index.html';
    }
});
