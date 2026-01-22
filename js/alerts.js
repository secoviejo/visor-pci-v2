export class AlertSystem {
    constructor() {
        this.alerts = [];
        this.panel = null;
        this.tableBody = null;
        this.isOpen = true; // Panel default state
        this.filterStatus = 'ALL';

        // Context stored for current view (mostly for distinguishing origins if needed)
        this.currentContext = {};

        this.loadState();
    }

    setFilter(status) {
        this.filterStatus = status;
        this.render();
    }

    init(panelElement) {
        this.panel = panelElement;
        this.tableBody = this.panel.querySelector('#alerts-table-body');
        this.render();
    }

    setContext(buildingId, floorId) {
        this.currentContext = { buildingId, floorId };
    }

    raiseAlert(payload) {
        // payload: { elementId, type, buildingId, floorId, location, description, origin }

        // Avoid duplicates for active alerts
        const existing = this.alerts.find(a =>
            a.elementId === payload.elementId &&
            a.type === payload.type &&
            a.status === 'ACTIVA'
        );

        if (existing) return;

        const newAlert = {
            id: Date.now() + '-' + Math.floor(Math.random() * 1000),
            elementId: payload.elementId,
            type: payload.type, // detector, pulsador, etc.
            buildingId: payload.buildingId, // For filter/display
            floorId: payload.floorId,
            location: payload.location || '---',
            description: payload.description || '---',
            startedAt: new Date().toISOString(),
            endedAt: null,
            status: 'ACTIVA',
            origin: payload.origin || 'SIMULACIÓN'
        };

        this.alerts.unshift(newAlert); // Add to top
        this.saveState();
        this.render();
    }

    resolveAlert(elementId, type) {
        const alert = this.alerts.find(a =>
            a.elementId === elementId &&
            a.type === type &&
            a.status === 'ACTIVA'
        );

        if (alert) {
            alert.status = 'RESUELTA';
            alert.endedAt = new Date().toISOString();
            this.saveState();
            this.render();
        }
    }

    clearResolved() {
        this.alerts = this.alerts.filter(a => a.status === 'ACTIVA');
        this.saveState();
        this.render();
    }

    saveState() {
        localStorage.setItem('pci_alerts_v1', JSON.stringify(this.alerts));
    }

    loadState() {
        const raw = localStorage.getItem('pci_alerts_v1');
        if (raw) {
            try {
                this.alerts = JSON.parse(raw);
            } catch (e) {
                console.error("Error loading alerts", e);
                this.alerts = [];
            }
        }
    }

    render() {
        if (!this.tableBody) return;

        this.tableBody.innerHTML = '';

        let filtered = this.alerts;
        if (this.filterStatus !== 'ALL') {
            filtered = this.alerts.filter(a => a.status === this.filterStatus);
        }

        // Sort: Active first, then by time desc
        const sorted = [...filtered].sort((a, b) => {
            if (a.status === b.status) {
                return new Date(b.startedAt) - new Date(a.startedAt);
            }
            return a.status === 'ACTIVA' ? -1 : 1;
        });

        sorted.forEach(alert => {
            const row = document.createElement('tr');

            // Base classes
            let rowClasses = 'border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group text-xs text-gray-600 dark:text-gray-400 font-medium';

            // Status specific row styling
            if (alert.status === 'ACTIVA') {
                rowClasses += ' bg-red-50/50 dark:bg-red-900/10 border-l-2 border-l-red-500';
                // We can add a subtle pulse if needed, but background tint is usually enough
            } else {
                rowClasses += ' border-l-2 border-l-transparent';
            }

            row.className = rowClasses;

            // Format Time
            const timeStr = new Date(alert.startedAt).toLocaleTimeString();

            // Badge Logic
            const originClass = alert.origin === 'SIMULACIÓN'
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800';

            const statusClass = alert.status === 'ACTIVA'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 animate-pulse'
                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';

            row.innerHTML = `
                <td class="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-500 transition-colors">${alert.buildingId}</td>
                <td class="px-4 py-3">${alert.floorId}</td>
                <td class="px-4 py-3 font-mono text-gray-500">${alert.elementId}</td>
                <td class="px-4 py-3 uppercase text-[10px] tracking-wide">${alert.type}</td>
                <td class="px-4 py-3 truncate max-w-[150px]" title="${alert.location}">${alert.location}</td>
                <td class="px-4 py-3 font-mono">${timeStr}</td>
                <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${originClass}">${alert.origin}</span></td>
                <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${statusClass}">${alert.status}</span></td>
            `;

            row.addEventListener('click', () => {
                // Dispatch event for App to handle centering
                window.dispatchEvent(new CustomEvent('pci:alert:click', {
                    detail: {
                        elementId: alert.elementId,
                        floorId: alert.floorId,
                        buildingId: alert.buildingId
                    }
                }));
            });

            this.tableBody.appendChild(row);
        });
    }

    refreshSummary() {
        // If simulator is present, cross-check
        if (window.simulator) {
            const isSimActive = window.simulator.isActive;
            const activeIds = window.simulator.activeDeviceIds; // Set of strings

            this.alerts.forEach(alert => {
                if (alert.origin === 'SIMULACIÓN' && alert.status === 'ACTIVA') {
                    // It should only be active if simulator is ON AND it's in activeIds
                    const stillActive = isSimActive && activeIds.has(alert.elementId.toString());
                    if (!stillActive) {
                        alert.status = 'RESUELTA';
                        alert.endedAt = new Date().toISOString();
                    }
                }
            });
            this.saveState();
            this.render();
        }
    }
}
