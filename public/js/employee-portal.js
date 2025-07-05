document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing...');
    
    // Navigation Management
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('.section');
    const pageTitle = document.getElementById('currentPageTitle');

    // Form submission handling
    const form = document.getElementById('leaveRequestForm');
    if (!form) {
        console.error('Form not found!');
        return;
    }

    // Prevent any default form submission
    form.setAttribute('novalidate', '');
    form.setAttribute('autocomplete', 'off');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        try {
            // Get form data
            const formData = new FormData(form);
            const data = {
                nature: formData.get('nature'),
                date_debut: formData.get('date_debut'),
                date_fin: formData.get('date_fin'),
                motif: formData.get('motif') || ''
            };

            // Validate required fields
            if (!data.nature) throw new Error('Veuillez sélectionner un type de congé');
            if (!data.date_debut) throw new Error('Veuillez sélectionner une date de début');
            if (!data.date_fin) throw new Error('Veuillez sélectionner une date de fin');

            // Add swipe-up animation
            const previewSection = document.querySelector('.preview-section');
            if (previewSection) {
                previewSection.classList.add('swipe-up');
            }

            // Wait for animation
            await new Promise(resolve => setTimeout(resolve, 600));

            // Submit form data
            const response = await fetch('/add-demande', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                // Show success notification
                showNotification(result.message || 'Demande de congé soumise avec succès!', 'success');
                
                // Reset form and preview
                form.reset();
                if (typeof resetPreview === 'function') {
                    resetPreview();
                }

                // Wait for notification to be visible (500ms) then redirect
                setTimeout(() => {
                    window.location.replace('/employee-portal');
                }, 500);
            } else {
                throw new Error(result.message || 'Erreur lors de la soumission');
            }

        } catch (error) {
            console.error('Error submitting form:', error);
            showNotification(error.message || 'Échec de la soumission de la demande. Veuillez réessayer.', 'error');
        } finally {
            // Remove animation class
            const previewSection = document.querySelector('.preview-section');
            if (previewSection) {
                previewSection.classList.remove('swipe-up');
            }
        }
    });

    // Prevent form from submitting on enter key
    form.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    // Navigation handling
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = link.getAttribute('data-section');

            // Update active states
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetSection) {
                    section.classList.add('active');
                    pageTitle.textContent = link.querySelector('span').textContent;

                    // Load section-specific data
                    if (targetSection === 'leave-requests') {
                        console.log('Loading leave requests...');
                        loadLeaveRequests();
                    } else if (targetSection === 'history') {
                        console.log('Loading history...');
                        loadHistory();
                    } else if (targetSection === 'documents') {
                        console.log('Loading documents...');
                        loadDocuments();
                    }
                }
            });
        });
    });

    // Profile picture upload handling
    const profilePicInput = document.getElementById('profilePictureInput');
    const profileImage = document.getElementById('profileImage');

    if (profilePicInput && profileImage) {
        profilePicInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    profileImage.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Leave Status Tabs Logic
    const statusTabs = document.querySelectorAll('.leave-status-tabs .tab-btn');
    const tabContents = document.querySelectorAll('.leave-status-content .tab-content');
    statusTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            statusTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            tabContents.forEach(content => content.classList.remove('active'));
            if (this.dataset.status === '0') {
                document.getElementById('pending-content').classList.add('active');
            } else if (this.dataset.status === '1') {
                document.getElementById('approved-content').classList.add('active');
            } else if (this.dataset.status === '2') {
                document.getElementById('rejected-content').classList.add('active');
            }
        });
    });

    // Helper functions
    function getStatusText(status) {
        switch (status) {
            case 0: return 'En Attente';
            case 1: return 'Approuvé';
            case 2: return 'Refusé';
            default: return 'Inconnu';
        }
    }

    function calculateDuration(startDate, endDate) {
        const start = new Date(startDate.split('/').reverse().join('-'));
        const end = new Date(endDate.split('/').reverse().join('-'));
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // Calendar functionality
    class LeaveCalendar {
        constructor() {
            this.currentDate = new Date();
            this.init();
        }

        init() {
            this.renderCalendar();
            this.attachEventListeners();
        }

        attachEventListeners() {
            document.querySelector('.prev-month').addEventListener('click', () => this.changeMonth(-1));
            document.querySelector('.next-month').addEventListener('click', () => this.changeMonth(1));
        }

        changeMonth(delta) {
            this.currentDate.setMonth(this.currentDate.getMonth() + delta);
            this.renderCalendar();
        }

        renderCalendar() {
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();

            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);

            document.querySelector('.current-month').textContent =
                this.currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

            const calendarDays = document.getElementById('calendarDays');
            calendarDays.innerHTML = '';

            // Use only the demandes variable passed from the server
            let leaves = [];
            if (typeof demandes !== 'undefined' && Array.isArray(demandes)) {
                leaves = demandes;
            }
            // Debug: log demandes/leaves
            console.log('[LeaveCalendar] demandes/leaves:', leaves);

            // Add empty cells for days before the first day of the month
            for (let i = 0; i < firstDay.getDay(); i++) {
                calendarDays.appendChild(this.createDayElement());
            }

            // Add days of the month
            for (let day = 1; day <= lastDay.getDate(); day++) {
                const date = new Date(year, month, day);
                // Find leave(s) for this day
                let statusClass = '';
                for (const leave of leaves) {
                    // Parse leave date range
                    let start = leave.date_debut || leave.startDate;
                    let end = leave.date_fin || leave.endDate;
                    if (!start || !end) continue;
                    // Support both formats: yyyy-mm-dd or dd/mm/yyyy
                    let startDate = new Date(start.includes('/') ? start.split('/').reverse().join('-') : start);
                    let endDate = new Date(end.includes('/') ? end.split('/').reverse().join('-') : end);
                    if (date >= startDate && date <= endDate) {
                        if (leave.etat === 1 || leave.status === 'Approuvé') statusClass = 'approved';
                        else if (leave.etat === 0 || leave.status === 'En Attente') statusClass = 'pending';
                        else if (leave.etat === 2 || leave.status === 'Refusé') statusClass = 'rejected';
                        break; // Only one status per day (priority: first found)
                    }
                }
                if (statusClass) {
                    console.log(`[LeaveCalendar] Coloring day ${day}/${month+1}/${year} as ${statusClass}`);
                }
                calendarDays.appendChild(this.createDayElement(day, {
                    isToday: this.isToday(date),
                    isWeekend: this.isWeekend(date),
                    statusClass
                }));
            }
        }

        createDayElement(day = '', options = {}) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';

            if (day) {
                dayElement.textContent = day;
                if (options.statusClass) dayElement.classList.add(options.statusClass);
                if (options.isToday) dayElement.classList.add('today');
                if (options.isWeekend) dayElement.classList.add('weekend');
            } else {
                dayElement.classList.add('empty');
            }

            return dayElement;
        }

        isToday(date) {
            const today = new Date();
            return date.getDate() === today.getDate() &&
                date.getMonth() === today.getMonth() &&
                date.getFullYear() === today.getFullYear();
        }

        isWeekend(date) {
            const day = date.getDay();
            return day === 0 || day === 6;
        }
    }

    // Initialize calendar if calendar widget exists
    const calendarWidget = document.getElementById('calendarWidget');
    if (calendarWidget) {
        new LeaveCalendar();
    }

    // Notifications toggle
    const notificationsIcon = document.querySelector('.notifications-icon');
    const notificationsDropdown = document.querySelector('.notifications-dropdown');
    const notificationsWrapper = document.querySelector('.notifications');

    if (notificationsIcon && notificationsDropdown && notificationsWrapper) {
        notificationsIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationsWrapper.classList.toggle('active');
        });

        // Close notifications when clicking outside
        document.addEventListener('click', (e) => {
            if (!notificationsWrapper.contains(e.target)) {
                notificationsWrapper.classList.remove('active');
            }
        });

        // Mark all as read functionality
        const markAllReadBtn = document.querySelector('.mark-all-read');
        const badge = notificationsIcon.querySelector('.badge');
        
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
                        // Remove unread styling from all notifications
                        document.querySelectorAll('.notification-item.unread').forEach(item => {
                            item.classList.remove('unread');
                        });
                    }
                });
            });
        }
    }

    // Leave status tabs
    document.addEventListener('DOMContentLoaded', () => {
        const tabBtns = document.querySelectorAll('.tab-btn');
        
        // Ensure the first tab is active on page load
        if (tabBtns.length > 0) {
            tabBtns[0].classList.add('active');
            const firstTabContent = document.getElementById(`${tabBtns[0].textContent.trim().toLowerCase()}-content`);
            if (firstTabContent) {
                firstTabContent.style.display = 'block';
            }
        }
    
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove 'active' class from all buttons
                tabBtns.forEach(b => b.classList.remove('active'));
                // Add 'active' class to the clicked button
                btn.classList.add('active');
    
                // Hide all content sections
                const tabContents = document.querySelectorAll('.tab-content');
                tabContents.forEach(content => {
                    content.style.display = 'none';
                });
    
                // Show the content corresponding to the clicked button
                const targetContent = document.getElementById(`${btn.textContent.trim().toLowerCase()}-content`);
                if (targetContent) {
                    targetContent.style.display = 'block';
                }
            });
        });
    });
    
    // Initial data load
    console.log('Attempting to update leave balance...');
    try {
    updateLeaveBalance();
    } catch (error) {
        console.error('Error in updateLeaveBalance:', error);
    }
    
    console.log('Attempting to load leave requests...');
    try {
        loadLeaveRequests();
    } catch (error) {
        console.error('Error in loadLeaveRequests:', error);
    }

    // === Mes Documents Delete Button Logic ===
    document.querySelectorAll('.btn-delete-doc').forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const docId = button.getAttribute('data-id');
            showConfirmationPopup('Êtes-vous sûr de vouloir supprimer ce document ?', async () => {
                try {
                    const response = await fetch(`/delete-document/${docId}`, {
                        method: 'DELETE',
                        headers: { 'Accept': 'application/json' }
                    });
                    const data = await response.json();
                    if (data.success) {
                        showNotification(data.message || 'Document supprimé avec succès', 'success');
                        // Remove the document card from the DOM
                        const card = button.closest('.document-card');
                        if (card) {
                            card.style.opacity = '0';
                            setTimeout(() => card.remove(), 300);
                        }
                    } else {
                        throw new Error(data.message || 'Erreur lors de la suppression du document');
                    }
                } catch (error) {
                    showNotification(error.message || 'Erreur lors de la suppression du document', 'error');
                }
            });
        });
    });
});

document.addEventListener("DOMContentLoaded", function () {
    const table = document.getElementById("demandesTable");
    if (!table) return;

    const typeFilter = document.getElementById("typeFilter");
    const statutFilter = document.getElementById("statutFilter");
    const tbody = table.querySelector("tbody");
    const pagination = table.parentNode.querySelector(".pagination-controls");

    const rowsPerPage = 7;
    let currentPage = 1;
    let filteredRows = [];

    // Function to apply filters and update filteredRows
    function applyFilters() {
        const selectedType = typeFilter.value.toLowerCase();
        const selectedStatut = statutFilter.value.toLowerCase();

        // Filter rows with 'history-row' class only (as per your pagination script)
        const allRows = Array.from(tbody.querySelectorAll("tr.history-row"));

        filteredRows = allRows.filter(row => {
            if (row.cells.length < 5) return false; // Ensure enough cells

            const type = row.cells[1].textContent.trim().toLowerCase();
            const statutText = row.cells[4].textContent.trim().toLowerCase();

            const typeMatches = selectedType === "tous" || type === selectedType;
            const statutMatches = selectedStatut === "tous" || statutText.includes(selectedStatut);

            return typeMatches && statutMatches;
        });
    }

    // Function to render table rows based on current page and filteredRows
    function renderTable() {
        // Hide all 'history-row' rows first
        const allRows = Array.from(tbody.querySelectorAll("tr.history-row"));
        allRows.forEach(row => (row.style.display = "none"));

        // Calculate start and end indices for pagination
        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;

        // Show only the rows for the current page
        filteredRows.slice(start, end).forEach(row => (row.style.display = ""));
    }

    // Function to render pagination buttons
    function renderPagination() {
        pagination.innerHTML = "";
        const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
        if (totalPages <= 1) return;

        // Create pagination wrapper
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination';

        // Prev button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn prev-btn';
        prevBtn.disabled = currentPage === 1;
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Précédent';
        prevBtn.addEventListener('click', function () {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
                renderPagination();
            }
        });
        paginationDiv.appendChild(prevBtn);

        // Page numbers with ellipsis logic
        const pageNumbersDiv = document.createElement('div');
        pageNumbersDiv.className = 'page-numbers';
        if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
            btn.textContent = i;
                btn.className = 'page-number' + (i === currentPage ? ' active' : '');
                btn.setAttribute('data-page', i);
                btn.addEventListener('click', function () {
                currentPage = i;
                renderTable();
                renderPagination();
            });
                pageNumbersDiv.appendChild(btn);
            }
        } else {
            // Always show 1, 2, 3
            for (let i = 1; i <= 3; i++) {
                const btn = document.createElement('button');
                btn.className = 'page-number' + (i === currentPage ? ' active' : '');
                btn.textContent = i;
                btn.setAttribute('data-page', i);
                btn.addEventListener('click', function () {
                    currentPage = i;
                    renderTable();
                    renderPagination();
                });
                pageNumbersDiv.appendChild(btn);
        }
            // If currentPage is not in 1-3 or last, show ... and currentPage
            if (currentPage > 3 && currentPage < totalPages) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                pageNumbersDiv.appendChild(ellipsis);
                // Show current page
                const btn = document.createElement('button');
                btn.className = 'page-number active';
                btn.textContent = currentPage;
                btn.setAttribute('data-page', currentPage);
                btn.addEventListener('click', function () {
                    renderTable();
                    renderPagination();
                });
                pageNumbersDiv.appendChild(btn);
            } else if (currentPage >= totalPages) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                pageNumbersDiv.appendChild(ellipsis);
            }
            // Always show last page
            const btnLast = document.createElement('button');
            btnLast.className = 'page-number' + (currentPage === totalPages ? ' active' : '');
            btnLast.textContent = totalPages;
            btnLast.setAttribute('data-page', totalPages);
            btnLast.addEventListener('click', function () {
                currentPage = totalPages;
                renderTable();
                renderPagination();
            });
            pageNumbersDiv.appendChild(btnLast);
        }
        paginationDiv.appendChild(pageNumbersDiv);

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn next-btn';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.innerHTML = 'Suivant <i class="fas fa-chevron-right"></i>';
        nextBtn.addEventListener('click', function () {
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
                renderPagination();
            }
        });
        paginationDiv.appendChild(nextBtn);

        pagination.appendChild(paginationDiv);
    }

    // Main function to filter, reset page, and render table and pagination
    function updateTable() {
        applyFilters();
        currentPage = 1; // Reset to first page after filtering
        renderTable();
        renderPagination();
    }

    // Attach event listeners to filters
    typeFilter.addEventListener("change", updateTable);
    statutFilter.addEventListener("change", updateTable);

    // Initial load
    updateTable();
});

// Updated notification styling
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `modern-notification ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                type === 'error' ? 'fa-times-circle' : 
                type === 'warning' ? 'fa-exclamation-circle' : 'fa-info-circle';
    
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        </div>
        <button class="close-notification">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Add click handler for close button
    const closeBtn = notification.querySelector('.close-notification');
    closeBtn.addEventListener('click', () => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Function to update leave balance
function updateLeaveBalance() {
    const leaveBalanceElement = document.querySelector('.stat-details p');
    if (leaveBalanceElement) {
        const currentBalance = parseInt(leaveBalanceElement.textContent) || 0;
        leaveBalanceElement.textContent = `${currentBalance} jours`;
    }
}

// Function to load leave requests
async function loadLeaveRequests() {
    try {
        // Check if we're in a server restart scenario
        const isServerRestart = !document.querySelector('.activity-list');
        if (isServerRestart) {
            console.log('Server restart detected, skipping initial load');
            return;
        }

        // Use the window.demandes variable that's already available from the server
        if (typeof window.demandes !== 'undefined' && Array.isArray(window.demandes)) {
            updateLeaveRequestsUI(window.demandes);
            return;
        }

        // Fallback to API call if window.demandes is not available
        const response = await fetch('/api/leave-requests-by-month');
        if (!response.ok) {
            throw new Error('Failed to load leave requests');
        }
        const data = await response.json();
        // Update the UI with the leave requests data
        updateLeaveRequestsUI(data.requests);
    } catch (error) {
        console.error('Error loading leave requests:', error);
        // Only show notification if it's not the initial page load or server restart
        if (document.readyState === 'complete' && !document.querySelector('.activity-list')) {
            showNotification('Erreur lors du chargement des demandes', 'error');
        }
    }
}

// Function to update leave requests UI
function updateLeaveRequestsUI(requests) {
    const activityList = document.querySelector('.activity-list');
    if (!activityList) return;

    activityList.innerHTML = requests.map(request => `
        <div class="activity-item" data-id="${request.id}">
            <div class="activity-content">
                <div class="activity-icon ${request.etat === 1 ? 'approved' : (request.etat === 0 ? 'pending' : 'rejected')}">
                    <i class="fas ${request.etat === 1 ? 'fa-check-circle' : (request.etat === 0 ? 'fa-clock' : 'fa-times-circle')}"></i>
                </div>
                <div class="activity-details">
                    <h4>${request.etat === 1 ? 'Congé approuvé' : request.etat === 0 ? 'Nouvelle demande' : 'Demande refusée'}</h4>
                    <p>${request.nature}</p>
                    <small>
                        du ${new Date(request.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
                        au ${new Date(request.date_fin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
                    </small>
                </div>
            </div>
            ${request.etat === 0 ? `
                <button class="delete-demande" data-id="${request.id}" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            ` : ''}
        </div>
    `).join('');

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-demande').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling
            const demandeId = button.getAttribute('data-id');
            
            showConfirmationPopup('Êtes-vous sûr de vouloir supprimer cette demande ?', async () => {
            try {
                const response = await fetch(`/delete-demande/${demandeId}`, {
                    method: 'DELETE',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                const data = await response.json();

                if (data.success) {
                        // Show success notification
                        showNotification(data.message || 'Demande supprimée avec succès', 'success');
                        
                        // Wait for notification to be visible (500ms) then refresh the page
                    setTimeout(() => {
                            window.location.reload();
                        }, 500);
                } else {
                    throw new Error(data.message || 'Erreur lors de la suppression');
                }
            } catch (error) {
                console.error('Error deleting demande:', error);
                showNotification(error.message || 'Erreur lors de la suppression de la demande', 'error');
            }
        });
    });
    });
}

// Function to update stats
async function updateStats() {
    try {
        const response = await fetch('/api/stats');
        if (response.ok) {
            const stats = await response.json();
            
            // Update pending requests count
            const pendingCount = document.querySelector('.stat-card:nth-child(2) .stat-details p');
            if (pendingCount) {
                pendingCount.textContent = `${stats.pendingCount} demandes`;
            }
            
            // Update available days
            const availableDays = document.querySelector('.stat-card:nth-child(1) .stat-details p');
            if (availableDays) {
                availableDays.textContent = `${stats.availableDays} jours`;
            }
            
            // Update taken days
            const takenDays = document.querySelector('.stat-card:nth-child(3) .stat-details p');
            if (takenDays) {
                takenDays.textContent = `${stats.takenDays} jours`;
            }
        }
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Add CSS for improved hover animation and confirmation popup
const style = document.createElement('style');
style.textContent = `
    .activity-item {
        transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: center;
    }

    .activity-item:hover {
        transform: translateY(-2px) scale(1.01);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .activity-item .activity-content {
        transition: all 0.5s ease;
    }

    .activity-item:hover .activity-content {
        transform: translateX(5px);
    }

    .activity-item .delete-demande {
        opacity: 1;
        transition: all 0.5s ease;
        color: #f44336;
    }

    .activity-item .delete-demande:hover {
        color: #d32f2f;
        transform: scale(1.1);
    }

    .activity-item .activity-icon {
        transition: all 0.3s ease;
    }

    .activity-item:hover .activity-icon {
        transform: scale(1.1);
    }

    /* Confirmation Popup Styles */
    .confirmation-popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.9);
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
    }

    .confirmation-popup.show {
        opacity: 1;
        visibility: visible;
        transform: translate(-50%, -50%) scale(1);
    }

    .confirmation-popup .popup-content {
        text-align: center;
        margin-bottom: 1.5rem;
    }

    .confirmation-popup .popup-title {
        font-size: 1.25rem;
        color: #333;
        margin-bottom: 0.5rem;
    }

    .confirmation-popup .popup-message {
        color: #666;
        font-size: 0.95rem;
    }

    .confirmation-popup .popup-buttons {
        display: flex;
        justify-content: center;
        gap: 1rem;
    }

    .confirmation-popup button {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .confirmation-popup .confirm-btn {
        background: #f44336;
        color: white;
    }

    .confirmation-popup .confirm-btn:hover {
        background: #d32f2f;
        transform: translateY(-2px);
    }

    .confirmation-popup .cancel-btn {
        background: #e0e0e0;
        color: #333;
    }

    .confirmation-popup .cancel-btn:hover {
        background: #d0d0d0;
        transform: translateY(-2px);
    }

    .popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
    }

    .popup-overlay.show {
        opacity: 1;
        visibility: visible;
    }
`;
document.head.appendChild(style);

// Function to show confirmation popup
function showConfirmationPopup(message, onConfirm) {
    // Create popup elements
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    const popup = document.createElement('div');
    popup.className = 'confirmation-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <h3 class="popup-title">Confirmation</h3>
            <p class="popup-message">${message}</p>
        </div>
        <div class="popup-buttons">
            <button class="cancel-btn">Annuler</button>
            <button class="confirm-btn">Supprimer</button>
        </div>
    `;

    // Add to document
    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    // Show popup with animation
    setTimeout(() => {
        overlay.classList.add('show');
        popup.classList.add('show');
    }, 10);

    // Handle confirm button
    popup.querySelector('.confirm-btn').addEventListener('click', () => {
        hidePopup();
        onConfirm();
    });

    // Handle cancel button and overlay click
    const hidePopup = () => {
        overlay.classList.remove('show');
        popup.classList.remove('show');
        setTimeout(() => {
            overlay.remove();
            popup.remove();
        }, 300);
    };

    popup.querySelector('.cancel-btn').addEventListener('click', hidePopup);
    overlay.addEventListener('click', hidePopup);
}

// === Recent Activity Pagination ===
document.addEventListener('DOMContentLoaded', function () {
    const activityList = document.querySelector('.activity-list');
    const activityItems = activityList ? Array.from(activityList.querySelectorAll('.activity-item')) : [];
    const paginationContainer = document.querySelector('.activity-pagination-controls');
    const itemsPerPage = 3;
    let currentPage = 1;

    function renderActivityPage(page) {
        if (!activityItems.length) return;
        activityItems.forEach(item => item.style.display = 'none');
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        activityItems.slice(start, end).forEach(item => item.style.display = '');
    }

    function renderActivityPagination() {
        if (!paginationContainer) return;
        paginationContainer.innerHTML = '';
        const totalPages = Math.ceil(activityItems.length / itemsPerPage);
        if (totalPages <= 1) return;

        // Create pagination wrapper
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination';

        // Prev button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn prev-btn';
        prevBtn.disabled = currentPage === 1;
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Précédent';
        prevBtn.addEventListener('click', function () {
            if (currentPage > 1) {
                currentPage--;
                renderActivityPage(currentPage);
                renderActivityPagination();
            }
        });
        paginationDiv.appendChild(prevBtn);

        // Page numbers with ellipsis logic
        const pageNumbersDiv = document.createElement('div');
        pageNumbersDiv.className = 'page-numbers';
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.className = 'page-number' + (i === currentPage ? ' active' : '');
                btn.textContent = i;
                btn.setAttribute('data-page', i);
                btn.addEventListener('click', function () {
                    currentPage = i;
                    renderActivityPage(currentPage);
                    renderActivityPagination();
                });
                pageNumbersDiv.appendChild(btn);
            }
        } else {
            // Always show 1, 2, 3
            for (let i = 1; i <= 3; i++) {
                const btn = document.createElement('button');
                btn.className = 'page-number' + (i === currentPage ? ' active' : '');
                btn.textContent = i;
                btn.setAttribute('data-page', i);
                btn.addEventListener('click', function () {
                    currentPage = i;
                    renderActivityPage(currentPage);
                    renderActivityPagination();
                });
                pageNumbersDiv.appendChild(btn);
            }
            // If currentPage is not in 1-3 or last, show ... and currentPage
            if (currentPage > 3 && currentPage < totalPages) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                pageNumbersDiv.appendChild(ellipsis);
                // Show current page
                const btn = document.createElement('button');
                btn.className = 'page-number active';
                btn.textContent = currentPage;
                btn.setAttribute('data-page', currentPage);
                btn.addEventListener('click', function () {
                    renderActivityPage(currentPage);
                    renderActivityPagination();
                });
                pageNumbersDiv.appendChild(btn);
            } else if (currentPage >= totalPages) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                pageNumbersDiv.appendChild(ellipsis);
            }
            // Always show last page
            const btnLast = document.createElement('button');
            btnLast.className = 'page-number' + (currentPage === totalPages ? ' active' : '');
            btnLast.textContent = totalPages;
            btnLast.setAttribute('data-page', totalPages);
            btnLast.addEventListener('click', function () {
                currentPage = totalPages;
                renderActivityPage(currentPage);
                renderActivityPagination();
            });
            pageNumbersDiv.appendChild(btnLast);
        }
        paginationDiv.appendChild(pageNumbersDiv);

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn next-btn';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.innerHTML = 'Suivant <i class="fas fa-chevron-right"></i>';
        nextBtn.addEventListener('click', function () {
            if (currentPage < totalPages) {
                currentPage++;
                renderActivityPage(currentPage);
                renderActivityPagination();
            }
        });
        paginationDiv.appendChild(nextBtn);

        paginationContainer.appendChild(paginationDiv);
    }

    if (activityItems.length) {
        renderActivityPage(currentPage);
        renderActivityPagination();
    }
});



