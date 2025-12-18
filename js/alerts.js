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
            row.className = `alert-row ${alert.status.toLowerCase()}`;
            if (alert.status === 'ACTIVA') row.classList.add('blink-row');

            // Format Time
            const timeStr = new Date(alert.startedAt).toLocaleTimeString();

            row.innerHTML = `
                <td>${alert.buildingId}</td>
                <td>${alert.floorId}</td>
                <td>${alert.elementId}</td>
                <td>${alert.type}</td>
                <td>${alert.location}</td>
                <td>${timeStr}</td>
                <td><span class="badge ${alert.origin.toLowerCase()}">${alert.origin}</span></td>
                <td><span class="status-pill ${alert.status.toLowerCase()}">${alert.status}</span></td>
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
