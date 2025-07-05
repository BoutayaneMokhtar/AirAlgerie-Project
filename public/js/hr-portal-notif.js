

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
document.addEventListener('DOMContentLoaded', () => {
    // Existing notification code...

    // Handle rapport notifications
    const rapportNotifIcon = document.querySelector('.rapport-notifications .notifications-icon');
    const rapportNotifWrapper = document.querySelector('.rapport-notifications');

    if (rapportNotifIcon && rapportNotifWrapper) {
        // Mark all rapports as read
        const markAllReadRapports = rapportNotifWrapper.querySelector('.mark-all-read-rapports');
        if (markAllReadRapports) {
            markAllReadRapports.addEventListener('click', function(e) {
                e.stopPropagation();
                fetch('/api/rapports/mark-all-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                .then(resp => resp.json())
                .then(data => {
                    if (data.success) {
                        // Update UI
                        const badge = rapportNotifWrapper.querySelector('.badge');
                        if (badge) badge.remove();
                        
                        document.querySelectorAll('.rapport-notifications .notification-item').forEach(item => {
                            item.classList.remove('unread');
                        });
                    }
                });
            });
        }

        // Toggle dropdown
        rapportNotifIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            rapportNotifWrapper.classList.toggle('active');
        });
    }

    // Mark single rapport as read when clicked
    document.addEventListener('click', (e) => {
        const viewRapportLink = e.target.closest('.view-rapport');
        if (viewRapportLink) {
            e.preventDefault();
            const rapportId = viewRapportLink.getAttribute('href').split('/').pop();
            
            // Mark as read
            fetch(`/api/rapports/${rapportId}/mark-read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }).then(() => {
                // Update UI
                const item = viewRapportLink.closest('.notification-item');
                if (item) {
                    item.classList.remove('unread');
                    // Update badge count
                    const badge = document.querySelector('.rapport-notifications .badge');
                    if (badge) {
                        const currentCount = parseInt(badge.textContent, 10) || 0;
                        if (currentCount > 1) {
                            badge.textContent = currentCount - 1;
                        } else {
                            badge.remove();
                        }
                    }
                }
                // Navigate to the rapport
                window.location.href = viewRapportLink.getAttribute('href');
            });
        }

        // Close dropdown when clicking outside
        if (!e.target.closest('.rapport-notifications')) {
            document.querySelectorAll('.rapport-notifications').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });

    // Refresh notifications every 30 seconds
    setInterval(() => {
        const badge = document.querySelector('.rapport-notifications .badge');
        if (badge) {
            fetch('/api/rapports/unread-count')
                .then(resp => resp.json())
                .then(data => {
                    if (data.count > 0) {
                        badge.textContent = data.count;
                    } else {
                        badge.remove();
                    }
                });
        }
    }, 30000);
});