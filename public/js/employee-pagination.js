// employee-pagination.js
// Simple client-side pagination for the history table in employee-portal.ejs

// employee-pagination.js
// Enhanced client-side pagination for the history table in employee-portal.ejs

document.addEventListener('DOMContentLoaded', function () {
    const table = document.getElementById('demandesTable');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    // Only paginate rows with the 'history-row' class (skip empty state row)
    const rows = Array.from(tbody.querySelectorAll('tr.history-row'));
    const rowsPerPage = 7;
    let currentPage = 1;
    let totalPages = Math.ceil(rows.length / rowsPerPage);

    // Use the existing pagination-controls div
    const pagination = table.parentNode.querySelector('.pagination-controls');

    function renderTable() {
        // Hide all rows
        rows.forEach(row => row.style.display = 'none');
        // Show only relevant rows
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
});
