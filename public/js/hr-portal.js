// HR Portal JavaScript
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeCharts();
    initializeEmployeeManagement();
    initializeLeaveManagement();
    initializeDepartments();
    initializeNotifications();
    initializeProfilePictureUpload();
    initializeDropdowns();
    initializeDatePicker();
    initializeQuickActions();

    initializeEmployeeModal();
    initializeFilterTags();
});

// Navigation Management
function initializeNavigation() {
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('.section');
    const pageTitle = document.getElementById('currentPageTitle');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);

            // Update active states
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Show target section
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetId) {
                    section.classList.add('active');
                    if (pageTitle) pageTitle.textContent = link.querySelector('span').textContent.trim();
                }
            });
        });
    });

    // Show default section
    const defaultSection = document.querySelector('.section');
    if (defaultSection) defaultSection.classList.add('active');
}

// Dropdown Functionality
function initializeDropdowns() {
    // Profile dropdown toggle
    const profileDropdown = document.querySelector('.profile');
    if (profileDropdown) {
        profileDropdown.addEventListener('click', function (e) {
            e.stopPropagation();
            this.classList.toggle('active');
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.profile')) {
            const activeProfile = document.querySelector('.profile.active');
            if (activeProfile) {
                activeProfile.classList.remove('active');
            }
        }
    });

    // Handle dropdown menu items
    const dropdownItems = document.querySelectorAll('.dropdown-menu a');
    dropdownItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();

            if (this.classList.contains('logout')) {
                // Handle logout
                showNotification('Déconnexion en cours...', 'info');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } else {
                const targetSection = this.getAttribute('href').substring(1);
                // Activate the corresponding section or handle specific actions
                activateSection(targetSection);
            }
        });
    });
}

// Quick Actions
function initializeQuickActions() {
    const quickActions = document.querySelectorAll('.action-btn');

    quickActions.forEach(action => {
        action.addEventListener('click', function () {
            const actionType = this.getAttribute('title');

            switch (actionType) {
                case 'Nouvel employé':
                    showEmployeeModal();
                    break;
                case 'Nouvelle demande':
                    showRequestModal();
                    break;
                case 'Exporter rapport':
                    exportReport();
                    break;
                default:
                    break;
            }
        });
    });
}

function showEmployeeModal() {
    // Implementation for showing employee creation modal
    showNotification('Création d\'un nouvel employé', 'info');
    // Additional implementation here...
}

function showRequestModal() {
    // Implementation for showing request creation modal
    showNotification('Création d\'une nouvelle demande', 'info');
    // Additional implementation here...
}

function exportReport() {
    // Implementation for exporting reports
    showNotification('Exportation du rapport en cours...', 'info');
    setTimeout(() => {
        showNotification('Rapport exporté avec succès', 'success');
    }, 1500);
    // Additional implementation here...
}

// Date Picker Functionality


function showSection(sectionId) {
    activateSection(sectionId);
}

function activateSection(sectionId) {
    const navLink = document.querySelector(`nav a[href="#${sectionId}"]`);
    if (navLink) {
        navLink.click();
    } else {
        showNotification(`La section "${sectionId}" n'existe pas`, 'warning');
    }
}

// Charts Initialization
window.workforceChartInstance = null;
window.departmentChartInstance = null;
window.turnoverChartInstance = null;

function initializeCharts() {
    // Workforce Evolution Chart
    const workforceCtx = document.getElementById('workforceChart')?.getContext('2d');
    if (workforceCtx) {
        // Destroy previous chart if it exists
        if (workforceChartInstance) {
            workforceChartInstance.destroy();
        }

        window.workforceChartInstance = new Chart(workforceCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun'],
                datasets: [{
                    label: 'Effectif Total',
                    data: [120, 125, 128, 130, 135, 138],
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
                        beginAtZero: false
                    }
                }
            }
        });
    }
}

// Function to play text using speech synthesis
function playText(text) {
    if (!text) {
        console.warn('No text provided to read');
        return;
    }
    
    // Stop any currently playing speech
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'fr-FR';
    speech.pitch = 1;
    speech.rate = 1;
    
    // Handle speech errors
    speech.onerror = function(event) {
        console.error('Speech synthesis error:', event);
    };
    
    window.speechSynthesis.speak(speech);
}

// Function to open edit modal
function openEditModal() {
    const editModal = document.getElementById('editModal');
    if (editModal) {
        editModal.style.display = 'flex';
    }
}

// Function to close modal
function closeModal() {
    const editModal = document.getElementById('editModal');
    if (editModal) {
        editModal.style.display = 'none';
    }
}

// Attach event listeners after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const executeButton = document.querySelector("button[title='Exécuter']");
    const editButton = document.querySelector("button[title='Modifier']");
    const cancelButton = document.querySelector("#editModal .modal-actions button:first-child");

    if (executeButton) executeButton.addEventListener('click', playText);
    if (editButton) editButton.addEventListener('click', openEditModal);
    if (cancelButton) cancelButton.addEventListener('click', closeModal);
});

// Department Distribution Chart
const departmentCtx = document.getElementById('departmentChart')?.getContext('2d');
if (departmentCtx) {
    // Destroy previous chart if it exists
    if (departmentChartInstance) {
        departmentChartInstance.destroy();
    }

    window.departmentChartInstance = new Chart(departmentCtx, {
        type: 'doughnut',
        data: {
            labels: ['Opérations', 'Maintenance', 'Commercial', 'Administration'],
            datasets: [{
                data: [45, 30, 35, 28],
                backgroundColor: ['#1e3a8a', '#c41e3a', '#059669', '#d97706']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Turnover Rate Chart
const turnoverCtx = document.getElementById('turnoverChart')?.getContext('2d');
if (turnoverCtx) {
    new Chart(turnoverCtx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun'], // Monthly labels
            datasets: [{
                label: 'Taux de Rotation', // Chart label
                data: [2.1, 1.8, 2.3, 1.9, 2.0, 1.7], // Data points for each month
                backgroundColor: '#c41e3a' // Bar color
            }]
        },
        options: {
            responsive: true, // Ensure responsiveness
            maintainAspectRatio: false, // Allow scaling
            scales: {
                y: {
                    beginAtZero: true, // Start the y-axis at 0
                    max: 5 // Set maximum value on y-axis
                }
            }
        }
    });
}


// Employee Management


// function populateTableView(employees) {
//     const employeeTable = document.querySelector('.employee-table tbody');
//     if (!employeeTable) return;

//     // Clear existing content
//     employeeTable.innerHTML = '';

//     // Add employees
//     employees.forEach(employee => {
//         const row = document.createElement('tr');
//         row.setAttribute('data-employee-id', employee.id);
//         row.innerHTML = `
//             <td>
//                 <input type="checkbox" class="employee-checkbox" data-employee-id="${employee.id}">
//             </td>
//             <td>
//                 <div class="employee-info">
//                     <img src="https://ui-avatars.com/api/?name=${employee.name.replace(' ', '+')}" alt="${employee.name}">
//                     <div>
//                         <h4>${employee.name}</h4>
//                         <span>${employee.email}</span>
//                     </div>
//                 </div>
//             </td>
//             <td>${employee.id}</td>
//             <td>${employee.department}</td>
//             <td>${employee.position}</td>
//             <td>
//                 <span class="status-badge ${employee.status === 'active' ? 'active' : employee.status === 'leave' ? 'leave' : 'training'}">
//                     ${employee.status === 'active' ? 'Actif' : employee.status === 'leave' ? 'En congé' : 'En formation'}
//                 </span>
//             </td>
//             <td>
//                 <div class="performance-indicator">
//                     <div class="progress-bar">
//                         <div class="progress" style="width: ${employee.performance}%"></div>
//                     </div>
//                     <span>${employee.performance}%</span>
//                 </div>
//             </td>
//             <td>
//                 <div class="action-buttons">
//                     <button title="Éditer" onclick="openEmployeeModal('${employee.id}')"><i class="fas fa-edit"></i></button>
//                     <button title="Documents"><i class="fas fa-file-alt"></i></button>
//                     <button title="Plus"><i class="fas fa-ellipsis-v"></i></button>
//                 </div>
//             </td>
//         `;
//         employeeTable.appendChild(row);
//     });

//     // Add click handler to open employee modal
//     document.querySelectorAll('.employee-table tbody tr').forEach(row => {
//         row.addEventListener('click', (e) => {
//             if (!e.target.closest('input[type="checkbox"]') && !e.target.closest('.action-buttons')) {
//                 const employeeId = row.getAttribute('data-employee-id');
//                 openEmployeeModal(employeeId);
//             }
//         });
//     });
// }

// function populateGridView(employees) {
//     const employeesGrid = document.querySelector('.employees-grid');
//     if (!employeesGrid) return;

//     // Clear existing content
//     employeesGrid.innerHTML = '';

//     // Add employees
//     employees.forEach(employee => {
//         const gridItem = document.createElement('div');
//         gridItem.className = 'employee-grid-item';
//         gridItem.setAttribute('data-employee-id', employee.id);
//         gridItem.innerHTML = `
//             <div class="employee-grid-header">
//                 <div class="employee-grid-avatar">
//                     <img src="https://ui-avatars.com/api/?name=${employee.name.replace(' ', '+')}" alt="${employee.name}">
//                 </div>
//                 <div class="employee-grid-info">
//                     <h3>${employee.name}</h3>
//                     <p>${employee.position}</p>
//                 </div>
//                 <span class="status-badge ${employee.status === 'active' ? 'active' : employee.status === 'leave' ? 'leave' : 'training'}">
//                     ${employee.status === 'active' ? 'Actif' : employee.status === 'leave' ? 'En congé' : 'En formation'}
//                 </span>
//             </div>
//             <div class="employee-grid-body">
//                 <div class="employee-grid-details">
//                     <div class="detail-item">
//                         <span class="detail-label">ID</span>
//                         <span>${employee.id}</span>
//                     </div>
//                     <div class="detail-item">
//                         <span class="detail-label">Email</span>
//                         <span>${employee.email}</span>
//                     </div>
//                     <div class="detail-item">
//                         <span class="detail-label">Département</span>
//                         <span>${employee.department}</span>
//                     </div>
//                     <div class="detail-item">
//                         <span class="detail-label">Date d'embauche</span>
//                         <span>${employee.joinDate}</span>
//                     </div>
//                     <div class="detail-item">
//                         <span class="detail-label">Performance</span>
//                         <div class="performance-indicator small">
//                             <div class="progress-bar">
//                                 <div class="progress" style="width: ${employee.performance}%"></div>
//                             </div>
//                             <span>${employee.performance}%</span>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//             <div class="employee-grid-footer">
//                 <button title="Éditer" onclick="openEmployeeModal('${employee.id}')"><i class="fas fa-edit"></i></button>
//                 <button title="Documents"><i class="fas fa-file-alt"></i></button>
//                 <button title="Email"><i class="fas fa-envelope"></i></button>
//                 <button title="Plus"><i class="fas fa-ellipsis-v"></i></button>
//             </div>
//         `;
//         employeesGrid.appendChild(gridItem);
//     });

//     // Add click handler to open employee modal
//     document.querySelectorAll('.employee-grid-item').forEach(item => {
//         item.addEventListener('click', (e) => {
//             if (!e.target.closest('button')) {
//                 const employeeId = item.getAttribute('data-employee-id');
//                 openEmployeeModal(employeeId);
//             }
//         });
//     });
// }

// function populateCardView(employees) {
//     const employeesCards = document.querySelector('.employees-cards');
//     if (!employeesCards) return;

//     // Clear existing content
//     employeesCards.innerHTML = '';

//     // Add employees
//     employees.forEach(employee => {
//         const card = document.createElement('div');
//         card.className = 'employee-card';
//         card.setAttribute('data-employee-id', employee.id);
//         card.innerHTML = `
//             <div class="employee-card-avatar">
//                 <img src="https://ui-avatars.com/api/?name=${employee.name.replace(' ', '+')}" alt="${employee.name}">
//             </div>
//             <div class="employee-card-info">
//                 <div class="employee-card-header">
//                     <h3>${employee.name}</h3>
//                     <p>${employee.position}</p>
//                 </div>
//                 <div class="employee-card-details">
//                     <div class="detail-item">
//                         <i class="fas fa-id-badge"></i>
//                         <span>${employee.id}</span>
//                     </div>
//                     <div class="detail-item">
//                         <i class="fas fa-building"></i>
//                         <span>${employee.department}</span>
//                     </div>
//                     <div class="detail-item">
//                         <i class="fas fa-circle ${employee.status === 'active' ? 'text-success' : employee.status === 'leave' ? 'text-warning' : 'text-info'}"></i>
//                         <span>${employee.status === 'active' ? 'Actif' : employee.status === 'leave' ? 'En congé' : 'En formation'}</span>
//                     </div>
//                 </div>
//                 <div class="employee-card-actions">
//                     <button title="Éditer" onclick="openEmployeeModal('${employee.id}')"><i class="fas fa-edit"></i></button>
//                     <button title="Documents"><i class="fas fa-file-alt"></i></button>
//                     <button title="Email"><i class="fas fa-envelope"></i></button>
//                 </div>
//             </div>
//         `;
//         employeesCards.appendChild(card);
//     });

//     // Add click handler to open employee modal
//     document.querySelectorAll('.employee-card').forEach(card => {
//         card.addEventListener('click', (e) => {
//             if (!e.target.closest('button')) {
//                 const employeeId = card.getAttribute('data-employee-id');
//                 openEmployeeModal(employeeId);
//             }
//         });
//     });
// }

// function filterEmployees() {
//     const departmentFilter = document.querySelector('select[name="department"]')?.value || '';
//     const statusFilter = document.querySelector('select[name="status"]')?.value || '';
//     const positionFilter = document.querySelector('select[name="position"]')?.value || '';
//     const seniorityFilter = document.querySelector('select[name="seniority"]')?.value || '';

//     // Update filter tags
//     updateFilterTags({
//         department: departmentFilter,
//         status: statusFilter,
//         position: positionFilter,
//         seniority: seniorityFilter
//     });

//     // Filter table view
//     document.querySelectorAll('.employee-table tbody tr').forEach(row => {
//         const department = row.querySelector('td:nth-child(4)')?.textContent || '';
//         const statusClass = row.querySelector('.status-badge')?.className || '';
//         const position = row.querySelector('td:nth-child(5)')?.textContent || '';

//         const matchesDepartment = !departmentFilter || department.includes(departmentFilter);
//         const matchesStatus = !statusFilter || statusClass.includes(statusFilter);
//         const matchesPosition = !positionFilter || position.includes(positionFilter);
//         // Add logic for seniority if needed 
//         const matchesSeniority = !seniorityFilter;

//         row.style.display = (matchesDepartment && matchesStatus && matchesPosition && matchesSeniority) ? '' : 'none';
//     });
// }

// function updateFilterTags(filters) {
//     const filterTagsContainer = document.querySelector('.filter-tags');
//     if (!filterTagsContainer) return;

//     // Clear current tags except for the clear button
//     Array.from(filterTagsContainer.children).forEach(child => {
//         if (!child.classList.contains('clear-filters')) {
//             child.remove();
//         }
//     });

//     // Add filter tags
//     const clearButton = filterTagsContainer.querySelector('.clear-filters');

//     let hasFilters = false;

//     if (filters.department) {
//         const tag = createFilterTag(filters.department, 'department');
//         filterTagsContainer.insertBefore(tag, clearButton);
//         hasFilters = true;
//     }

//     if (filters.status) {
//         const statusText = filters.status === 'active' ? 'Actif' : 
//                           filters.status === 'leave' ? 'En congé' : 
//                           filters.status === 'training' ? 'En formation' : '';
//         if (statusText) {
//             const tag = createFilterTag(statusText, 'status');
//             filterTagsContainer.insertBefore(tag, clearButton);
//             hasFilters = true;
//         }
//     }

//     if (filters.position) {
//         const tag = createFilterTag(filters.position, 'position');
//         filterTagsContainer.insertBefore(tag, clearButton);
//         hasFilters = true;
//     }

//     if (filters.seniority) {
//         const seniorityText = filters.seniority === 'less-than-1' ? 'Moins de 1 an' : 
//                             filters.seniority === '1-3' ? '1-3 ans' : 
//                             filters.seniority === '3-5' ? '3-5 ans' : 
//                             filters.seniority === 'more-than-5' ? 'Plus de 5 ans' : '';
//         if (seniorityText) {
//             const tag = createFilterTag(seniorityText, 'seniority');
//             filterTagsContainer.insertBefore(tag, clearButton);
//             hasFilters = true;
//         }
//     }

//     // Show/hide clear button
//     clearButton.style.display = hasFilters ? '' : 'none';
// }

// function createFilterTag(text, filterType) {
//     const tag = document.createElement('span');
//     tag.className = 'filter-tag';
//     tag.innerHTML = `${text}<i class="fas fa-times"></i>`;
//     tag.setAttribute('data-filter-type', filterType);

//     tag.querySelector('i').addEventListener('click', () => {
//         // Reset the corresponding filter
//         const select = document.querySelector(`select[name="${filterType}"]`);
//         if (select) {
//             select.value = '';
//             filterEmployees();
//         }
//     });

//     return tag;
// }

// function initializeFilterTags() {
//     const clearFiltersBtn = document.querySelector('.clear-filters');
//     if (clearFiltersBtn) {
//         clearFiltersBtn.addEventListener('click', () => {
//             // Reset all filters
//             document.querySelectorAll('.filter-group select').forEach(select => {
//                 select.value = '';
//             });
//             filterEmployees();
//         });
//     }

//     // Handle clicking on individual filter tags
//     document.addEventListener('click', (e) => {
//         if (e.target.closest('.filter-tag i')) {
//             const tag = e.target.closest('.filter-tag');
//             const filterType = tag.getAttribute('data-filter-type');

//             // Reset the corresponding filter
//             const select = document.querySelector(`select[name="${filterType}"]`);
//             if (select) {
//                 select.value = '';
//                 filterEmployees();
//             }
//         }
//     });
// }

// View Toggle for Employee Management
// function initializeViewToggle() {
const viewButtons = document.querySelectorAll('.view-btn');
const employeeViews = document.querySelectorAll('.employee-view');

viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const viewType = btn.getAttribute('data-view');

        // Update active state for buttons
        viewButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active state for views
        employeeViews.forEach(view => {
            view.classList.remove('active');
            if (view.classList.contains(`${viewType}-view`)) {
                view.classList.add('active');
            }
        });
    });
});
document.querySelector(".employee-view.table-view")?.classList.add("active");

// }

// Employee Modal Management
function initializeEmployeeModal() {
    const modal = document.querySelector('.employee-modal');
    const closeModalBtn = document.querySelector('.close-modal');

    if (closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // Close modal when clicking outside the content
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                modal.classList.remove('active');
            }
        });

        // Handle tab navigation in modal
        const tabs = document.querySelectorAll('.employee-tabs .tab');
        const tabContents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabType = tab.getAttribute('data-tab');

                // Update active state for tabs
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update active state for tab contents
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.getAttribute('data-content') === tabType) {
                        content.classList.add('active');
                    }
                });
            });
        });
    }
}

// Open Employee Modal


function initializeBulkActions() {
    const selectAllCheckbox = document.querySelector('.select-all');
    const employeeCheckboxes = document.querySelectorAll('.employee-checkbox');
    const bulkActionSelect = document.querySelector('.bulk-action-select');
    const applyBulkActionBtn = document.querySelector('.apply-bulk-action');

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', () => {
            const isChecked = selectAllCheckbox.checked;
            employeeCheckboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
            updateBulkActionState();
        });
    }

    employeeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateBulkActionState();
        });
    });

    if (applyBulkActionBtn && bulkActionSelect) {
        applyBulkActionBtn.addEventListener('click', () => {
            const selectedAction = bulkActionSelect.value;
            if (!selectedAction) return;

            const selectedEmployeeIds = Array.from(document.querySelectorAll('.employee-checkbox:checked'))
                .map(checkbox => checkbox.getAttribute('data-employee-id'));

            // Handle different actions
            switch (selectedAction) {
                case 'export':
                    showNotification(`Exportation de ${selectedEmployeeIds.length} employés`, 'info');
                    break;
                case 'email':
                    showNotification(`Envoi d'emails à ${selectedEmployeeIds.length} employés`, 'info');
                    break;
                case 'status':
                    showNotification(`Modification du statut de ${selectedEmployeeIds.length} employés`, 'info');
                    break;
            }
        });
    }
}

function updateBulkActionState() {
    const checkedCount = document.querySelectorAll('.employee-checkbox:checked').length;
    const applyBulkActionBtn = document.querySelector('.apply-bulk-action');

    if (applyBulkActionBtn) {
        applyBulkActionBtn.disabled = checkedCount === 0;
        applyBulkActionBtn.textContent = checkedCount > 0 ? `Appliquer (${checkedCount})` : 'Appliquer';
    }
}

// Leave Management
function initializeEmployeeManagement() {
    const employeeTable = document.querySelector('.employee-table tbody');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const currentPageSpan = document.getElementById('currentPage');
    const totalPagesSpan = document.getElementById('totalPages');

    let currentPage = 1;
    const itemsPerPage = 10; // Number of employees per page
    const allEmployeesInfo = window.allEmployeesInfo || []; // Assuming this is passed from the server



    // Initial render
    renderEmployeeTable(currentPage);

    // Previous page button
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderEmployeeTable(currentPage);
        }
    });

    // Next page button
    nextPageBtn.addEventListener('click', () => {
        if (currentPage < Math.ceil(allEmployeesInfo.length / itemsPerPage)) {
            currentPage++;
            renderEmployeeTable(currentPage);
        }
    });

    const leaveOverview = document.querySelector('.leave-overview');
    if (!leaveOverview) return;

    leaveStats.forEach(stat => {
        const total = stat.taken + stat.remaining;
        const percentage = (stat.taken / total) * 100;

        const card = document.createElement('div');
        card.className = 'overview-card';
        card.innerHTML = `
            <div class="card-content">
                <h3>${stat.type}</h3>
                <div class="number">${stat.taken}/${total}</div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${percentage}%; background: ${stat.color}"></div>
                </div>
                <div class="trend">
                    ${percentage > 75 ? '<span class="urgent">Action requise</span>' : 'Dans les limites'}
                </div>
            </div>
        `;
        leaveOverview.appendChild(card);
    });

    // Initialize leave calendar
    initializeLeaveCalendar();
}

function initializeLeaveCalendar() {
    const calendar = document.getElementById('leaveCalendar');
    if (!calendar) return;

    const date = new Date();
    const currentMonth = date.getMonth();
    const currentYear = date.getFullYear();

    // Get the first day of the month
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();

    // Get the number of days in the month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Clear existing content
    calendar.innerHTML = '';

    // Create weekday headers
    const weekdays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    weekdays.forEach(day => {
        const weekdayCell = document.createElement('div');
        weekdayCell.className = 'calendar-weekday';
        weekdayCell.textContent = day;
        calendar.appendChild(weekdayCell);
    });

    // Create empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendar.appendChild(emptyCell);
    }

    // Create cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        if (day === date.getDate()) {
            dayCell.classList.add('today');
        }

        dayCell.innerHTML = `
            <div class="day-number">${day}</div>
            <div class="day-content">
                ${Math.random() > 0.7 ? '<div class="leave-indicator" style="background-color: var(--primary-color);">3</div>' : ''}
            </div>
        `;

        calendar.appendChild(dayCell);
    }
}

// Departments Management
function initializeDepartments() {
    const departments = [
        {
            name: 'Opérations',
            employees: 45,
            budget: '12.5M',
            performance: 92,
            positions: [
                { title: 'Chef d\'Escale', status: 'filled' },
                { title: 'Pilote Senior', status: 'vacant' },
                { title: 'Agent de Piste', status: 'filled' }
            ]
        },
        {
            name: 'Maintenance',
            employees: 30,
            budget: '8.2M',
            performance: 88,
            positions: [
                { title: 'Chef Mécanicien', status: 'filled' },
                { title: 'Technicien Avionique', status: 'vacant' },
                { title: 'Inspecteur Qualité', status: 'filled' }
            ]
        }
    ];

    const departmentsGrid = document.querySelector('.departments-grid');
    if (!departmentsGrid) return;

    departments.forEach(dept => {
        const card = document.createElement('div');
        card.className = 'department-card';
        card.innerHTML = `
            <div class="department-header">
                <div class="department-info">
                    <h3>${dept.name}</h3>
                    <span class="employee-count">${dept.employees} employés</span>
                </div>
                <div class="department-actions">
                    <button title="Modifier"><i class="fas fa-edit"></i></button>
                    <button title="Plus"><i class="fas fa-ellipsis-v"></i></button>
                </div>
            </div>
            <div class="department-stats">
                <div class="stat">
                    <span class="label">Budget Annuel</span>
                    <span class="value">${dept.budget} DA</span>
                </div>
                <div class="stat">
                    <span class="label">Performance</span>
                    <span class="value">${dept.performance}%</span>
                </div>
            </div>
            <div class="key-positions">
                <h4>Postes Clés</h4>
                ${dept.positions.map(pos => `
                    <div class="position-item">
                        <span>${pos.title}</span>
                        <span class="status ${pos.status}">${pos.status}</span>
                    </div>
                `).join('')}
            </div>
        `;
        departmentsGrid.appendChild(card);
    });
}

// Notifications Management
// function initializeNotifications() {
//     const notificationsIcon = document.querySelector('.notifications-icon');
//     const markAllReadBtn = document.querySelector('.mark-all-read');

//     if (notificationsIcon) {
//         notificationsIcon.addEventListener('click', function(e) {
//             e.stopPropagation();
//             const dropdown = this.closest('.notifications').querySelector('.notifications-dropdown');
//             dropdown.classList.toggle('show');
//         });
//     }

//     if (markAllReadBtn) {
//         markAllReadBtn.addEventListener('click', function() {
//             document.querySelectorAll('.notification-item.unread').forEach(item => {
//                 item.classList.remove('unread');
//             });

//             const badge = document.querySelector('.notifications-icon .badge');
//             if (badge) {
//                 badge.textContent = '0';
//             }

//             showNotification('Toutes les notifications ont été marquées comme lues', 'success');
//         });
//     }

//     // Close notification dropdown when clicking outside
//     document.addEventListener('click', function(e) {
//         if (!e.target.closest('.notifications')) {
//             const dropdown = document.querySelector('.notifications-dropdown.show');
//             if (dropdown) {
//                 dropdown.classList.remove('show');
//             }
//         }
//     });
// }

// function showNotification(message, type = 'info') {
//     const notificationContainer = document.getElementById('notificationContainer');

//     // Create container if it doesn't exist
//     if (!notificationContainer) {
//         const container = document.createElement('div');
//         container.id = 'notificationContainer';
//         container.style.position = 'fixed';
//         container.style.top = '20px';
//         container.style.right = '20px';
//         container.style.zIndex = '9999';
//         document.body.appendChild(container);
//     }

//     const notification = document.createElement('div');
//     notification.className = `notification ${type}`;
//     notification.innerHTML = `
//         <div class="notification-content">
//             <i class="fas ${type === 'success' ? 'fa-check-circle' : 
//                            type === 'warning' ? 'fa-exclamation-triangle' : 
//                            type === 'error' ? 'fa-times-circle' : 'fa-info-circle'}"></i>
//             <span>${message}</span>
//         </div>
//         <button class="close-btn"><i class="fas fa-times"></i></button>
//     `;

//     // Add the notification to the container
//     document.getElementById('notificationContainer').appendChild(notification);

//     // Add event listener to close button
//     notification.querySelector('.close-btn').addEventListener('click', () => {
//         notification.classList.add('hiding');
//         setTimeout(() => {
//             notification.remove();
//         }, 300);
//     });

//     // Auto-close after 5 seconds
//     setTimeout(() => {
//         notification.classList.add('hiding');
//         setTimeout(() => {
//             notification.remove();
//         }, 300);
//     }, 5000);
// }

// Profile Picture Upload Handler
function initializeProfilePictureUpload() {
    const profilePictureInput = document.getElementById('profilePictureInput');
    const profileImage = document.getElementById('profileImage');

    if (profilePictureInput && profileImage) {
        profilePictureInput.addEventListener('change', function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    profileImage.src = e.target.result;
                    showNotification('Photo de profil mise à jour avec succès', 'success');
                };
                reader.readAsDataURL(file);
            }
        });
    }
}


// const viewButtons = document.querySelectorAll(".view-btn "); // Adjust selector to your actual buttons
// const views = document.querySelectorAll(".employee-view");

// viewButtons.forEach(button => {
//     button.addEventListener("click", function () {
//         // Toggle active class
//         viewButtons.forEach(btn => btn.classList.remove("active"));
//         this.classList.add("active");

//         // Hide all views
//         views.forEach(view => view.classList.remove("active"));

//         // Show selected view
//         const selectedView = this.getAttribute("data-view");
//         const target = document.querySelector(`.employee-view.${selectedView}-view`);
//         if (target) target.classList.add("active");
//     });
// });

// Optional: Set default view


// modal-rapport js 
document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('rapportModalR');
    const modalContent = document.querySelector('.modalR-content');
    const form = document.getElementById('rapportFormR');
    const closeBtn = document.querySelector('.close-modalR');
    const cancelBtn = document.querySelector('.btn-cancel');
    const notifBadges = document.querySelectorAll('.notif-badge');

    let isModalOpen = false;
    let openTimeout = null;

    // Open Modal
    function openModal(employee) {
        if (isModalOpen) return;

        // Set values
        document.getElementById('employeeId').value = employee.id;
        document.getElementById('employeeName').value = employee.name;
        document.getElementById('destinataire').value = employee.name;

        // Prevent animation glitches
        modal.style.display = 'block';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';

        // Allow DOM to paint before transition
        openTimeout = setTimeout(() => {
            modal.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
            isModalOpen = true;
            document.getElementById('titre').focus();
        }, 10);
    }

    // Close Modal
    function closeModal() {
        if (!isModalOpen) return;
        if (openTimeout) clearTimeout(openTimeout);

        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        isModalOpen = false;

        setTimeout(() => {
            modal.style.display = 'none';
            form.reset();
        }, 300); // matches CSS transition if any
    }

    // Prevent event bubbling inside modal
    modalContent.addEventListener('click', e => e.stopPropagation());

    // Click outside modal to close
    modal.addEventListener('click', function (event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Close buttons
    closeBtn.addEventListener('click', e => {
        e.stopPropagation();
        closeModal();
    });

    cancelBtn.addEventListener('click', e => {
        e.stopPropagation();
        closeModal();
    });

    // Open modal from badge click
    notifBadges.forEach(badge => {
        badge.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const employeeItem = this.closest('.top-release-item');
            const employeeName = employeeItem.querySelector('h4')?.textContent.trim();
            const employeeMatricule = employeeItem.querySelector('p')?.textContent.trim();

            if (employeeName && employeeMatricule) {
                openModal({
                    id: employeeMatricule,
                    name: employeeName
                });
            }
        });
    });

    // Handle form submission
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const formData = new FormData(this);
        const rapportData = {
            employee_id: formData.get('employee_id'),
            employee_name: formData.get('employee_name'),
            titre: formData.get('titre'),
            type: formData.get('type'),
            destinataire: formData.get('destinataire'),
            contenu: formData.get('contenu')
        };

        submitRapport(rapportData);
    });

    // Send data to server
    function submitRapport(rapportData) {
        fetch('/soumettre-rapport', {
            method: 'POST',
            credentials: 'include', // Include cookies for session authentication
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(rapportData)
        })
            .then(response => {
                if (!response.ok) throw new Error('Erreur lors de la soumission du rapport');
                return response.json();
            })
            .then(data => {
                alert('Rapport soumis avec succès!');
                closeModal();
            })
            .catch(error => {
                console.error('Erreur:', error);
                alert('Une erreur est survenue lors de la soumission du rapport.');
            });
    }
});




