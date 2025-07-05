// Director Portal JavaScript
let sousDirectorTeamInstance;
let employeeTeamInstance;
let calendarInstance;

document.addEventListener('DOMContentLoaded', () => {
    // --- Leave Approval Stats Update ---
    if (window.leaveRequestsFromServer) {
        const demandes = window.leaveRequestsFromServer;
        let pending = 0, approved = 0, rejected = 0;
        demandes.forEach(d => {
            if (d.etat === 0) pending++;
            else if (d.etat === 1) approved++;
            else if (d.etat === 2) rejected++;
        });
        setCount('pendingCount', pending);
        setCount('approvedCount', approved);
        setCount('rejectedCount', rejected);
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

    function filterLeaveRequests() {
        const demandes = window.leaveRequestsFromServer || [];
        const search = (document.getElementById('searchLeave')?.value || '').toLowerCase();
        const type = document.getElementById('typeFilter')?.value || '';
        const status = document.getElementById('leaveStatusFilter')?.value || '';
        const date = document.getElementById('dateFilter')?.value || '';

        let filtered = demandes.filter(d => {
            let match = true;
            if (search && !(d.sous_director_name?.toLowerCase().includes(search) || d.sous_director_email?.toLowerCase().includes(search))) match = false;
            if (type && d.nature !== type) match = false;
            if (status) {
                if (status === 'En Attente' && d.etat !== 0) match = false;
                if (status === 'Approuvé' && d.etat !== 1) match = false;
                if (status === 'Refusé' && d.etat !== 2) match = false;
            }
            if (date) {
                const ddeb = d.date_debut ? d.date_debut.toString().slice(0,10) : '';
                const dfin = d.date_fin ? d.date_fin.toString().slice(0,10) : '';
                if (ddeb !== date && dfin !== date) match = false;
            }
            return match;
        });
        renderLeaveRequestsTable(filtered);
    }

    function renderLeaveRequestsTable(requests) {
        const tableBody = document.querySelector('.leave-table tbody');
        const emptyState = document.querySelector('.leave-table-container .empty-state');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (!requests.length) {
            if (emptyState) emptyState.style.display = '';
            return;
        }
        if (emptyState) emptyState.style.display = 'none';
        requests.forEach(demande => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${demande.sous_director_name || ''}</td>
                <td>${demande.sous_director_email || ''}</td>
                <td>${demande.nature || ''}</td>
                <td>${demande.date_debut ? demande.date_debut.toString().slice(0,10) : ''}</td>
                <td>${demande.date_fin ? demande.date_fin.toString().slice(0,10) : ''}</td>
                <td>${demande.motif || ''}</td>
                <td>
                    ${demande.etat === 0 ? '<span class="status-badge pending">En Attente</span>' : demande.etat === 1 ? '<span class="status-badge approved">Approuvé</span>' : demande.etat === 2 ? '<span class="status-badge rejected">Refusé</span>' : '<span class="status-badge">Inconnu</span>'}
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // --- Navigation Management ---
    initializeNavigation();
    // --- Notifications System ---
    initializeNotifications();
    // --- Profile Picture Upload ---
    initializeProfilePictureUpload();
    // --- Charts Initialization ---
    initializeCharts();
    // --- Calendar ---
    initializeTeamCalendar();
    // --- Team Management (Sous-Directors) ---
    initializeSousDirectorTeamManagement();
    // --- Team Management (Employees) ---
    initializeEmployeeTeamManagement();

    // Initialize calendar
    initializeCalendar();

    // === Mes Documents Delete Button Logic ===
    document.querySelectorAll('.btn-delete-doc').forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const docId = button.getAttribute('data-id');
            showDeleteConfirmation(async (confirmed) => {
                if (!confirmed) return;
                try {
                    const response = await fetch(`/delete-document/${docId}`, {
                        method: 'DELETE',
                        headers: { 'Accept': 'application/json' }
                    });
                    const data = await response.json();
                    if (data.success) {
                        if (typeof showNotification === 'function') {
                            showNotification(data.message || 'Document supprimé avec succès', 'success');
                        } else {
                            alert(data.message || 'Document supprimé avec succès');
                        }
                        const card = button.closest('.document-card');
                        if (card) {
                            card.style.opacity = '0';
                            setTimeout(() => card.remove(), 300);
                        }
                    } else {
                        throw new Error(data.message || 'Erreur lors de la suppression du document');
                    }
                } catch (error) {
                    if (typeof showNotification === 'function') {
                        showNotification(error.message || 'Erreur lors de la suppression du document', 'error');
                    } else {
                        alert(error.message || 'Erreur lors de la suppression du document');
                    }
                }
            });
        });
    });
});

function setCount(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// --- Navigation Management ---
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.sidebar nav a[data-section]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const sectionId = link.getAttribute('data-section');
            document.querySelectorAll('main .section').forEach(sec => sec.classList.remove('active'));
            const target = document.getElementById(sectionId);
            if (target) target.classList.add('active');
            document.getElementById('currentPageTitle').textContent = link.textContent.trim();
        });
    });
}

// --- Notifications System ---
function initializeNotifications() {
    // Already handled in EJS inline for dropdown, but you can add more dynamic logic here if needed
}

// --- Profile Picture Upload Handler ---
function initializeProfilePictureUpload() {
    // Placeholder for profile picture upload logic
}

// --- Charts Initialization ---
function initializeCharts() {
    // Placeholder for dashboard charts logic
}

// --- Calendar ---
function initializeTeamCalendar() {
    // Placeholder for calendar logic
}

// --- Team Management (Sous-Directors) ---
function initializeSousDirectorTeamManagement() {
    // Placeholder for sous-director management logic
}

// --- Team Management (Employees) ---
function initializeEmployeeTeamManagement() {
    // Placeholder for employee management logic
}

// Calendar functionality
function initializeCalendar() {
    const calendarDays = document.getElementById('calendarDays');
    const currentMonthElement = document.getElementById('currentMonth');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const calendarWidget = document.getElementById('calendarWidget');
    
    if (!calendarDays || !currentMonthElement || !prevMonthBtn || !nextMonthBtn || !calendarWidget) {
        console.warn('Calendar elements not found, skipping calendar initialization');
        return;
    }

    let currentDate = new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();

    // Get leave requests data from the data attribute
    const leaveRequests = JSON.parse(calendarWidget.dataset.leaveRequests || '[]');

    function formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    function isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    function getLeaveStatus(date) {
        const dateStr = formatDate(date);
        const requests = leaveRequests.filter(req => {
            const startDate = new Date(req.date_debut);
            const endDate = new Date(req.date_fin);
            const checkDate = new Date(dateStr);
            return checkDate >= startDate && checkDate <= endDate;
        });

        if (requests.length === 0) return null;
        
        // If any request is pending, show pending
        if (requests.some(req => req.etat === 0)) return 'pending';
        // If any request is rejected, show rejected
        if (requests.some(req => req.etat === 2)) return 'rejected';
        // Otherwise show approved
        return 'approved';
    }

    function renderCalendar() {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const startingDay = firstDay.getDay();
        const totalDays = lastDay.getDate();

        // Update month and year display
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        currentMonthElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;

        // Clear previous calendar
        calendarDays.innerHTML = '';

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            calendarDays.appendChild(emptyDay);
        }

        // Add days of the month
        for (let day = 1; day <= totalDays; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            
            const currentDate = new Date(currentYear, currentMonth, day);
            const leaveStatus = getLeaveStatus(currentDate);
            
            if (isToday(currentDate)) {
                dayElement.classList.add('today');
            }
            
            if (leaveStatus) {
                dayElement.classList.add(`leave-${leaveStatus}`);
            }

            dayElement.textContent = day;
            calendarDays.appendChild(dayElement);
        }

        // Add empty cells for days after the last day of the month to complete the grid
        const totalCells = 42; // 6 rows of 7 days
        const remainingCells = totalCells - (startingDay + totalDays);
        for (let i = 0; i < remainingCells; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            calendarDays.appendChild(emptyDay);
        }
    }

    // Event listeners for month navigation
    prevMonthBtn.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });

    // Initial calendar render
    renderCalendar();
}
