// Manager Portal JavaScript
let teamManagementInstance; // Optional: if needed globally
let calendarInstance; // Optional: if needed globally

// Inject confirmation popup CSS for consistent style with employee portal
(function addConfirmationPopupStyles() {
    if (!document.getElementById('confirmation-popup-style')) {
        const style = document.createElement('style');
        style.id = 'confirmation-popup-style';
        style.textContent = `
        .confirmation-popup {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            background: white;
            padding: 2rem 2rem 1.5rem 2rem;
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
            margin-top: 0.2rem;
            font-weight: 600;
            /* Remove any animation or transform */
            transition: none;
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
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the calendar
    initializeTeamCalendar();
    
    // Initialize leave requests from server data
    if (window.leaveRequests) {
        const demandes = window.leaveRequests;
        // Filter requests for the current manager only
        const managerDemandes = demandes.filter(d => d.user_id === window.managerId);
        
        // Count manager's own requests
        let pending = managerDemandes.filter(d => d.etat === 0).length;
        let approved = managerDemandes.filter(d => d.etat === 1).length;
        let rejected = managerDemandes.filter(d => d.etat === 2).length;
        
        // Debug: Check what's in window
        console.log('Window object:', {
            teamStats: window.teamStats,
            pagination: window.pagination,
            managerId: window.managerId
        });

        // Update team stats if available
        updateTeamStats(window.teamStats);
        
        // Also check pagination as fallback
        if (window.pagination && window.pagination.totalEmployees !== undefined) {
            updateTeamStats({ totalMembers: window.pagination.totalEmployees });
        }
        
        const dashPendingRequestCount = document.getElementById('dashPendingRequestCount');
        if (dashPendingRequestCount) {
            dashPendingRequestCount.textContent = `${pending} demande${pending !== 1 ? 's' : ''}`;
        }

        // Calculate today's absences for team members
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day
        
        // Get all leave requests for team members (employees in manager's department)
        const teamAbsences = demandes.filter(d => {
            if (d.etat === 1) { // Only count approved leaves
                const startDate = new Date(d.date_debut);
                const endDate = new Date(d.date_fin);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
                return today >= startDate && today <= endDate;
            }
            return false;
        });
        
        const dashAbsentTodayCount = document.getElementById('dashAbsentTodayCount');
        if (dashAbsentTodayCount) {
            dashAbsentTodayCount.textContent = `${teamAbsences.length} employé${teamAbsences.length !== 1 ? 's' : ''}`;
        }

        // Initialize both sections with the data
        filterLeaveRequests();
        initializeLeaveApprovals();
        
        // Debug: Try to access team stats again after a short delay
        setTimeout(() => {
            console.log('Delayed window check:', {
                teamStats: window.teamStats,
                pagination: window.pagination
            });
            
            // Force update team stats if available
            if (window.teamStats) {
                updateTeamStats(window.teamStats);
            }
        }, 1000);
    }

    // --- Leave Requests Filtering ---
    ['searchLeave','typeFilter','leaveStatusFilter','dateFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', filterLeaveRequests);
    });

    const resetLeaveFiltersBtn = document.getElementById('resetLeaveFilters');
    if (resetLeaveFiltersBtn) resetLeaveFiltersBtn.addEventListener('click', () => {
        ['searchLeave','typeFilter','leaveStatusFilter','dateFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        filterLeaveRequests();
    });

    // Initialize other sections
    initializeNavigation();
    initializeCharts();
    initializeNotifications();
    initializeProfilePictureUpload();

    console.log("DOM fully loaded and parsed - Main Initializer Running"); // DEBUG

    // Initialize Calendar first
    if (document.getElementById('calendarDays') && document.getElementById('currentMonth')) {
        console.log("Initializing Standalone Calendar");
        try {
            calendarInstance = new Calendar();
            // Update calendar with manager's leave requests only
            if (window.leaveRequests) {
                const managerRequests = window.leaveRequests.filter(req => req.user_id === window.managerId);
                calendarInstance.render(managerRequests);
            }
        } catch(error) {
            console.error("Error initializing Calendar:", error);
        }
    } else {
         console.warn("Calendar elements (calendarDays/currentMonth) not found, skipping Calendar init.");
    }
    // --- DEBUG: Check global calendarInstance value BEFORE passing it ---
    console.log("DEBUG: Value of global calendarInstance before LeaveManagement init:", calendarInstance);

    

    // 3. Initialize Team Management
    if (document.getElementById('team-management')) {
        console.log("Initializing Team Management");
        try {
            teamManagementInstance = new TeamManagement();
            // Load employees from server-side data
            if (window.employeesFromServer) {
                teamManagementInstance.employees = window.employeesFromServer;
                teamManagementInstance.applyFilters(); // Initial render
            } else {
                console.warn("No employee data found from server");
            }
        } catch (error) {
            console.error("Error initializing Team Management:", error);
        }
    } else {
        console.warn("Team management section not found, skipping TeamManagement init.");
    }



    // Initialize other core functionalities (can run independently)
    initializeNavigation();
    initializeCharts();
    initializeNotifications();
    initializeProfilePictureUpload();

    // Initialize requests pagination
    window.requestsPagination = new RequestsPagination(5);
    
    // Initial setup with all requests
    if (window.leaveRequestsFromServer) {
        window.requestsPagination.setRequests(window.leaveRequestsFromServer);
    }

    // Initialize leave history section
    const leaveHistorySection = document.getElementById('leave-history');
    if (leaveHistorySection) {
        console.log('Initializing leave history section');
        const tableBody = leaveHistorySection.querySelector('tbody');
        const searchInput = leaveHistorySection.querySelector('#searchLeaveHistory');
        const typeFilter = leaveHistorySection.querySelector('#leaveTypeFilter');
        const statusFilter = leaveHistorySection.querySelector('#leaveStatusFilter');
        const monthFilter = leaveHistorySection.querySelector('#monthFilter');
        const resetFiltersBtn = leaveHistorySection.querySelector('.reset-filters');

        // Initialize pagination
        const itemsPerPage = 10;
        let currentPage = 1;
        let filteredData = window.leaveRequestsFromServer || [];

        function updateStats() {
            const stats = {
                total: filteredData.length,
                approved: 0,
                rejected: 0
            };

            filteredData.forEach(request => {
                if (request.etat === 1) stats.approved++;
                else if (request.etat === 2) stats.rejected++;
            });

            // Update the header stats with the exact structure
            const headerStats = leaveHistorySection.querySelector('.stats-grid');
            if (headerStats) {
                headerStats.innerHTML = `
                    <div class="stat-item">
                        <div class="stat-icon">
                            <i class="fas fa-calendar-check"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-value" id="totalLeavesCount">${stats.total}</span>
                            <span class="stat-label">Total</span>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon approved">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-value" id="approvedLeavesCount">${stats.approved}</span>
                            <span class="stat-label">Approuvés</span>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon rejected">
                            <i class="fas fa-times-circle"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-value" id="rejectedLeavesCount">${stats.rejected}</span>
                            <span class="stat-label">Refusés</span>
                        </div>
                    </div>
                `;
            }

            // Also update the individual elements by ID for redundancy
            const totalElement = document.getElementById('totalLeavesCount');
            const approvedElement = document.getElementById('approvedLeavesCount');
            const rejectedElement = document.getElementById('rejectedLeavesCount');

            if (totalElement) totalElement.textContent = stats.total;
            if (approvedElement) approvedElement.textContent = stats.approved;
            if (rejectedElement) rejectedElement.textContent = stats.rejected;
        }

        function filterData() {
            const searchTerm = (searchInput?.value || '').toLowerCase();
            const typeValue = typeFilter?.value || '';
            const statusValue = statusFilter?.value || '';
            const monthValue = monthFilter?.value || '';

            filteredData = window.leaveRequestsFromServer.filter(request => {
                let match = true;

                // Search filter
                if (searchTerm) {
                    const employeeName = request.employee_name?.toLowerCase() || '';
                    const employeeEmail = request.employee_email?.toLowerCase() || '';
                    if (!employeeName.includes(searchTerm) && !employeeEmail.includes(searchTerm)) {
                        match = false;
                    }
                }

                // Type filter
                if (typeValue && request.nature !== typeValue) {
                    match = false;
                }

                // Status filter
                if (statusValue) {
                    const statusMap = {
                        'En Attente': 0,
                        'Approuvé': 1,
                        'Refusé': 2
                    };
                    if (request.etat !== statusMap[statusValue]) {
                        match = false;
                    }
                }

                // Month filter
                if (monthValue) {
                    const requestDate = new Date(request.date_debut);
                    const requestMonth = requestDate.getMonth() + 1;
                    const requestYear = requestDate.getFullYear();
                    const [filterYear, filterMonth] = monthValue.split('-');
                    if (requestMonth !== parseInt(filterMonth) || requestYear !== parseInt(filterYear)) {
                        match = false;
                    }
                }

                return match;
            });

            currentPage = 1;
            renderTable();
            updatePagination();
            updateStats();
        }

        function renderTable() {
            if (!tableBody) return;
            
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageData = filteredData.slice(start, end);
            
            tableBody.innerHTML = '';
            
            if (pageData.length === 0) {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td colspan="5" class="no-data">Aucune demande de congé trouvée</td>';
                tableBody.appendChild(tr);
                return;
            }
            
            pageData.forEach(demande => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div class="employee-info">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(demande.employee_name)}" alt="${demande.employee_name}" class="employee-avatar">
                            <div class="employee-details">
                                <span class="employee-name">${demande.employee_name}</span>
                                <span class="employee-email">${demande.employee_email}</span>
                            </div>
                        </div>
                    </td>
                    <td>${demande.nature}</td>
                    <td>${demande.date_debut ? demande.date_debut.toString().slice(0,10) : ''}</td>
                    <td>${demande.date_fin ? demande.date_fin.toString().slice(0,10) : ''}</td>
                    <td>
                        ${demande.etat === 0 ? '<span class="status-badge pending">En Attente</span>' : 
                          demande.etat === 1 ? '<span class="status-badge approved">Approuvé</span>' : 
                          '<span class="status-badge rejected">Refusé</span>'}
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }

        function updatePagination() {
            const totalPages = Math.ceil(filteredData.length / itemsPerPage);
            const pageNumbers = document.getElementById('leaveHistoryPageNumbers');
            if (!pageNumbers) return;
            
            pageNumbers.innerHTML = '';
            
            // Previous button
            const prevButton = document.createElement('button');
            prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
            prevButton.className = 'pagination-btn prev-btn';
            prevButton.disabled = currentPage === 1;
            prevButton.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderTable();
                    updatePagination();
                }
            });
            pageNumbers.appendChild(prevButton);
            
            // Page numbers
            for (let i = 1; i <= totalPages; i++) {
                    const pageButton = document.createElement('button');
                    pageButton.textContent = i;
                pageButton.className = `page-number ${i === currentPage ? 'active' : ''}`;
                    pageButton.addEventListener('click', () => {
                        currentPage = i;
                        renderTable();
                        updatePagination();
                    });
                pageNumbers.appendChild(pageButton);
            }
            
            // Next button
            const nextButton = document.createElement('button');
            nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
            nextButton.className = 'pagination-btn next-btn';
            nextButton.disabled = currentPage === totalPages;
            nextButton.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderTable();
                    updatePagination();
                }
            });
            pageNumbers.appendChild(nextButton);

            // Add page info
            const pageInfo = document.createElement('div');
            pageInfo.className = 'page-info';
            pageInfo.textContent = `Affichage de ${(currentPage - 1) * itemsPerPage + 1} à ${Math.min(currentPage * itemsPerPage, filteredData.length)} sur ${filteredData.length} demandes`;
            pageNumbers.appendChild(pageInfo);
        }

        // Attach event listeners
        if (searchInput) searchInput.addEventListener('input', filterData);
        if (typeFilter) typeFilter.addEventListener('change', filterData);
        if (statusFilter) statusFilter.addEventListener('change', filterData);
        if (monthFilter) monthFilter.addEventListener('change', filterData);
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                if (typeFilter) typeFilter.value = '';
                if (statusFilter) statusFilter.value = '';
                if (monthFilter) monthFilter.value = '';
                filterData();
            });
        }

        // Initial render
        filterData();
    }

    // Handle leave request form submission
    const leaveRequestForm = document.getElementById('leaveRequestForm');
    if (leaveRequestForm) {
        leaveRequestForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                const formData = new FormData(this);
                const data = {
                    nature: formData.get('nature'),
                    date_debut: formData.get('date_debut'),
                    date_fin: formData.get('date_fin'),
                    motif: formData.get('motif')
                };
                
                // Log form data for debugging
                console.log('Form data being sent:', data);

                const response = await fetch('/add-demande', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                // Check if response is JSON
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const responseData = await response.json();
                    if (responseData.success) {
                        showNotification(responseData.message || 'Demande soumise avec succès !', 'success');
                        this.reset();
                        // Reload the page after a short delay to show updated data
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    } else {
                        throw new Error(responseData.message || 'Erreur lors de la soumission');
                    }
                } else {
                    // If not JSON, assume it's an error page
                    throw new Error('Erreur serveur. Veuillez réessayer.');
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                showNotification(error.message || 'Échec de la soumission de la demande. Veuillez réessayer.', 'error');
            }
        });
    }

    // === Mes Documents Delete Button Logic (Manager Portal) ===
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

// Navigation Management
function initializeNavigation() {
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('.section');
    const pageTitle = document.querySelector('.page-title');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            console.log(`[Navigation] Clicked: ${targetId}`);
            let found = false;

            // Update active states
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Show target section
            sections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.add('active');
                    found = true;
                    pageTitle.textContent = link.textContent.trim();
                    console.log(`[Navigation] Activated section: #${section.id}`);
                } else {
                    section.classList.remove('active');
                }
            });
            if (!found) {
                console.warn(`[Navigation] Section #${targetId} not found!`);
            }
        });
    });

    // Show default section only
    sections.forEach((section, idx) => {
        if (idx === 0) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });
}


// Charts Initialization
function initializeCharts() {
    // Team Performance Chart
    const teamPerformanceCtx = document.getElementById('teamPerformanceChart')?.getContext('2d');
    if (teamPerformanceCtx) {
        new Chart(teamPerformanceCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun'],
                datasets: [{
                    label: 'Performance',
                    data: [85, 88, 92, 90, 95, 92],
                    borderColor: '#1e3a8a',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    // Absence Rate Chart
    const absenceRateCtx = document.getElementById('absenceRateChart')?.getContext('2d');
    if (absenceRateCtx) {
        new Chart(absenceRateCtx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun'],
                datasets: [{
                    label: 'Taux d\'Absence',
                    data: [5, 4, 6, 3, 5, 4],
                    backgroundColor: '#c41e3a'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10
                    }
                }
            }
        });
    }

    // Leaves Trend Chart
    const leavesTrendCtx = document.getElementById('leavesTrendChart')?.getContext('2d');
    if (leavesTrendCtx) {
        new Chart(leavesTrendCtx, {
            type: 'line',
            data: {
                labels: ['1', '5', '10', '15', '20', '25', '30'],
                datasets: [{
                    label: 'Congés Approuvés',
                    data: [2, 5, 8, 12, 15, 18, 20],
                    borderColor: '#059669',
                    tension: 0.4,
                    fill: false
                }, {
                    label: 'Demandes en Attente',
                    data: [1, 3, 4, 6, 8, 9, 10],
                    borderColor: '#d97706',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Team Management
function initializeTeamManagement() {
    const teamMembers = [
        {
            name: 'Sarah Benali',
            position: 'Chef d\'Escale',
            department: 'Opérations',
            status: 'active',
            performance: 92,
            presence: 95
        },
        {
            name: 'Mohamed Kaci',
            position: 'Pilote Senior',
            department: 'Opérations',
            status: 'leave',
            performance: 88,
            presence: 90
        },
        {
            name: 'Amina Hadj',
            position: 'Technicienne',
            department: 'Maintenance',
            status: 'training',
            performance: 85,
            presence: 88
        }
    ];

    const teamGrid = document.querySelector('.team-grid');
    if (!teamGrid) return;

    // Clear existing content except the first card (template)
    const template = teamGrid.children[0];
    teamGrid.innerHTML = '';

    // Add team members
    teamMembers.forEach(member => {
        const card = template.cloneNode(true);
        
        // Update member info
        card.querySelector('.member-status').className = `member-status ${member.status}`;
        card.querySelector('img').src = `https://ui-avatars.com/api/?name=${member.name.replace(' ', '+')}`;
        card.querySelector('.member-info h3').textContent = member.name;
        card.querySelector('.member-info p').textContent = member.position;
        card.querySelector('.member-info .department').textContent = member.department;
        
        // Update metrics
        const metrics = card.querySelectorAll('.progress');
        metrics[0].style.width = `${member.performance}%`;
        metrics[1].style.width = `${member.presence}%`;

        teamGrid.appendChild(card);
    });

    // Initialize filters
    const departmentFilter = document.querySelector('.department-filter');
    const statusFilter = document.querySelector('.status-filter');

    [departmentFilter, statusFilter].forEach(filter => {
        if (filter) {
            filter.addEventListener('change', () => {
                const department = departmentFilter.value;
                const status = statusFilter.value;

                document.querySelectorAll('.team-member-card').forEach(card => {
                    const matchesDepartment = !department || card.querySelector('.department').textContent === department;
                    const matchesStatus = !status || card.querySelector('.member-status').classList.contains(status);
                    card.style.display = matchesDepartment && matchesStatus ? 'block' : 'none';
                });
            });
        }
    });
}

// Leave Approvals
function initializeLeaveApprovals() {
    const calendar = document.getElementById('absenceCalendar');
    if (!calendar) return;

    // Generate calendar days
    const days = 31;
    for (let i = 1; i <= days; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        day.innerHTML = `
            <span class="date">${i}</span>
            <div class="leaves">
                <span class="leave-dot approved"></span>
                <span class="leave-dot pending"></span>
            </div>
        `;
        calendar.appendChild(day);
    }


}

// Notifications System
function initializeNotifications() {
    const notificationIcon = document.querySelector('.notifications-icon');
    const notificationsDropdown = document.querySelector('.notifications-dropdown');

    if (notificationIcon && notificationsDropdown) {
        notificationIcon.addEventListener('click', () => {
            notificationsDropdown.classList.toggle('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notifications')) {
                notificationsDropdown.classList.remove('active');
            }
        });
    }
}

// Notification function for manager portal
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Choose icon based on notification type
    let icon;
    switch(type) {
        case 'success':
            icon = 'fa-check-circle';
            break;
        case 'error':
            icon = 'fa-exclamation-circle';
            break;
        case 'info':
            icon = 'fa-info-circle';
            break;
        default:
            icon = 'fa-info-circle';
    }

    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Add show class after a small delay to trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Remove notification after 3 seconds
        setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-times-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

// Team Calendar Implementation
function initializeTeamCalendar() {
    console.log('Initializing team calendar...');
    
    // Get the manager's ID first
    const managerId = window.managerId || (window.user ? window.user.id : null);
    if (!managerId) {
        console.error('Manager ID not found');
        return;
    }
    
    console.log('Manager ID:', managerId);
    
    // Initialize the calendar instance if it doesn't exist
    if (!window.calendarInstance) {
        console.log('Creating new Calendar instance');
        window.calendarInstance = new Calendar();
    }
    
    // Get all leave requests from the server
    const allLeaveRequests = window.leaveRequests || [];
    console.log('Total leave requests from server:', allLeaveRequests.length);
    
    // Filter to get only the manager's own leave requests
    const managerLeaveRequests = allLeaveRequests.filter(req => {
        // Only include requests where the manager is the requester
        const isManagerRequest = (req.user_id == managerId);
        
        if (isManagerRequest) {
            console.log('Including manager request:', {
                id: req.id,
                user_id: req.user_id,
                start: req.date_debut,
                end: req.date_fin,
                status: req.etat
            });
            return true;
        }
        return false;
    });
    
    console.log(`Found ${managerLeaveRequests.length} leave requests for manager ${managerId}`);
    
    // Update the calendar with only the manager's leave requests
    if (window.calendarInstance) {
        console.log('Updating calendar with manager leave requests');
        window.calendarInstance.leaveRequests = [...managerLeaveRequests]; // Create a new array reference
        window.calendarInstance.render();
    } else {
        console.error('Calendar instance not found');
    }
}

// Profile Picture Upload Handler
function initializeProfilePictureUpload() {
    const profilePictureInput = document.getElementById('profilePictureInput');
    const profileImage = document.getElementById('profileImage');

    profilePictureInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Veuillez sélectionner une image valide.');
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('L\'image ne doit pas dépasser 5MB.');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                profileImage.src = e.target.result;
                // Here you would typically send the image to your server
                // For now, we'll just store it in localStorage
                localStorage.setItem('managerProfilePicture', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // Load saved profile picture if exists
    const savedProfilePicture = localStorage.getItem('managerProfilePicture');
    if (savedProfilePicture) {
        profileImage.src = savedProfilePicture;
    }
}

// --- Calendar Class Definition ---
class Calendar {
    constructor() {
        this.date = new Date();
        this.currentMonth = this.date.getMonth();
        this.currentYear = this.date.getFullYear();
        this.leaveRequests = [];
        
        // Initialize DOM elements
        this.calendarDays = document.getElementById('calendarDays');
        this.currentMonthElement = document.getElementById('currentMonth');
        this.prevButton = document.getElementById('prevMonth');
        this.nextButton = document.getElementById('nextMonth');
        
        // Debug logging
        console.log('Calendar initialized with elements:', {
            calendarDays: !!this.calendarDays,
            currentMonthElement: !!this.currentMonthElement,
            prevButton: !!this.prevButton,
            nextButton: !!this.nextButton
        });
        
        // Initial render
        this.render();
        
        // Set up event listeners (fix: only use previousMonth/nextMonth)
        if (this.prevButton) {
            this.prevButton.addEventListener('click', () => this.previousMonth());
        }
        if (this.nextButton) {
            this.nextButton.addEventListener('click', () => this.nextMonth());
        }
        
        this.leaveRequests = []; // Store leave requests for rendering
        
        if (!this.calendarDays || !this.currentMonthElement || !this.prevButton || !this.nextButton) {
             console.error("Calendar Error: One or more required elements not found (calendarDays, currentMonth, prevMonth, nextMonth).");
             return; // Stop initialization if elements missing
        }

        // Initial render
        this.render();

        // Listen for new leave requests
        document.addEventListener('newLeaveRequest', (event) => {
            if (event.detail && event.detail.leaveRequest) {
                this.addLeaveRequest(event.detail.leaveRequest);
            }
        });
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

    addLeaveRequest(leaveRequest) {
        // Only add if it's the manager's request
        const managerId = window.managerId || (window.user ? window.user.id : null);
        if (!managerId) {
            console.error('Manager ID not found');
            return;
        }

        // Check if this is a manager's request
        const isManagerRequest = (leaveRequest.user_id == managerId);
        if (!isManagerRequest) {
            console.log('Skipping non-manager request:', leaveRequest);
            return;
        }

        // Check if this request already exists to avoid duplicates
        const exists = this.leaveRequests.some(req => 
            req.id === leaveRequest.id || 
            (req.date_debut === leaveRequest.date_debut && 
             req.date_fin === leaveRequest.date_fin &&
             req.etat === leaveRequest.etat)
        );
        
        if (!exists) {
            console.log('Adding manager leave request:', {
                id: leaveRequest.id,
                start: leaveRequest.date_debut,
                end: leaveRequest.date_fin,
                status: leaveRequest.etat,
                type: 'Manager'
            });
            this.leaveRequests.push(leaveRequest);
            this.render(); // Re-render calendar with new request
        }
    }
    
    render(leaveRequests = this.leaveRequests) {
        // Store the leave requests
        if (leaveRequests !== this.leaveRequests) {
            this.leaveRequests = Array.isArray(leaveRequests) ? leaveRequests : [];
        }
        
        // Get manager's ID
        const managerId = window.managerId || (window.user ? window.user.id : null);
        if (!managerId) {
            console.error('Manager ID not found');
            return;
        }
        
        // Filter requests to only show manager's own requests
        const managerRequests = this.leaveRequests.filter(req => {
            // Only include requests where the manager is the requester
            const isManagerRequest = (req.user_id == managerId);
            const hasValidStatus = req.etat !== undefined && req.etat !== null;
            
            if (isManagerRequest && hasValidStatus) {
                console.log('Including manager request:', {
                    id: req.id,
                    start: req.date_debut,
                    end: req.date_fin,
                    status: req.etat,
                    type: 'Manager'
                });
                return true;
            }
            return false;
        });
        
        console.log('Rendering manager calendar with data:', {
            managerId,
            allRequests: this.leaveRequests.length,
            managerRequests: managerRequests.length,
            currentMonth: this.currentMonth + 1,
            currentYear: this.currentYear
        });
        
        // Use only manager's requests for rendering
        const filteredRequests = managerRequests;
        
        if (!this.calendarDays || !this.currentMonthElement) {
            console.error('Calendar elements not found:', {
                calendarDays: !!this.calendarDays,
                currentMonthElement: !!this.currentMonthElement
            });
             return;
        }

        console.log(`[ManagerCalendar] Rendering: ${this.currentMonth + 1}/${this.currentYear} with ${managerRequests.length} requests`);

        const year = this.currentYear;
        const month = this.currentMonth;
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Update month and year display
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        this.currentMonthElement.textContent = `${monthNames[month]} ${year}`;
        
        // Clear previous calendar
        this.calendarDays.innerHTML = '';

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDay.getDay(); i++) {
            this.calendarDays.appendChild(this.createDayElement());
        }
        
        // Add days of the month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            let statusClass = '';
            let leavesOnDay = [];

            // Find leave(s) for this day
            for (const leave of managerRequests) {
                // Parse leave date range
                let start = leave.date_debut || leave.startDate;
                let end = leave.date_fin || leave.endDate;
                if (!start || !end) continue;

                // Support both formats: yyyy-mm-dd or dd/mm/yyyy
                let startDate = new Date(start.includes('/') ? start.split('/').reverse().join('-') : start);
                let endDate = new Date(end.includes('/') ? end.split('/').reverse().join('-') : end);
                
                // Set time to 00:00:00 for accurate date comparison
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
                date.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
                
                if (date >= startDate && date <= endDate) {
                    leavesOnDay.push(leave);
                    // Priority: Approved > Pending > Rejected
                    if (leave.etat === 1) statusClass = 'approved';
                    else if (leave.etat === 0 && statusClass !== 'approved') statusClass = 'pending';
                    else if (leave.etat === 2 && !statusClass) statusClass = 'rejected';
                    
                    console.log(`Day ${day}: Found leave - Status: ${leave.etat}, Class: ${statusClass}`);
                }
            }

            // Create day element with appropriate classes
            const statusClassName = statusClass ? `leave-${statusClass}` : '';
            const isToday = this.isToday(date);
            const isWeekend = this.isWeekend(date);
            
            console.log(`Creating day ${day} - Status: ${statusClass} (${statusClassName}), Today: ${isToday}, Weekend: ${isWeekend}`);
            
            const dayElement = this.createDayElement(day, {
                isToday: isToday,
                isWeekend: isWeekend,
                statusClass: statusClassName
            });
            
            // Debug: Add data attributes for inspection
            if (statusClass) {
                dayElement.dataset.status = statusClass;
                dayElement.dataset.leaves = leavesOnDay.length;
            }

            // Add tooltip if there are leaves on this day
            if (leavesOnDay.length > 0) {
                const tooltip = document.createElement('div');
                tooltip.className = 'leave-tooltip';
                
                leavesOnDay.forEach(leave => {
                    const leaveItem = document.createElement('div');
                    let statusText = '';
                    let statusClass = '';
                    
                    switch(leave.etat) {
                        case 0: statusText = 'En Attente'; statusClass = 'pending'; break;
                        case 1: statusText = 'Approuvé'; statusClass = 'approved'; break;
                        case 2: statusText = 'Refusé'; statusClass = 'rejected'; break;
                    }
                    
                    leaveItem.innerHTML = `
                        <span class="leave-status ${statusClass}">${statusText}</span>
                        <span>${leave.nature || 'Congé'}</span>
                    `;
                    tooltip.appendChild(leaveItem);
                });
                
                dayElement.appendChild(tooltip);
                dayElement.classList.add('has-tooltip');
            }
            
            this.calendarDays.appendChild(dayElement);
        }
    }
    
    previousMonth() {
        if (this.currentMonth === 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else {
            this.currentMonth--;
        }
        this.render();
    }
    
    nextMonth() {
        if (this.currentMonth === 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else {
            this.currentMonth++;
        }
        this.render();
    }
}
// --- End Calendar Class Definition ---

// Team Management Class
class TeamManagement {
    constructor() {
        this.employees = [];
        this.filteredEmployees = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.initializeEventListeners();
        this.loadEmployees();
    }
    
    initializeEventListeners() {
        // Search input
        const searchInput = document.getElementById('teamSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.applyFilters());
        }

        // Function filter
        const fonctionFilter = document.getElementById('fonctionFilter');
        if (fonctionFilter) {
            fonctionFilter.addEventListener('change', () => this.applyFilters());
        }

        // Status filter
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.applyFilters());
        }

        // Pagination buttons
        const prevPageBtn = document.getElementById('prevTeamPage');
        const nextPageBtn = document.getElementById('nextTeamPage');
        if (prevPageBtn) prevPageBtn.addEventListener('click', () => this.previousPage());
        if (nextPageBtn) nextPageBtn.addEventListener('click', () => this.nextPage());
    }
    
    loadEmployees() {
        if (window.employeesFromServer) {
            this.employees = window.employeesFromServer;
            this.applyFilters();
        } else {
            console.warn('No employee data found from server');
        }
    }
    
    applyFilters() {
        const searchTerm = (document.getElementById('teamSearch')?.value || '').toLowerCase();
        const fonction = document.getElementById('fonctionFilter')?.value || '';
        const status = document.getElementById('statusFilter')?.value || '';
        
        this.filteredEmployees = this.employees.filter(emp => {
            let match = true;
        if (searchTerm) {
                const searchStr = `${emp.name} ${emp.email} ${emp.department} ${emp.fonction}`.toLowerCase();
                if (!searchStr.includes(searchTerm)) match = false;
            }
            if (fonction && emp.fonction !== fonction) match = false;
            if (status) {
                // Convert status to match the data format
                const isActive = emp.conge !== 1;
                if (status === 'active' && !isActive) match = false;
                if (status === 'inactive' && isActive) match = false;
        }
            return match;
        });

        this.currentPage = 1;
        this.renderTable(this.filteredEmployees);
        this.updatePagination(this.filteredEmployees.length);
    }
    
    renderTable(employeesToRender) {
        const tableBody = document.getElementById('teamTableBody');
        if (!tableBody) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedEmployees = employeesToRender.slice(startIndex, endIndex);

        tableBody.innerHTML = '';
        paginatedEmployees.forEach(emp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="employee-info">
                        <img src="${emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}`}" 
                             alt="${emp.name}" 
                             class="employee-avatar">
                        <div class="employee-details">
                            <span class="employee-name">${emp.name}</span>
                            <span class="employee-email">${emp.email}</span>
                        </div>
                    </div>
                </td>
                <td>${emp.department || '-'}</td>
                <td>${emp.fonction || '-'}</td>
                <td>
                    <span class="status-badge ${emp.conge === 1 ? 'inactive' : 'active'}">
                        ${emp.conge === 1 ? 'En Congé' : 'Actif'}
                    </span>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }
    
    updatePagination(totalItems) {
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const pageNumbers = document.getElementById('teamPageNumbers');
        if (!pageNumbers) return;
        
        pageNumbers.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const pageNumber = document.createElement('span');
            pageNumber.className = `page-number ${i === this.currentPage ? 'active' : ''}`;
            pageNumber.textContent = i;
            pageNumber.addEventListener('click', () => this.goToPage(i));
            pageNumbers.appendChild(pageNumber);
        }

        const prevBtn = document.getElementById('prevTeamPage');
        const nextBtn = document.getElementById('nextTeamPage');
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === totalPages;
    }
    
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTable(this.filteredEmployees);
            this.updatePagination(this.filteredEmployees.length);
        }
    }
    
    nextPage() {
        const totalPages = Math.ceil(this.filteredEmployees.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderTable(this.filteredEmployees);
            this.updatePagination(this.filteredEmployees.length);
        }
    }
    
    goToPage(page) {
        const totalPages = Math.ceil(this.filteredEmployees.length / this.itemsPerPage);
        if (page >= 1 && page <= totalPages) {
        this.currentPage = page;
            this.renderTable(this.filteredEmployees);
            this.updatePagination(this.filteredEmployees.length);
        }
    }
}


// Helper function for date range formatting
function formatDateRange(start, end, includeYear = false) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return "Dates invalides";
    }

    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    // Define options based on whether to include the year
    const options = {
        day: 'numeric',
        month: 'short',
        year: includeYear ? 'numeric' : undefined
    };

    const startDateFormatted = startDate.toLocaleDateString('fr-FR', options);

    // If start and end dates are the same day
    if (startDate.toDateString() === endDate.toDateString()) {
        return startDateFormatted;
    }

    // If start and end dates are different
    const optionsEnd = {
        day: 'numeric',
        month: 'short',
        // Include year on end date ONLY if it's different from start date's year
        year: (includeYear || startYear !== endYear) ? 'numeric' : undefined 
    };
    
    // Special handling if same month and year: Format as "Day1-Day2 Month Year"
    if (startYear === endYear && startDate.getMonth() === endDate.getMonth()) {
         optionsEnd.year = undefined; // Don't repeat year
         optionsEnd.month = undefined; // Don't repeat month
         // Make sure start includes month and potentially year
         let startOptsForRange = { day: 'numeric', month: 'short', year: options.year }; 
         return `${startDate.toLocaleDateString('fr-FR', startOptsForRange).replace(/ \d{4}$/, '')} - ${endDate.toLocaleDateString('fr-FR', optionsEnd)} ${startYear}`;
    }

    // Default range format
    const endDateFormatted = endDate.toLocaleDateString('fr-FR', optionsEnd);
    return `${startDateFormatted} - ${endDateFormatted}`;
}

// Pagination functionality for requests
class RequestsPagination {
    constructor(itemsPerPage = 5) {
        console.log('Initializing RequestsPagination');
        this.itemsPerPage = itemsPerPage;
        this.currentPage = 1;
        this.totalItems = 0;
        this.totalPages = 0;
        this.requests = [];
        
        // Bind methods to preserve 'this' context
        this.goToPage = this.goToPage.bind(this);
        this.previousPage = this.previousPage.bind(this);
        this.nextPage = this.nextPage.bind(this);
        this.render = this.render.bind(this);
        
        this.initializePagination();
    }

    initializePagination() {
        console.log('Initializing pagination elements');
        let paginationContainer = document.querySelector('.pagination-container');
        if (!paginationContainer) {
            console.log('Creating new pagination container');
            paginationContainer = document.createElement('div');
            paginationContainer.className = 'pagination-container';
            const requestsList = document.querySelector('.requests-list');
            if (requestsList) {
                requestsList.after(paginationContainer);
            } else {
                console.error('Could not find .requests-list element');
                return;
            }
        }

        paginationContainer.innerHTML = `
            <div class="pagination" style="position: relative; z-index: 1000;">
                <button class="pagination-btn prev-btn" disabled style="cursor: pointer; z-index: 1001;">
                    <i class="fas fa-chevron-left"></i>
                    Précédent
                </button>
                <div class="page-numbers" style="position: relative; z-index: 1001;"></div>
                <button class="pagination-btn next-btn" disabled style="cursor: pointer; z-index: 1001;">
                    Suivant
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="page-info"></div>
        `;

        this.prevBtn = paginationContainer.querySelector('.prev-btn');
        this.nextBtn = paginationContainer.querySelector('.next-btn');
        this.pageNumbers = paginationContainer.querySelector('.page-numbers');
        this.pageInfo = paginationContainer.querySelector('.page-info');

        if (!this.prevBtn || !this.nextBtn || !this.pageNumbers || !this.pageInfo) {
            console.error('Could not find all pagination elements');
            return;
        }

        console.log('Adding event listeners to pagination buttons');
        this.prevBtn.addEventListener('click', this.previousPage);
        this.nextBtn.addEventListener('click', this.nextPage);

        // Add click handler to the page numbers container
        this.pageNumbers.addEventListener('click', (e) => {
            const pageButton = e.target.closest('.page-number');
            if (pageButton) {
                const pageNum = parseInt(pageButton.dataset.page);
                console.log('Page number clicked via delegation:', pageNum);
                this.goToPage(pageNum);
            }
        });
    }

    addPageNumber(pageNum) {
        console.log('Adding page number:', pageNum);
        const pageButton = document.createElement('button');
        pageButton.className = `page-number ${pageNum === this.currentPage ? 'active' : ''}`;
        pageButton.textContent = pageNum;
        pageButton.dataset.page = pageNum;
        
        pageButton.style.cssText = `
            cursor: pointer;
            position: relative;
            z-index: 1002;
            pointer-events: auto;
        `;
        
        this.pageNumbers.appendChild(pageButton);
    }

    goToPage(page) {
        console.log('Going to page:', page);
        if (page >= 1 && page <= this.totalPages) {
            const oldPage = this.currentPage;
            this.currentPage = page;
            
            if (oldPage !== page) {
                console.log('Page changed from', oldPage, 'to', page);
                
                const pageButtons = this.pageNumbers.querySelectorAll('.page-number');
                pageButtons.forEach(button => {
                    const buttonPage = parseInt(button.dataset.page);
                    const isActive = buttonPage === page;
                    console.log('Updating button', buttonPage, 'active state to', isActive);
                    button.classList.toggle('active', isActive);
                });
                
                this.render();

                setTimeout(() => {
                    const firstRequestCard = document.querySelector('.request-card');
                    if (firstRequestCard) {
                        firstRequestCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 100);
            } else {
                console.log('Page did not change, skipping render');
            }
        } else {
            console.log('Invalid page number:', page);
        }
    }

    previousPage() {
        console.log('Previous page clicked');
        if (this.currentPage > 1) {
            this.currentPage--;
            this.render();
            
            setTimeout(() => {
                const firstRequestCard = document.querySelector('.request-card');
                if (firstRequestCard) {
                    firstRequestCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    }

    nextPage() {
        console.log('Next page clicked');
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.render();
            
            setTimeout(() => {
                const firstRequestCard = document.querySelector('.request-card');
                if (firstRequestCard) {
                    firstRequestCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    }

    setRequests(requests) {
        console.log('Setting requests:', requests.length);
        // Only show pending requests (etat === 0) in the demandes à traiter section
        this.requests = requests.filter(request => request.etat === 0);
        this.totalItems = this.requests.length;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.currentPage = 1;
        this.render();
    }

    render() {
        console.log('Rendering page:', this.currentPage);
        // Calculate start and end indices
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.totalItems);
        
        // Get current page items
        const currentItems = this.requests.slice(startIndex, endIndex);
        console.log('Current page items:', currentItems.length);
        
        // Update requests list
        const requestsList = document.querySelector('.requests-list');
        if (!requestsList) {
            console.error('Could not find .requests-list element');
            return;
        }
        
        // Clear existing content
        requestsList.innerHTML = '';
        
        if (currentItems.length === 0) {
            requestsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Aucune demande à afficher</p>
                </div>
            `;
        } else {
            currentItems.forEach(request => {
                const requestCard = this.createRequestCard(request);
                requestsList.appendChild(requestCard);
            });
        }

        // Update pagination controls
        this.updatePaginationControls();
        
        // Update page info
        this.pageInfo.textContent = `Affichage de ${startIndex + 1} à ${endIndex} sur ${this.totalItems} demandes`;
        
        // Log the current state
        console.log('Render complete:', {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            itemsPerPage: this.itemsPerPage,
            totalItems: this.totalItems,
            startIndex,
            endIndex
        });
    }

    createRequestCard(request) {
        const card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML = `
            <div class="request-info">
                <div class="employee-details">
                    <img src="${request.employee_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.employee_name)}`}" 
                         alt="${request.employee_name}" 
                         class="employee-avatar">
                    <div class="employee-info">
                        <h3 class="employee-name">${request.employee_name}</h3>
                        <p class="employee-position">
                            <i class="fas fa-briefcase"></i>
                            ${request.employee_position || 'Employé'}
                        </p>
                    </div>
                </div>
                <div class="request-details">
                    <div class="detail-group">
                        <span class="detail-label">Type de demande</span>
                        <span class="detail-value">
                            <i class="fas fa-calendar"></i>
                            ${request.type || 'Congé'}
                        </span>
                    </div>
                    <div class="detail-group">
                        <span class="detail-label">Date de début</span>
                        <span class="detail-value">
                            <i class="fas fa-calendar-day"></i>
                            ${new Date(request.date_debut).toLocaleDateString()}
                        </span>
                    </div>
                    <div class="detail-group">
                        <span class="detail-label">Date de fin</span>
                        <span class="detail-value">
                            <i class="fas fa-calendar-day"></i>
                            ${new Date(request.date_fin).toLocaleDateString()}
                        </span>
                    </div>
                    <div class="detail-group">
                        <span class="detail-label">Durée</span>
                        <span class="detail-value">
                            <i class="fas fa-clock"></i>
                            ${request.duree || '1'} jour(s)
                        </span>
                    </div>
                </div>
                <div class="request-motif">
                    <span class="motif-label">Motif</span>
                    <p class="motif-text">${request.motif || 'Non spécifié'}</p>
                </div>
            </div>
            <div class="action-buttons">
                <button class="action-btn approve" onclick="approveRequest(${request.id})">
                    <i class="fas fa-check"></i>
                    Approuver
                </button>
                <button class="action-btn reject" onclick="rejectRequest(${request.id})">
                    <i class="fas fa-times"></i>
                    Rejeter
                </button>
            </div>
        `;
        return card;
    }

    updatePaginationControls() {
        console.log('Updating pagination controls');
        // Update prev/next buttons
        this.prevBtn.disabled = this.currentPage === 1;
        this.nextBtn.disabled = this.currentPage === this.totalPages;

        // Update page numbers
        this.pageNumbers.innerHTML = '';
        
        // Show max 5 page numbers
        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(this.totalPages, startPage + 4);
        
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        console.log('Page range:', { startPage, endPage, totalPages: this.totalPages });

        // Add first page if not included
        if (startPage > 1) {
            this.addPageNumber(1);
            if (startPage > 2) {
                this.pageNumbers.innerHTML += '<span class="page-ellipsis">...</span>';
            }
        }

        // Add page numbers
        for (let i = startPage; i <= endPage; i++) {
            this.addPageNumber(i);
        }

        // Add last page if not included
        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                this.pageNumbers.innerHTML += '<span class="page-ellipsis">...</span>';
            }
            this.addPageNumber(this.totalPages);
        }
    }
}

// Helper function to safely update stats
function setCount(id, val) {
    const el = document.getElementById(id);
}

// Function to update team stats display
function updateTeamStats(teamStats) {
console.log('Updating team stats with:', teamStats);
    
if (!teamStats) {
    console.warn('No team stats provided to updateTeamStats');
    return;
}

// Ensure we have valid numbers
const totalMembers = parseInt(teamStats.totalMembers) || 0;
const absencesToday = parseInt(teamStats.absencesToday) || 0;
    
console.log('Parsed team stats - Total Members:', totalMembers, 'Absences Today:', absencesToday);

// Update team members count
const dashTeamMemberCount = document.getElementById('dashTeamMemberCount');
if (dashTeamMemberCount) {
    console.log('Found team member count element');
        
    // Update the count
    dashTeamMemberCount.textContent = totalMembers;
        
    // Update the label (next sibling element)
    const label = dashTeamMemberCount.nextElementSibling;
    if (label && (label.classList.contains('stat-label') || label.classList.contains('stat-label-small'))) {
        label.textContent = totalMembers === 1 ? 'membre' : 'membres';
    }
        
    console.log('Updated team member count to:', totalMembers);
} else {
    console.warn('Could not find dashTeamMemberCount element');
}
    
// Update absences count if available
const dashAbsentTodayCount = document.getElementById('dashAbsentTodayCount');
if (dashAbsentTodayCount) {
    console.log('Found absences count element');
        
    // Update the count
    dashAbsentTodayCount.textContent = absencesToday;
        
    // Update the label (next sibling element)
    const label = dashAbsentTodayCount.nextElementSibling;
    if (label && (label.classList.contains('stat-label') || label.classList.contains('stat-label-small'))) {
        label.textContent = 'en congé';
    }
        
    console.log('Updated absences count to:', absencesToday);
} else {
    console.warn('Could not find dashAbsentTodayCount element');
}
    
// Also update the pagination total if available
if (window.pagination) {
    window.pagination.totalEmployees = totalMembers;
    console.log('Updated pagination totalEmployees to:', totalMembers);
}
}

// --- Leave Requests Filtering ---
function filterLeaveRequests() {
    // Clear the "demandes à traiter" section
    const requestsList = document.querySelector('.requests-list');
    if (requestsList) {
        requestsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Aucune demande à afficher</p>
            </div>
        `;
    }

    // Reset the pagination instance
    if (window.requestsPagination) {
        window.requestsPagination.requests = [];
        window.requestsPagination.totalItems = 0;
        window.requestsPagination.totalPages = 0;
        window.requestsPagination.currentPage = 1;
        window.requestsPagination.render();
    }

    // Keep the leave approvals section filtering logic
    const searchInput = document.getElementById('searchLeaveHistory');
    const typeFilter = document.getElementById('leaveTypeFilter');
    const statusFilter = document.getElementById('leaveStatusFilter');
    const dateFilter = document.getElementById('monthFilter');

    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const type = typeFilter ? typeFilter.value : '';
    const status = statusFilter ? statusFilter.value : '';
    const date = dateFilter ? dateFilter.value : '';

    let filtered = window.leaveRequestsFromServer.filter(request => {
        const matchesSearch = request.employee_name.toLowerCase().includes(search);
        const matchesType = !type || request.nature === type;
        const matchesStatus = !status || 
            (status === 'Approuvé' && request.etat === 1) ||
            (status === 'Refusé' && request.etat === 2);
        const matchesDate = !date || 
            (request.date_debut && request.date_debut.toString().startsWith(date));

        return matchesSearch && matchesType && matchesStatus && matchesDate;
    });

    // Update the leave approvals section
    const tableBody = document.getElementById('leaveHistoryTableBody');
    if (tableBody) {
        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-data">
                        <i class="fas fa-inbox"></i>
                        <p>Aucune demande de congé trouvée</p>
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = filtered.map(request => `
            <tr>
                <td>
                    <div class="employee-info">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(request.employee_name)}" 
                                 alt="${request.employee_name}" 
                             class="employee-avatar">
                            <div class="employee-details">
                                <span class="employee-name">${request.employee_name}</span>
                                <span class="employee-email">${request.employee_email}</span>
                            </div>
                    </div>
                </td>
                    <td>${request.nature}</td>
                    <td>${request.date_debut ? request.date_debut.toString().slice(0,10) : ''}</td>
                    <td>${request.date_fin ? request.date_fin.toString().slice(0,10) : ''}</td>
                    <td>
                        ${request.etat === 0 ? 
                            '<span class="status-badge pending">En Attente</span>' :
                            request.etat === 1 ? 
                            '<span class="status-badge approved">Approuvé</span>' :
                            '<span class="status-badge rejected">Refusé</span>'
                        }
                </td>
                    <td>
                        ${request.etat === 0 ? `
                            <div class="action-buttons">
                                <button type="button" class="action-btn approve" onclick="approveRequest('${request.id}')" title="Approuver">
                                    <i class="fas fa-check"></i>
                                    <span>Approuver</span>
                                </button>
                                <button type="button" class="action-btn reject" onclick="rejectRequest('${request.id}')" title="Refuser">
                                    <i class="fas fa-times"></i>
                                    <span>Refuser</span>
                                </button>
                            </div>
                        ` : ''}
                </td>
            </tr>
            `).join('');
        }
    }
}

// Function to handle leave request approval
async function approveRequest(requestId) {
    try {
        const response = await fetch(`/update-etat/${requestId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            showNotification('La demande de congé a été approuvée avec succès', 'success');
            // Refresh the page after a short delay to show updated status
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification('Erreur lors de l\'approbation de la demande', 'error');
        }
    } catch (error) {
        console.error('Error approving request:', error);
        showNotification('Erreur lors de l\'approbation de la demande', 'error');
    }
}

// Function to handle leave request rejection
async function rejectRequest(requestId) {
    try {
        const response = await fetch(`/annuler-demande/${requestId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            showNotification('La demande de congé a été refusée', 'success');
            // Refresh the page after a short delay to show updated status
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification('Erreur lors du refus de la demande', 'error');
        }
    } catch (error) {
        console.error('Error rejecting request:', error);
        showNotification('Erreur lors du refus de la demande', 'error');
    }
}

// --- Confirmation Popup (copied from employee portal) ---
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
