// Notification dropdown toggle for employee portal
// This code can be merged into employee-portal.js after validation

document.addEventListener('DOMContentLoaded', () => {
    const notifIcon = document.querySelector('.notifications-icon');
    const notifDropdown = document.querySelector('.notifications-dropdown');
    const notifWrapper = document.querySelector('.notifications');
    if (notifIcon && notifDropdown && notifWrapper) {
        // Mark all as read logic
        const markAllReadBtn = document.querySelector('.mark-all-read');
        const badge = notifIcon.querySelector('.badge');
        if (markAllReadBtn && badge) {
            markAllReadBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                fetch('/notifications/mark-all-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                .then(resp => resp.json())
                .then(data => {
                    if (data.success) {
                        badge.textContent = '0';
                    }
                });
            });
        }
        notifIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            notifWrapper.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (!notifWrapper.contains(e.target)) {
                notifWrapper.classList.remove('active');
            }
        });
    }
});
// Helper functions to set and get cookies
function setCookie(name, value, minutes) {
    const d = new Date();
    d.setTime(d.getTime() + minutes * 60 * 1000);
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

function getCookie(name) {
    const cookies = document.cookie.split(';').map(c => c.trim());
    for (const cookie of cookies) {
        if (cookie.startsWith(name + '=')) {
            return cookie.substring(name.length + 1);
        }
    }
    return null;
}

// Cookie helper functions
function setCookie(name, value, minutes) {
    const d = new Date();
    d.setTime(d.getTime() + minutes * 60 * 1000);
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

function getCookie(name) {
    const cookies = document.cookie.split(';').map(c => c.trim());
    for (const cookie of cookies) {
        if (cookie.startsWith(name + '=')) {
            return cookie.substring(name.length + 1);
        }
    }
    return null;
}


