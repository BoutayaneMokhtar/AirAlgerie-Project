console.log('admin-portal.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded');
  
  // Prevent notifications on page refresh
  sessionStorage.setItem('preventNotification', 'true');
  
  // Check if there's a notification to show from a previous report creation
  if (sessionStorage.getItem('reportCreated')) {
    sessionStorage.removeItem('reportCreated');
    return;
  }

  // Report Form Popup functionality
  const createReportBtn = document.getElementById('createReportBtn');
  const reportFormPopup = document.getElementById('reportFormPopup');
  const closeReportForm = document.getElementById('closeReportForm');
  let reportForm = document.getElementById('reportForm');

  console.log('Elements found:', {
    createReportBtn: !!createReportBtn,
    reportFormPopup: !!reportFormPopup,
    closeReportForm: !!closeReportForm,
    reportForm: !!reportForm
  });

  // Function to close the report form
  function closeReportFormPopup() {
    if (reportFormPopup) {
      reportFormPopup.style.display = 'none';
      if (reportForm) {
        reportForm.reset();
      }
    }
  }

  if (createReportBtn) {
    createReportBtn.addEventListener('click', () => {
      console.log('Create report button clicked');
      if (reportFormPopup) {
      reportFormPopup.style.display = 'flex';
      }
    });
  }

  // Add event listener for the close button
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'closeReportForm') {
      console.log('Close report form clicked');
      closeReportFormPopup();
    }
  });

  // Close popup when clicking outside
  if (reportFormPopup) {
  reportFormPopup.addEventListener('click', (e) => {
    if (e.target === reportFormPopup) {
        console.log('Clicked outside popup');
        closeReportFormPopup();
      }
    });
  }

  // Close popup when pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && reportFormPopup && reportFormPopup.style.display === 'flex') {
      closeReportFormPopup();
    }
  });

  // Handle form submission
  if (reportForm) {
    // Remove any existing event listeners
    const newReportForm = reportForm.cloneNode(true);
    reportForm.parentNode.replaceChild(newReportForm, reportForm);
    reportForm = newReportForm;

    reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitButton = e.target.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
      }

      const formData = new FormData(e.target);
      // Get the current user ID from the session or a hidden field
      const userId = document.querySelector('meta[name="user-id"]')?.content;
      if (!userId) {
      console.error('User ID not found in meta tag');
      showNotification('Erreur: Impossible de récupérer l\'ID utilisateur', 'error');
      if (submitButton) submitButton.disabled = false;
      return;
      }

      
      const data = {
        titre: formData.get('title'),
        type: formData.get('type'),
        contenu: formData.get('description'),
        user_id: userId 

        
      };
      
      console.log('Sending data to server:', data);
      
      try {
        const response = await fetch('/api/rapports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          const newRapport = await response.json();
          console.log('Report created successfully:', newRapport);
          
          // Close the form and show success message
          closeReportFormPopup();
          
          // Show success notification
          showNotification('Rapport créé avec succès', 'success');

          // Add new rapport to history
          const historyList = document.querySelector('.history-list');
          if (historyList) {
            console.log('Adding new rapport to history:', newRapport);
            
            // Remove the "no data" message if it exists
            const noDataMessage = historyList.querySelector('.no-data');
            if (noDataMessage) {
              noDataMessage.remove();
            }

            const rapportData = newRapport.data || newRapport; // Handle both response formats
            
            const newRapportElement = document.createElement('div');
            newRapportElement.className = 'history-item';
            newRapportElement.setAttribute('data-description', rapportData.contenu || '');
            newRapportElement.setAttribute('data-id', rapportData.id || '');
            newRapportElement.innerHTML = `
              <div class="history-date">${new Date(rapportData.date_creation).toLocaleDateString()}</div>
              <div class="history-content">
                <h4>${rapportData.titre || 'Sans titre'}</h4>
                <p>${rapportData.type || 'Type non spécifié'}</p>
                <div class="description" style="display: none;">${rapportData.contenu || ''}</div>
                <div class="history-meta">
                  <button class="view-btnn action-btnn" title="Voir les détails">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button class="delete-btn action-btn" title="Supprimer">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            `;
            
            // Insert new rapport at the top
            historyList.insertBefore(newRapportElement, historyList.firstChild);

            // Reinitialize buttons for the new rapport
            initializeRapportButtons();
          }

          // Update admin tasks stats
          updateAdminTasksStats();
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.message || 'Erreur lors de la création du rapport';
          console.error('Server error:', errorData);
          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error('Error creating report:', error);
        showNotification(error.message, 'error');
      } finally {
        // Re-enable the submit button
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  }

  // Initialize rapport buttons
  function initializeRapportButtons() {
    console.log('Initializing rapport buttons');
    
    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
      console.log('Found delete button:', button);
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Delete button clicked');
        
        const rapportItem = e.target.closest('.history-item');
        if (rapportItem) {
          const rapportId = rapportItem.getAttribute('data-id');
          const rapportTitle = rapportItem.querySelector('h4').textContent;
          
          // Show custom confirmation modal
          const modal = document.getElementById('deleteConfirmationModal');
          const confirmText = document.getElementById('deleteConfirmationText');
          const confirmBtn = document.getElementById('confirmDeleteBtn');
          
          confirmText.textContent = `Êtes-vous sûr de vouloir supprimer le rapport "${rapportTitle}" ?`;
          modal.style.display = 'flex';
          
          // Handle confirmation
          confirmBtn.onclick = async () => {
            try {
              const response = await fetch(`/api/rapports/${rapportId}`, {
                method: 'DELETE'
              });
              
              if (response.ok) {
          rapportItem.remove();
          showNotification('Rapport supprimé avec succès', 'success');
                
                // Check if there are any rapports left
                const historyList = document.querySelector('.history-list');
                if (historyList && !historyList.querySelector('.history-item')) {
                  historyList.innerHTML = `
                    <div class="no-data">
                      <i class="fas fa-history no-data-icon"></i>
                      <p>Aucun rapport disponible</p>
                    </div>
                  `;
                }

                // Update admin tasks stats
                updateAdminTasksStats();
              } else {
                throw new Error('Erreur lors de la suppression du rapport');
              }
            } catch (error) {
              console.error('Error deleting rapport:', error);
              showNotification(error.message, 'error');
            } finally {
              closeDeleteModal();
            }
          };
        }
      });
    });

    // View details buttons
    document.querySelectorAll('.view-btnn').forEach(button => {
      console.log('Found view button:', button);
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('View button clicked');
        
        const rapportItem = e.target.closest('.history-item');
        console.log('Rapport item:', rapportItem);
        
        if (rapportItem) {
          const title = rapportItem.querySelector('h4').textContent;
          const date = rapportItem.querySelector('.history-date').textContent;
          const type = rapportItem.querySelector('p').textContent;
          
          // Get the description from the form data if available
          const description = rapportItem.getAttribute('data-description') || 
                            rapportItem.querySelector('.description')?.textContent || 
                            'Aucune description disponible';

          console.log('Rapport details:', { title, date, type, description });

          // Update modal content
          const modal = document.getElementById('rapportDetailsModal');
          console.log('Modal element:', modal);
          
          if (modal) {
            console.log('Updating modal content');
            modal.querySelector('#rapportTitle').textContent = title;
            modal.querySelector('#rapportDate').textContent = date;
            modal.querySelector('#rapportType').textContent = type;
            modal.querySelector('#rapportDescription').textContent = description;
            
            // Show modal
            modal.style.display = 'flex';
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';
            
            console.log('Modal display style:', modal.style.display);
            console.log('Modal visibility:', modal.style.visibility);
            console.log('Modal opacity:', modal.style.opacity);
          } else {
            console.error('Modal not found');
          }
        }
      });
    });

    // Close modal when clicking close button
    const closeModal = document.querySelector('.close-modal');
    console.log('Close modal button:', closeModal);
    
    if (closeModal) {
      closeModal.addEventListener('click', () => {
        console.log('Close modal button clicked');
        const modal = document.getElementById('rapportDetailsModal');
        if (modal) {
          modal.style.display = 'none';
          modal.style.opacity = '0';
          modal.style.visibility = 'hidden';
        }
      });
    }

    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
      const modal = document.getElementById('rapportDetailsModal');
      if (modal && modal.style.display === 'flex' && !e.target.closest('.modal-content')) {
        console.log('Clicked outside modal');
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
      }
    });

    // Close modal when pressing Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('rapportDetailsModal');
        if (modal && modal.style.display === 'flex') {
          modal.style.display = 'none';
          modal.style.opacity = '0';
          modal.style.visibility = 'hidden';
        }
            }
          });
        }

  // Load existing rapports when the page loads
  async function loadRapports() {
    try {
      const response = await fetch('/api/rapports');
        if (response.ok) {
        const rapports = await response.json();
        const historyList = document.querySelector('.history-list');
        
          if (historyList) {
          if (rapports.length === 0) {
            historyList.innerHTML = `
              <div class="no-data">
                <i class="fas fa-history no-data-icon"></i>
                <p>Aucun rapport disponible</p>
              </div>
            `;
          } else {
            historyList.innerHTML = rapports.map(rapport => `
              <div class="history-item" data-description="${rapport.description || ''}" data-id="${rapport.id}">
                <div class="history-date">${new Date(rapport.date_creation).toLocaleDateString()}</div>
              <div class="history-content">
                  <h4>${rapport.title}</h4>
                  <p>${rapport.type || 'Type non spécifié'}</p>
                  <div class="description" style="display: none;">${rapport.description || 'Aucune description disponible'}</div>
                <div class="history-meta">
                  <button class="view-btnn action-btnn" title="Voir les détails">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button class="delete-btn action-btn" title="Supprimer">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              </div>
            `).join('');
            
            // Initialize buttons for the loaded rapports
            initializeRapportButtons();
          }
        }
      }
    } catch (error) {
      console.error('Error loading rapports:', error);
      showNotification('Erreur lors du chargement des rapports', 'error');
    }
  }

  // Load rapports when the page loads
  loadRapports();

  // Add search functionality for employees
  const searchInput = document.getElementById('searchEmployee');
  const employeesTable = document.getElementById('employeesTableBody');

  if (searchInput && employeesTable) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const rows = employeesTable.getElementsByTagName('tr');
      
      Array.from(rows).forEach(row => {
        const employeeName = row.querySelector('td:nth-child(1)')?.textContent?.toLowerCase() || '';
        const employeeFunction = row.querySelector('td:nth-child(2)')?.textContent?.toLowerCase() || '';
        const employeeContact = row.querySelector('td:nth-child(3)')?.textContent?.toLowerCase() || '';
        
        const matches = employeeName.includes(searchTerm) || 
                       employeeFunction.includes(searchTerm) || 
                       employeeContact.includes(searchTerm);
        
        row.style.display = matches ? '' : 'none';
      });
    });
  }
  const navLinks = document.querySelectorAll('.sidebar nav a');
  const sections = document.querySelectorAll('.section');
  const pageTitle = document.getElementById('currentPageTitle');

  function activate(link) {
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const target = link.getAttribute('href').substring(1);
    sections.forEach(sec => {
      if (sec.id === target) sec.classList.add('active');
      else sec.classList.remove('active');
    });
    
    // Extract text more precisely - get just the span content
    if (pageTitle) {
      const linkText = link.querySelector('span').textContent.trim();
      pageTitle.textContent = linkText.includes('Tableau') ? linkText : `${linkText} Administration`;
    }
  }

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault(); activate(link);
    });
  });

  // Activate default
  const defaultLink = document.querySelector('.sidebar nav a.active') || navLinks[0];
  if (defaultLink) activate(defaultLink);

  // Profile dropdown
  const profile = document.querySelector('.profile');
  if (profile) {
    profile.addEventListener('click', e => {
      e.stopPropagation(); profile.classList.toggle('active');
    });
  }
  document.addEventListener('click', () => profile?.classList.remove('active'));
  
  // Notifications dropdown
  const notificationBtn = document.querySelector('.notification-btn');
  const notificationPopup = document.querySelector('.notification-popup');
  
  if (notificationBtn && notificationPopup) {
    notificationBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notificationPopup.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
      if (!notificationBtn.contains(e.target) && !notificationPopup.contains(e.target)) {
        notificationPopup.classList.remove('active');
      }
    });
  }
  
  // Show notification function
  function showNotification(message, type) {
    console.log('Showing notification:', { message, type });
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-icon">
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
      </div>
      <div class="notification-content">
        <p>${message}</p>
      </div>
      <div class="notification-close">
        <i class="fas fa-times"></i>
      </div>
    `;
    document.body.appendChild(notification);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  // Actions buttons hover effects
  const actionButtons = document.querySelectorAll('.action-btn');
  actionButtons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-3px)';
      btn.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.1)';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.boxShadow = '';
    });
  });

  // Function to initialize all charts
  function initializeAdminCharts() {
    console.log('=== CHART INITIALIZATION STARTED ===');
    
    // Get the chart canvas
    const chartCanvas = document.getElementById('effectifChart');
    console.log('Chart canvas element:', chartCanvas);
    
    if (!chartCanvas) {
        console.error('❌ Chart canvas not found!');
        return;
    }

    // Get the current month and year
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Set initial values in selects
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    
    if (monthSelect) {
        monthSelect.value = currentMonth;
    }

    // Function to update chart data
    async function updateChartData() {
        try {
            const selectedMonth = monthSelect ? monthSelect.value : currentMonth;
            const selectedYear = yearSelect ? yearSelect.value : currentYear;
            
            console.log('Fetching data for:', { selectedMonth, selectedYear });
            const apiUrl = `/api/effectif-evolution?month=${selectedMonth}&year=${selectedYear}`;
            console.log('API URL:', apiUrl);
            
            const response = await fetch(apiUrl);
            console.log('API Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch chart data: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Received data:', data);

            if (!Array.isArray(data) || data.length === 0) {
                console.warn('No data received from API');
                return;
            }

            // Get the existing chart
            const chart = Chart.getChart(chartCanvas);
            if (!chart) {
                console.error('No chart instance found!');
                return;
            }

            // Log the data we're about to update
            console.log('Updating chart with:', {
                labels: data.map(item => item.date),
                values: data.map(item => item.count)
            });

            // Update chart data
            chart.data.labels = data.map(item => item.date);
            chart.data.datasets[0].data = data.map(item => item.count);
            
            // Add animation when updating
            chart.update('active');
            console.log('Chart updated successfully');

        } catch (error) {
            console.error('❌ Error updating chart:', error);
            showNotification('Erreur lors de la mise à jour du graphique', 'error');
        }
    }

    // Fetch year range and populate year select
    async function initializeYearSelect() {
        try {
            console.log('Fetching year range...');
            const response = await fetch('/api/effectif-year-range');
            console.log('Year range API Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch year range: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Year range data:', data);

            if (yearSelect && data.startYear && data.endYear) {
                yearSelect.innerHTML = '';
                for (let year = data.startYear; year <= data.endYear; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
                    if (year === currentYear) option.selected = true;
                    yearSelect.appendChild(option);
                }
                
                console.log('Year select populated with options:', Array.from(yearSelect.options).map(opt => opt.value));
                
                // Initial data load
                await updateChartData();
        } else {
                console.error('Year select element or year range data missing:', {
                    yearSelect: !!yearSelect,
                    startYear: data.startYear,
                    endYear: data.endYear
                });
            }
        } catch (error) {
            console.error('❌ Error initializing year select:', error);
            showNotification('Erreur lors du chargement des années', 'error');
        }
    }

    // Add event listeners for filters
    if (monthSelect) {
        monthSelect.addEventListener('change', updateChartData);
    }
    if (yearSelect) {
        yearSelect.addEventListener('change', updateChartData);
    }

    // Initialize the chart
    initializeYearSelect();
  }

  // Initialize charts when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOM LOADED - INITIALIZING CHARTS ===');
    // Initialize immediately since the chart is already created
    initializeAdminCharts();
  });

  // Function to close delete confirmation modal
  function closeDeleteModal() {
    const modal = document.getElementById('deleteConfirmationModal');
    if (modal) {
      modal.style.display = 'none';
      // Reset the confirm button's onclick handler
      const confirmBtn = document.getElementById('confirmDeleteBtn');
      if (confirmBtn) {
        confirmBtn.onclick = null;
      }
    }
  }

  // Close delete modal when clicking outside
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('deleteConfirmationModal');
    if (modal && modal.style.display === 'flex' && !e.target.closest('.modal-content')) {
      closeDeleteModal();
    }
  });

  // Close delete modal when pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDeleteModal();
    }
  });

  // Add direction filter functionality
  const directionFilter = document.getElementById('directionFilter');
  const employeeRows = document.querySelectorAll('.employee-row');

  if (directionFilter) {
    directionFilter.addEventListener('change', () => {
      const selectedDirection = directionFilter.value;
      console.log('Selected sous-direction ID:', selectedDirection);
      
      employeeRows.forEach(row => {
        const rowDirection = row.getAttribute('data-direction');
        console.log('Row sous-direction ID:', rowDirection);
        
        if (!selectedDirection || rowDirection === selectedDirection) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }

  // Document Generation and Management
  function generateDocument(requestId) {
    fetch(`/generate-document/${requestId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Document généré avec succès', 'success');
            // Refresh the table row to show download button
            const row = document.querySelector(`tr[data-request-id="${requestId}"]`);
            if (row) {
                const documentCell = row.querySelector('td:nth-child(7)');
                documentCell.innerHTML = `
                    <a href="/download-document/${requestId}" class="btn-download">
                        <i class="fas fa-file-pdf"></i> Télécharger
                    </a>
                `;
            }
        } else {
            showNotification('Erreur lors de la génération du document', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Erreur lors de la génération du document', 'error');
    });
  }

  function generateAllDocuments() {
    const button = document.getElementById('generateAllDocuments');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Génération en cours...';

    fetch('/generate-all-documents', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(`${data.count} documents générés avec succès`, 'success');
            // Refresh the page to show all download buttons
            location.reload();
        } else {
            showNotification('Erreur lors de la génération des documents', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Erreur lors de la génération des documents', 'error');
    })
    .finally(() => {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-file-download"></i> Générer Tous les Documents';
    });
  }

  function viewDocument(requestId) {
    window.open(`/view-document/${requestId}`, '_blank');
  }

  function printDocument(requestId) {
    window.open(`/print-document/${requestId}`, '_blank');
  }

  // Search and Filter Functionality
  document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchApprovedLeaves');
    const dateFilter = document.getElementById('approvedLeavesDateFilter');
    const generateAllBtn = document.getElementById('generateAllDocuments');

    if (searchInput) {
        searchInput.addEventListener('input', filterTable);
    }

    if (dateFilter) {
        dateFilter.addEventListener('change', filterTable);
    }

    if (generateAllBtn) {
        generateAllBtn.addEventListener('click', generateAllDocuments);
    }
  });

  function filterTable() {
    try {
      const searchInput = document.getElementById('searchApprovedLeaves');
      const dateFilter = document.getElementById('approvedLeavesDateFilter');
      const table = document.querySelector('.approved-leaves-table table');
      
      // If the required elements don't exist, exit the function
      if (!searchInput || !dateFilter || !table) {
        return;
      }
      
      const rows = table.getElementsByTagName('tr');
      if (rows.length <= 1) return; // No data rows to filter

      const searchTerm = (searchInput.value || '').toLowerCase();
      const filterDate = dateFilter.value;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const employeeInfo = row.querySelector('.employee-info span');
        const dateCells = row.querySelectorAll('td');
        
        // Skip if the row doesn't have the expected structure
        if (!employeeInfo || dateCells.length < 4) continue;
        
        const employeeName = (employeeInfo.textContent || '').toLowerCase();
        const startDate = dateCells[2]?.textContent || ''; // 3rd column (0-based index 2)
        const endDate = dateCells[3]?.textContent || '';   // 4th column (0-based index 3)

        const matchesSearch = searchTerm === '' || employeeName.includes(searchTerm);
        const matchesDate = !filterDate || (startDate && endDate && startDate <= filterDate && endDate >= filterDate);

        row.style.display = matchesSearch && matchesDate ? '' : 'none';
      }
    } catch (error) {
      console.error('Error in filterTable:', error);
    }
  }

  // Function to update admin tasks stats
  async function updateAdminTasksStats() {
    try {
      const response = await fetch('/api/admin-stats');
      if (response.ok) {
        const stats = await response.json();
        
        // Update the stats in the admin tasks section
        document.querySelector('.task-card:nth-child(1) .task-count').textContent = stats.documentsToGenerate || 0;
        document.querySelector('.task-card:nth-child(2) .task-count').textContent = stats.activeCount || 0;
        document.querySelector('.task-card:nth-child(3) .task-count').textContent = stats.sousDirectionsCount || 0;
        document.querySelector('.task-card:nth-child(4) .task-count').textContent = stats.reportsCount || 0;
      }
    } catch (error) {
      console.error('Error updating admin tasks stats:', error);
    }
  }
});

