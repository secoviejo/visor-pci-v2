
import * as api from './api.js';

// Elements
const tableBody = document.getElementById('table-body');
const recordCount = document.getElementById('record-count');

let allEvents = [];
let sortCol = 'time';
let sortDesc = true;

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    setupSorting();
});

window.loadHistory = async function () {
    try {
        tableBody.innerHTML = '<tr><td colspan="9" class="px-6 py-8 text-center text-gray-500 italic">Cargando datos...</td></tr>';

        // Fetch all events
        allEvents = await api.getEvents({ limit: 100 });
        if (!allEvents) throw new Error('Error al cargar historial.');

        renderTable();
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="9" class="px-6 py-8 text-center text-red-500">Error: ${err.message}</td></tr>`;
    }
}

function renderTable() {
    // Sort
    allEvents.sort((a, b) => {
        let valA = getColumnValue(a, sortCol);
        let valB = getColumnValue(b, sortCol);

        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
    });

    tableBody.innerHTML = '';

    if (allEvents.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="px-6 py-8 text-center text-gray-500">No hay registros.</td></tr>';
        recordCount.textContent = '0 registros encontrados';
        return;
    }

    allEvents.forEach(event => {
        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-0";

        // Format Date & Time
        const dateObj = new Date(event.timestamp);
        const dateStr = dateObj.toLocaleDateString('es-ES');
        const timeStr = dateObj.toLocaleTimeString('es-ES');

        // Status badge
        let statusHtml = '';
        if (event.resolved) {
            statusHtml = '<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300">Resuelta</span>';
        } else if (event.type === 'ALARM') {
            statusHtml = '<span class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 animate-pulse">ACTIVA</span>';
        } else {
            statusHtml = '<span class="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">Info</span>';
        }

        // Origin logic (Mock for now if not in DB, assuming REAL if not SIM)
        const origin = event.origin || (event.device_id.startsWith('SIM-') ? 'SIMULACIÓN' : 'REAL');

        row.innerHTML = `
            <td class="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">${dateStr}</td>
            <td class="px-6 py-4 text-gray-900 dark:text-gray-100 font-medium">${event.building_name || '-'}</td>
            <td class="px-6 py-4 text-gray-500 dark:text-gray-400">${event.floor_name || '-'}</td>
            <td class="px-6 py-4 font-mono text-xs text-blue-600 dark:text-blue-300">${event.device_id || '-'}</td>
            <td class="px-6 py-4 uppercase text-xs font-bold text-gray-700 dark:text-gray-400">${event.device_type || event.type}</td>
            <td class="px-6 py-4 text-gray-700 dark:text-gray-300">${event.location || event.device_location || '-'}</td>
            <td class="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">${timeStr}</td>
            <td class="px-6 py-4 text-xs font-semibold ${origin === 'REAL' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}">${origin}</td>
            <td class="px-6 py-4">${statusHtml}</td>
        `;
        tableBody.appendChild(row);
    });

    recordCount.textContent = `${allEvents.length} registros encontrados`;
}

function getColumnValue(obj, col) {
    switch (col) {
        case 'day':
        case 'time': return new Date(obj.timestamp).getTime();
        case 'building': return (obj.building_name || '').toLowerCase();
        case 'floor': return (obj.floor_name || '').toLowerCase();
        case 'id': return (obj.device_id || '').toLowerCase();
        case 'type': return (obj.device_type || obj.type || '').toLowerCase();
        case 'location': return (obj.location || obj.device_location || '').toLowerCase();
        case 'origin': return (obj.origin || '').toLowerCase();
        case 'status': return obj.resolved ? 1 : 0; // Simple sort: Active first (0) then Resolved (1)
        default: return '';
    }
}

function setupSorting() {
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const newCol = th.dataset.sort;

            // Toggle desc/asc if same col, otherwise default to desc
            if (sortCol === newCol) {
                sortDesc = !sortDesc;
            } else {
                sortCol = newCol;
                sortDesc = true; // Default new sorts to DESC usually better for history? Or make it ASC. Let's stick to toggle.
            }

            // Update icons
            document.querySelectorAll('.sort-icon').forEach(i => i.className = 'fa fa-sort sort-icon text-gray-600');
            const currentIcon = th.querySelector('.sort-icon');
            currentIcon.className = `fa fa-sort-${sortDesc ? 'down' : 'up'} sort-icon text-white`;

            renderTable();
        });
    });
}
