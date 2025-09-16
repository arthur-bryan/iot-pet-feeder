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
closeModalButton.addEventListener('click', hideModal);

// --- Helper Functions ---
const isValidGuestName = name => /^[a-zA-Z0-9 _-]{2,32}$/.test(name);
const redirectTo = url => { window.location.href = url; };

// --- Guest Login Logic ---
const handleGuestLogin = () => {
    const guestName = guestNameInput.value.trim();
    if (!isValidGuestName(guestName)) {
        showModal('Invalid Name', 'Please enter a name with 2-32 characters, using only letters, numbers, spaces, hyphens, and underscores.');
        return;
    }
    sessionStorage.setItem('guestUserName', guestName);
    sessionStorage.removeItem('authenticatedUserEmail'); // Clear any previous auth state
    window.location.href = 'index.html'; // Use direct assignment for compatibility
};

// --- Google Login Logic ---
const handleGoogleLogin = async () => {
    // If Google login is not implemented, show modal
    showModal('Google Login', 'Google login is not implemented. Please use Guest Login.');
};

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    const storedGuestName = sessionStorage.getItem('guestUserName');
    if (storedGuestName) {
        window.location.href = 'index.html';
        return;
    }
    const authenticatedUser = sessionStorage.getItem('authenticatedUserEmail');
    if (authenticatedUser) {
        window.location.href = 'index.html';
        return;
    }
    guestNameInput.focus();
    guestLoginButton.addEventListener('click', handleGuestLogin);
    guestNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleGuestLogin();
        }
    });
    googleLoginButton.addEventListener('click', handleGoogleLogin);
});
