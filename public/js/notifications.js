// Update markAllNotificationsAsRead to handle both types
async function markAllNotificationsAsRead() {
    try {
        const response = await fetch('/api/notifications/mark-all-read', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin'
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to mark notifications as read');
        }

        // Update UI
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            const icon = item.querySelector('.notification-icon');
            if (icon) {
                icon.style.backgroundColor = '#f5f6fa';
                icon.style.color = '#7f8c8d';
            }
        });
        
        // Update badge
        updateUnreadCount();
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        showNotification(error.message || 'Une erreur est survenue', 'error');
    }
}

// Update markNotificationAsRead to handle both types
async function markNotificationAsRead(type, id, element) {
    try {
        const endpoint = type === 'leave_request' 
            ? `/api/demandes/${id}/mark-read` 
            : `/api/rapports/${id}/mark-read`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin'
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to mark notification as read');
        }

        element.classList.remove('unread');
        const icon = element.querySelector('.notification-icon');
        if (icon) {
            icon.style.backgroundColor = '#f5f6fa';
            icon.style.color = '#7f8c8d';
        }
        updateUnreadCount();
    } catch (error) {
        console.error('Error marking notification as read:', error);
        showNotification(error.message || 'Erreur lors du marquage comme lu', 'error');
    }
}

// Update click handler
document.addEventListener('click', function(e) {
    // Handle notification item click
    const notificationItem = e.target.closest('.notification-item');
    if (notificationItem) {
        const type = notificationItem.dataset.type;
        const id = notificationItem.dataset.id;
        
        if (notificationItem.classList.contains('unread')) {
            markNotificationAsRead(type, id, notificationItem);
        }

        // Handle navigation based on notification type
        if (type === 'leave_request') {
            // Navigate to leave request details
            window.location.href = `/leave-request/${id}`;
        } else if (type === 'rapport') {
            // Navigate to report details
            window.location.href = `/rapports/${id}`;
        }
    }

    // Handle mark all as read button
    if (e.target.closest('.mark-all-read')) {
        markAllNotificationsAsRead();
    }
});

// Update the unread count badge
function updateUnreadCount() {
    const unreadCount = document.querySelectorAll('.notification-item.unread').length;
    const badge = document.querySelector('.notifications .badge');
    
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Create notification container if it doesn't exist
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    // Global notification function
    window.showNotification = function(message, type = 'success', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Create icon based on type
        const icon = document.createElement('i');
        icon.className = 'icon fas ' + getNotificationIcon(type);
        
        // Create message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.textContent = message;
        
        // Assemble notification
        notification.appendChild(icon);
        notification.appendChild(messageDiv);
        container.appendChild(notification);
        
        // Start animation
        requestAnimationFrame(() => {
            notification.style.animation = 'slideIn 0.3s ease-out forwards';
        });
        
        // Remove after duration
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    };

    function getNotificationIcon(type) {
        switch(type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-times-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }

    // Form submission handler
    const leaveForm = document.querySelector('.leave-form');
    if (leaveForm) {
        leaveForm.addEventListener('submit', function(e) {
            // Only show notification if it's an actual form submission
            if (!sessionStorage.getItem('preventNotification')) {
                showNotification('Demande soumise avec succès !', 'success');
            }
            // Only prevent default for AJAX submissions
            if (this.getAttribute('data-ajax') === 'true') {
                e.preventDefault();
            }
        });
    }

    // Add event listener for mark all as read button
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            markAllNotificationsAsRead();
        });
    }
    
    // Add click handler for notification items to mark as read when clicked
    document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', function(e) {
            // Don't mark as read if clicking on a link inside the notification
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                return;
            }
            
            const rapportId = this.getAttribute('data-rapport-id');
            if (rapportId && this.classList.contains('unread')) {
                markNotificationAsRead(rapportId, this);
            }
        });
    });
});
