document.addEventListener('DOMContentLoaded', () => {
    // Form handling
    const leaveForm = document.getElementById('leaveRequestForm');
    
    leaveForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get form values
        const formData = new FormData(leaveForm);
        const leaveType = formData.get('leaveType');
        const startDate = formData.get('startDate');
        const endDate = formData.get('endDate');
        const reason = formData.get('reason');

        // Validate dates
        if (new Date(startDate) > new Date(endDate)) {
            showNotification('La date de fin doit être postérieure à la date de début', 'error');
            return;
        }

        // Simulate form submission
        showNotification('Demande de congé soumise avec succès!', 'success');
        leaveForm.reset();

        // Add to recent requests (for demo)
        addNewRequest(leaveType, startDate, endDate);
    });

    // Notification system
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function getNotificationIcon(type) {
        switch(type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            default: return 'fa-info-circle';
        }
    }

    // Add new request to the list (for demo)
    function addNewRequest(type, startDate, endDate) {
        const requestsList = document.querySelector('.requests-list');
        const newRequest = document.createElement('div');
        newRequest.className = 'request-item pending';
        
        const formattedStartDate = new Date(startDate).toLocaleDateString('fr-FR');
        const formattedEndDate = new Date(endDate).toLocaleDateString('fr-FR');

        newRequest.innerHTML = `
            <div class="request-info">
                <h4>${type}</h4>
                <p>${formattedStartDate} - ${formattedEndDate}</p>
            </div>
            <span class="status">En Attente</span>
        `;

        requestsList.insertBefore(newRequest, requestsList.firstChild);
    }

    // Notifications badge counter
    let notificationCount = 3; // Initial value
    const badge = document.querySelector('.badge');
    const notificationsIcon = document.querySelector('.notifications');

    notificationsIcon.addEventListener('click', () => {
        notificationCount = 0;
        badge.textContent = notificationCount;
        showNotification('Toutes les notifications ont été lues', 'success');
    });

    // Add CSS for notifications
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        }

        .notification-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .notification.success i { color: var(--success-color); }
        .notification.error i { color: var(--danger-color); }
        .notification.info i { color: var(--primary-color); }

        .notification.fade-out {
            animation: slideOut 0.3s ease forwards;
        }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // Update stats on form submission (for demo)
    let availableDays = 15;
    const availableDaysElement = document.querySelector('.stat-card:first-child .stat-details p');

    leaveForm.addEventListener('submit', () => {
        const startDate = new Date(document.querySelector('input[name="startDate"]').value);
        const endDate = new Date(document.querySelector('input[name="endDate"]').value);
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        availableDays = Math.max(0, availableDays - daysDiff);
        availableDaysElement.textContent = `${availableDays} jours`;
    });
});
