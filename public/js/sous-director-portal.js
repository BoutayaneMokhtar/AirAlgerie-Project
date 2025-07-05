// Sous-Director Portal Advanced JavaScript
// This script adapts the advanced UI/UX and logic from manager-portal.js for the sous-director portal (focused on managers)

let teamManagementInstance;
let calendarInstance;

document.addEventListener('DOMContentLoaded', () => {
    // --- Sidebar Navigation Logic ---
    const sidebarLinks = document.querySelectorAll('.sidebar nav a');
    const sections = document.querySelectorAll('main .section');
    const pageTitle = document.getElementById('currentPageTitle');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            // Remove 'active' from all links
            sidebarLinks.forEach(l => l.classList.remove('active'));
            // Add 'active' to this link
            this.classList.add('active');
            // Hide all sections
            sections.forEach(section => section.classList.remove('active'));
            // Show the target section
            const sectionId = this.getAttribute('data-section');
            const target = document.getElementById(sectionId);
            if (target) target.classList.add('active');
            // Update page title
            if (pageTitle && this.querySelector('span')) {
                pageTitle.textContent = this.querySelector('span').textContent;
            }
        });
    });

    // --- Leave Approval Stats Update ---
    updateLeaveApprovalStats();
    // --- Leave Requests Filtering & Table Rendering ---
    initializeLeaveApprovals();
    // --- Team Management (Managers) Filtering & Table ---
    initializeTeamManagement();
    // --- Calendar ---
    initializeCalendar();
    // --- Notifications ---
    initializeNotifications();
    // --- Profile Picture Upload (Optional) ---
    initializeProfilePictureUpload();
    // --- Departments Management ---
    initializeDepartmentsManagement();
    // --- All Employees Table Management ---
    initializeAllEmployeesTable();
    // --- Pending Requests Pagination (Demandes à Traiter) ---
    initializePendingRequestsPagination();
    // Set Absences Aujourd'hui stat card value from server
    if (typeof window.absencesTodayCount !== 'undefined') {
        const dashAbsentTodayCount = document.getElementById('dashAbsentTodayCount');
        if (dashAbsentTodayCount) {
            dashAbsentTodayCount.textContent = window.absencesTodayCount;
        }
    }
    initializeHistoryTablePagination();

    const historyTableContainer = document.querySelector('.history-table-container');
    if (historyTableContainer) {
        historyTableContainer.addEventListener('click', async function(e) {
            const btn = e.target.closest('.delete-demande-btn');
            if (btn) {
                const demandeId = btn.getAttribute('data-id');
                showDeleteConfirmation(async function(confirmed) {
                    if (confirmed) {
                        try {
                            const response = await fetch(`/delete-demande/${demandeId}`, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' }
                            });
                            const result = await response.json();
                            if (result.success) {
                                // Remove the row from the table
                                const row = btn.closest('tr');
                                row.style.opacity = '0.5';
                                setTimeout(() => row.remove(), 300);
                            } else {
                                alert(result.message || 'Erreur lors de la suppression');
                            }
                        } catch (err) {
                            alert('Erreur lors de la suppression');
                        }
                    }
                });
            }
        });
    }

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
                        // Optionally show a notification (reuse your notification system if available)
                        if (typeof showNotification === 'function') {
                            showNotification(data.message || 'Document supprimé avec succès', 'success');
                        } else {
                            alert(data.message || 'Document supprimé avec succès');
                        }
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

function updateLeaveApprovalStats() {
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
}
function setCount(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// --- Leave Approvals Table (Filtering, Rendering, Pagination) ---
function initializeLeaveApprovals() {
    const demandes = window.leaveRequestsFromServer || [];
    let filtered = [...demandes];
    let currentPage = 1;
    const itemsPerPage = 10;

    function filterLeaveRequests() {
        const search = (document.getElementById('searchLeave')?.value || '').toLowerCase();
        const type = document.getElementById('typeFilter')?.value || '';
        const status = document.getElementById('leaveStatusFilter')?.value || '';
        const date = document.getElementById('dateFilter')?.value || '';
        filtered = demandes.filter(d => {
            let match = true;
            if (search && !(d.employee_name?.toLowerCase().includes(search) || d.employee_email?.toLowerCase().includes(search))) match = false;
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
        currentPage = 1;
        renderLeaveRequestsTable();
        updateLeaveApprovalsPagination();
    }

    function renderLeaveRequestsTable() {
        const tbody = document.getElementById('leaveTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const start = (currentPage - 1) * itemsPerPage;
        const pageData = filtered.slice(start, start + itemsPerPage);
        if (!pageData.length) {
            tbody.innerHTML = '<tr><td colspan="6">Aucune demande trouvée pour les managers.</td></tr>';
            return;
        }
        pageData.forEach(demande => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="employee-info">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(demande.employee_name)}" alt="${demande.employee_name}" class="employee-avatar">
                        <div class="employee-details">
                            <span class="employee-name">${demande.employee_name || ''}</span>
                            <span class="employee-email">${demande.employee_email || ''}</span>
                        </div>
                    </div>
                </td>
                <td>${demande.date_debut ? (demande.date_debut.toString().slice(0,10)) : ''}</td>
                <td>${demande.date_fin ? (demande.date_fin.toString().slice(0,10)) : ''}</td>
                <td>${demande.date_debut && demande.date_fin ? (function(){let start=new Date(demande.date_debut),end=new Date(demande.date_fin);return (Math.round((end-start)/(1000*60*60*24))+1)+" jours";})() : ''}</td>
                <td>${demande.nature || ''}</td>
                <td>${demande.etat === 0 ? '<span class="status-badge pending"><i class="fas fa-clock"></i> En Attente</span>' : demande.etat === 1 ? '<span class="status-badge approved"><i class="fas fa-check"></i> Approuvé</span>' : demande.etat === 2 ? '<span class="status-badge rejected"><i class="fas fa-times"></i> Refusé</span>' : ''}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function updateLeaveApprovalsPagination() {
        const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
        const prevBtn = document.getElementById('prevLeavePage');
        const nextBtn = document.getElementById('nextLeavePage');
        const pageNumbers = document.getElementById('leavePageNumbers');
        if (!prevBtn || !nextBtn || !pageNumbers) return;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
        pageNumbers.innerHTML = `<span class="card-label">Managers</span>`;
        for (let i = 1; i <= totalPages; i++) {
            const span = document.createElement('span');
            span.className = 'page-number' + (i === currentPage ? ' active' : '');
            span.textContent = i;
            span.addEventListener('click', () => { currentPage = i; renderLeaveRequestsTable(); updateLeaveApprovalsPagination(); });
            pageNumbers.appendChild(span);
        }
    }

    // Attach filter listeners
    ['searchLeave','typeFilter','leaveStatusFilter','dateFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', filterLeaveRequests);
    });
    document.getElementById('resetLeaveFilters')?.addEventListener('click', () => {
        ['searchLeave','typeFilter','leaveStatusFilter','dateFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        filterLeaveRequests();
    });
    document.getElementById('prevLeavePage')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderLeaveRequestsTable(); updateLeaveApprovalsPagination(); }
    });
    document.getElementById('nextLeavePage')?.addEventListener('click', () => {
        const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
        if (currentPage < totalPages) { currentPage++; renderLeaveRequestsTable(); updateLeaveApprovalsPagination(); }
    });
    // Initial render
    filterLeaveRequests();
}

// --- Team Management (Managers) Table ---
function initializeTeamManagement() {
    const managers = window.employeesFromServer || [];
    let filtered = [...managers];
    let currentPage = 1;
    const itemsPerPage = 10;

    function filterManagers() {
        const search = (document.getElementById('searchEmployee')?.value || '').toLowerCase();
        const department = document.getElementById('departmentFilter')?.value || '';
        const status = document.getElementById('teamStatusFilter')?.value || '';
        const role = document.getElementById('roleFilter')?.value || '';
        filtered = managers.filter(m => {
            let match = true;
            if (search && !(m.nomcomplet?.toLowerCase().includes(search) || m.email?.toLowerCase().includes(search))) match = false;
            if (department && m.departement_nom !== department) match = false;
            if (role && role !== '' && (!m.fonction || m.fonction !== role)) match = false;
            // Status filter: for demo, assume all are 'actif' unless on leave
            if (status === 'conge' && (!m.on_leave)) match = false;
            if (status === 'actif' && m.on_leave) match = false;
            return match;
        });
        currentPage = 1;
        renderManagersTable();
        updateManagersPagination();
    }

    function renderManagersTable() {
        const tbody = document.getElementById('teamTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const start = (currentPage - 1) * itemsPerPage;
        const pageData = filtered.slice(start, start + itemsPerPage);
        if (!pageData.length) {
            tbody.innerHTML = '<tr><td colspan="3">Aucun manager trouvé.</td></tr>';
            return;
        }
        pageData.forEach(manager => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="employee-info">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(manager.nomcomplet || '')}" alt="${manager.nomcomplet || ''}" class="employee-avatar">
                        <div class="employee-details">
                            <span class="employee-name">${manager.nomcomplet || ''}</span>
                            <span class="employee-email">${manager.email || ''}</span>
                        </div>
                    </div>
                </td>
                <td>${manager.departement_nom || ''}</td>
                <td>${manager.fonction || 'Manager'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function updateManagersPagination() {
        const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const pageNumbers = document.getElementById('pageNumbers');
        if (!prevBtn || !nextBtn || !pageNumbers) return;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
        pageNumbers.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const span = document.createElement('span');
            span.className = 'page-number' + (i === currentPage ? ' active' : '');
            span.textContent = i;
            span.addEventListener('click', () => { currentPage = i; renderManagersTable(); updateManagersPagination(); });
            pageNumbers.appendChild(span);
        }
    }

    // Attach filter listeners
    ['searchEmployee','departmentFilter','teamStatusFilter','roleFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', filterManagers);
    });
    document.getElementById('resetFilters')?.addEventListener('click', () => {
        ['searchEmployee','departmentFilter','teamStatusFilter','roleFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        filterManagers();
    });
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderManagersTable(); updateManagersPagination(); }
    });
    document.getElementById('nextPage')?.addEventListener('click', () => {
        const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
        if (currentPage < totalPages) { currentPage++; renderManagersTable(); updateManagersPagination(); }
    });
    // Initial render
    filterManagers();
}

// --- Calendar (reuse logic from manager portal) ---
function initializeCalendar() {
    // Placeholder: add calendar logic if needed, as in manager-portal.js
}

// --- Notifications ---
function initializeNotifications() {
    // Already handled in EJS inline script for bell/dropdown
}

// --- Profile Picture Upload (Optional) ---
function initializeProfilePictureUpload() {
    const input = document.getElementById('profilePictureInput');
    const img = document.getElementById('profileImage');
    if (!input || !img) return;
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(ev) {
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

// --- Departments Management ---
function initializeDepartmentsManagement() {
    const searchInput = document.getElementById('searchDepartment');
    const departmentCards = document.querySelectorAll('.department-card');
    const expandButtons = document.querySelectorAll('.expand-btn');

    // Handle search functionality
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            departmentCards.forEach(card => {
                const departmentName = card.querySelector('.department-info h3').textContent.toLowerCase();
                const employeeNames = Array.from(card.querySelectorAll('.employee-name'))
                    .map(el => el.textContent.toLowerCase());
                
                const matchesDepartment = departmentName.includes(searchTerm);
                const matchesEmployee = employeeNames.some(name => name.includes(searchTerm));
                
                card.style.display = (matchesDepartment || matchesEmployee) ? '' : 'none';
            });
        });
    }

    // Handle expand/collapse functionality
    expandButtons.forEach(button => {
        button.addEventListener('click', function() {
            const card = this.closest('.department-card');
            const content = card.querySelector('.department-content');
            const icon = this.querySelector('i');
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            } else {
                content.style.display = 'none';
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        });
    });
}

// --- All Employees Table Management ---
function initializeAllEmployeesTable() {
    console.log('[DEBUG] allEmployeesFromServer:', window.allEmployeesFromServer);
    const employees = window.allEmployeesFromServer || [];
    const searchInput = document.getElementById('searchAllEmployees');
    const roleFilter = document.getElementById('employeeRoleFilter');
    const departmentFilter = document.getElementById('employeeDepartmentFilter');
    const statusFilter = document.getElementById('employeeStatusFilter');
    const resetButton = document.getElementById('resetEmployeeFilters');
    const tbody = document.getElementById('employeesTableBody');
    const itemsPerPage = 10;
    let currentPage = 1;
    const prevBtn = document.getElementById('prevEmployeePage');
    const nextBtn = document.getElementById('nextEmployeePage');
    const pageNumbers = document.getElementById('employeePageNumbers');

    if (!searchInput || !roleFilter || !departmentFilter || !statusFilter || !resetButton || !prevBtn || !nextBtn || !pageNumbers || !tbody) {
        console.warn('All Employees Table: One or more filter/pagination elements not found. Skipping initialization.');
        return;
    }

    function getFilteredEmployees() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedRole = roleFilter.value;
        const selectedDepartment = departmentFilter.value;
        const selectedStatus = statusFilter.value;
        return employees.filter(emp => {
            const name = emp.nomcomplet?.toLowerCase() || '';
            const email = emp.email?.toLowerCase() || '';
            const department = emp.departement_id ? emp.departement_id.toString() : '';
            const role = emp.groupeid === 1 ? 'Manager' : 'Employé';
            const status = emp.conge ? 'En congé' : 'Actif';
            const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm);
            const matchesRole = !selectedRole || role === selectedRole;
            const matchesDepartment = !selectedDepartment || department === selectedDepartment;
            const matchesStatus = !selectedStatus || 
                (selectedStatus === 'active' && status === 'Actif') ||
                (selectedStatus === 'on-leave' && status === 'En congé');
            return matchesSearch && matchesRole && matchesDepartment && matchesStatus;
        });
    }

    function renderTable() {
        const filtered = getFilteredEmployees();
        const totalRows = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalRows / itemsPerPage));
        if (currentPage > totalPages) currentPage = totalPages;
        tbody.innerHTML = '';
        const start = (currentPage - 1) * itemsPerPage;
        const pageData = filtered.slice(start, start + itemsPerPage);
        if (!pageData.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fas fa-users"></i><p>Aucun employé trouvé</p></td></tr>';
        } else {
            pageData.forEach(emp => {
                const tr = document.createElement('tr');
                tr.setAttribute('data-department-id', emp.departement_id);
                tr.innerHTML = `
                    <td>
                        <div class="employee-info">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nomcomplet)}" alt="${emp.nomcomplet}" class="employee-avatar">
                            <div class="employee-details">
                                <span class="employee-name">${emp.nomcomplet}</span>
                                <span class="employee-id">ID: ${emp.id}</span>
                            </div>
                        </div>
                    </td>
                    <td>${emp.departement_nom || 'Non assigné'}</td>
                    <td><span class="role-badge ${emp.groupeid === 1 ? 'manager' : 'employee'}">${emp.groupeid === 1 ? 'Manager' : 'Employé'}</span></td>
                    <td>${emp.email}</td>
                    <td><span class="status-badge ${emp.conge ? 'on-leave' : 'active'}">${emp.conge ? 'En congé' : 'Actif'}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }
        // Update pagination controls
        pageNumbers.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const span = document.createElement('span');
            span.className = 'page-number' + (i === currentPage ? ' active' : '');
            span.textContent = i;
            span.addEventListener('click', () => { currentPage = i; renderTable(); updatePagination(); });
            pageNumbers.appendChild(span);
        }
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
    }

    function updatePagination() {
        renderTable();
    }

    prevBtn.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            updatePagination();
        }
    });
    nextBtn.addEventListener('click', function() {
        const filtered = getFilteredEmployees();
        const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
        if (currentPage < totalPages) {
            currentPage++;
            updatePagination();
        }
    });
    searchInput.addEventListener('input', function() {
        currentPage = 1;
        updatePagination();
    });
    roleFilter.addEventListener('change', function() {
        currentPage = 1;
        updatePagination();
    });
    departmentFilter.addEventListener('change', function() {
        currentPage = 1;
        updatePagination();
    });
    statusFilter.addEventListener('change', function() {
        currentPage = 1;
        updatePagination();
    });
    resetButton.addEventListener('click', function() {
        searchInput.value = '';
        roleFilter.value = '';
        departmentFilter.value = '';
        statusFilter.value = '';
        currentPage = 1;
        updatePagination();
    });
    // Initial render
    updatePagination();
}

// --- Pending Requests Pagination (Demandes à Traiter) ---
function initializePendingRequestsPagination() {
    const demandes = window.leaveRequestsFromServer?.filter(d => d.etat === 0) || [];
    let currentPage = 1;
    const itemsPerPage = 5;

    function renderPendingRequests() {
        const container = document.getElementById('pendingRequestsList');
        if (!container) return;
        container.innerHTML = '';
        const start = (currentPage - 1) * itemsPerPage;
        const pageData = demandes.slice(start, start + itemsPerPage);
        if (!pageData.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Aucune demande à traiter</p></div>';
            return;
        }
        pageData.forEach(demande => {
            const card = document.createElement('div');
            card.className = 'request-card';
            card.innerHTML = `
                <div class="request-info">
                    <div class="employee-info">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(demande.employee_name)}" alt="${demande.employee_name}" class="employee-avatar">
                        <div class="employee-details">
                            <span class="employee-name">${demande.employee_name}</span>
                            <span class="request-dates">${demande.date_debut ? (demande.date_debut.toString().slice(0,10)) : ''} - ${demande.date_fin ? (demande.date_fin.toString().slice(0,10)) : ''}</span>
                        </div>
                    </div>
                    <span class="request-type">${demande.nature}</span>
                    <span class="request-motif">${demande.motif}</span>
                </div>
                <div class="action-buttons">
                    <form method="POST" action="/update-etat/${demande.id}">
                        <button class="action-btn approve" title="Approuver">
                            <i class="fas fa-check"></i>
                            <span>Approuver</span>
                        </button>
                    </form>
                    <form method="POST" action="/annuler-demande/${demande.id}">
                        <button class="action-btn reject" title="Refuser">
                            <i class="fas fa-times"></i>
                            <span>Refuser</span>
                        </button>
                    </form>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function renderPagination() {
        const pagination = document.getElementById('pendingRequestsPagination');
        if (!pagination) return;
        pagination.className = 'pagination pending-requests-pagination';
        const totalPages = Math.ceil(demandes.length / itemsPerPage) || 1;
        pagination.innerHTML = '';
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderPendingRequests(); renderPagination(); } };
        pagination.appendChild(prevBtn);
        for (let i = 1; i <= totalPages; i++) {
            const span = document.createElement('span');
            span.className = 'page-number' + (i === currentPage ? ' active' : '');
            span.textContent = i;
            span.onclick = () => { currentPage = i; renderPendingRequests(); renderPagination(); };
            pagination.appendChild(span);
        }
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderPendingRequests(); renderPagination(); } };
        pagination.appendChild(nextBtn);
    }

    renderPendingRequests();
    renderPagination();
}

// Calendar functionality
document.addEventListener('DOMContentLoaded', function() {
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
            dayElement.textContent = day;
            
            const currentDate = new Date(currentYear, currentMonth, day);
            
            // Add today class if applicable
            if (isToday(currentDate)) {
                dayElement.classList.add('today');
            }
            
            // Add leave status classes
            const leaveStatus = getLeaveStatus(currentDate);
            if (leaveStatus) {
                dayElement.classList.add(`leave-${leaveStatus}`);
            }

            calendarDays.appendChild(dayElement);
        }
    }

    // Event listeners for month navigation
    prevMonthBtn.addEventListener('click', () => {
        if (currentMonth === 0) {
            currentMonth = 11;
            currentYear--;
        } else {
            currentMonth--;
        }
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        if (currentMonth === 11) {
            currentMonth = 0;
            currentYear++;
        } else {
            currentMonth++;
        }
        renderCalendar();
    });

    // Initial render
    renderCalendar();
});

function initializeHistoryTablePagination() {
    const table = document.getElementById('historyTable');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr.history-row'));
    const rowsPerPage = 7;
    let currentPage = 1;
    let totalPages = Math.ceil(rows.length / rowsPerPage);
    const pagination = document.getElementById('historyPagination');

    function renderTable() {
        rows.forEach(row => row.style.display = 'none');
        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        rows.slice(start, end).forEach(row => row.style.display = '');
    }

    function renderPagination() {
        pagination.innerHTML = '';
        if (totalPages <= 1) return;
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = 'pagination-btn' + (i === currentPage ? ' active' : '');
            btn.addEventListener('click', function () {
                currentPage = i;
                renderTable();
                renderPagination();
            });
            pagination.appendChild(btn);
        }
    }

    if (rows.length > 0) {
        renderTable();
        renderPagination();
    }
}

// Modern confirmation popup for delete
function showDeleteConfirmation(callback) {
    // Remove any existing popup
    document.querySelectorAll('.delete-confirm-overlay').forEach(el => el.remove());
    const overlay = document.createElement('div');
    overlay.className = 'delete-confirm-overlay';
    overlay.innerHTML = `
        <div class="delete-confirm-popup">
            <h3>Supprimer la demande ?</h3>
            <p>Êtes-vous sûr de vouloir supprimer cette demande en attente ? Cette action est irréversible.</p>
            <div class="popup-actions">
                <button class="popup-btn cancel">Annuler</button>
                <button class="popup-btn delete">Supprimer</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.popup-btn.cancel').onclick = function() {
        overlay.remove();
        callback(false);
    };
    overlay.querySelector('.popup-btn.delete').onclick = function() {
        overlay.remove();
        callback(true);
    };
    // Allow closing with Escape
    overlay.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            overlay.remove();
            callback(false);
        }
    });
    overlay.tabIndex = -1;
    overlay.focus();
}