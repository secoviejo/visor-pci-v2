export class Simulator {
    constructor() {
        this.isActive = false;
        this.activeDeviceIds = new Set();
        this.currentDevices = [];
        this.buildingId = null;
        this.floorId = null;

        // UI References
        this.panel = document.getElementById('simulator-panel');
        this.listContainer = document.getElementById('sim-list-container');
        this.toggleGlobalBtn = document.getElementById('sim-toggle-global');
        this.countLabel = document.getElementById('sim-active-count');
        this.filterInput = document.getElementById('sim-filter-input');

        this.init();
    }

    init() {
        console.log("Simulator Initialized");
        if (this.toggleGlobalBtn) {
            this.toggleGlobalBtn.addEventListener('click', () => this.toggleSimulation(!this.isActive));
        }

        // Setup other event listeners (filtering, bulk actions) here
        document.getElementById('sim-btn-all')?.addEventListener('click', () => this.setAll(true));
        document.getElementById('sim-btn-none')?.addEventListener('click', () => this.setAll(false));

        this.filterInput?.addEventListener('input', (e) => this.renderList(e.target.value));
    }

    loadContext(buildingId, floorId, devices) {
        this.buildingId = buildingId;
        this.floorId = floorId;
        this.currentDevices = devices;

        // Load state from local storage or reset
        this.loadState();

        this.renderList();
        this.updateVisuals();
    }

    toggleSimulation(active) {
        this.isActive = active;
        if (this.isActive) {
            this.panel.classList.add('sim-active');
            this.toggleGlobalBtn.classList.add('active');
            this.toggleGlobalBtn.textContent = "Simulación ON";

            // When enabling, make sure all active devices are notified to the alert system
            this.activeDeviceIds.forEach(id => this.emitEvent('pci:alarm:on', id));
        } else {
            this.panel.classList.remove('sim-active');
            this.toggleGlobalBtn.classList.remove('active');
            this.toggleGlobalBtn.textContent = "Simulación OFF";
        }
        this.updateVisuals();
        this.saveState();
    }

    setAll(active) {
        if (active) {
            this.currentDevices.forEach(d => {
                if (!this.activeDeviceIds.has(d.db_id.toString())) {
                    this.activeDeviceIds.add(d.db_id.toString());
                    this.emitEvent('pci:alarm:on', d.db_id);
                }
            });
        } else {
            this.currentDevices.forEach(d => {
                if (this.activeDeviceIds.has(d.db_id.toString())) {
                    this.activeDeviceIds.delete(d.db_id.toString());
                    this.emitEvent('pci:alarm:off', d.db_id);
                }
            });
        }
        this.renderList(this.filterInput.value);
        this.updateVisuals();
        this.saveState();
    }

    toggleDevice(id) {
        if (this.activeDeviceIds.has(id)) {
            this.activeDeviceIds.delete(id);
            this.emitEvent('pci:alarm:off', id);
        } else {
            this.activeDeviceIds.add(id);
            this.emitEvent('pci:alarm:on', id);

            // Auto-activate simulator if it was off
            if (!this.isActive) {
                this.toggleSimulation(true);
            }

            // 🔥 Notify server to trigger Telegram (New!)
            const dev = this.currentDevices.find(d => d.db_id == id);
            if (dev) {
                window.api.notifyDevice({
                    device_id: dev.id,
                    id: dev.db_id,
                    building_id: this.buildingId,
                    floor_id: this.floorId,
                    location: dev.loc,
                    type: dev.t
                }).catch(e => console.error("Notify failed", e));
            }
        }
        this.updateVisuals();
        this.saveState();
    }

    emitEvent(eventName, deviceId) {
        const device = this.currentDevices.find(d => d.db_id == deviceId);
        if (!device) return;

        window.dispatchEvent(new CustomEvent(eventName, {
            detail: {
                elementId: device.db_id,
                type: device.t,
                location: device.loc,
                description: '---', // Not in DB yet
                origin: 'SIMULACIÓN',
                buildingId: this.buildingId,
                floorId: this.floorId
            }
        }));
    }

    updateVisuals() {
        // Sincronizar el panel del simulador
        const allItems = this.listContainer.querySelectorAll('.sim-item');
        allItems.forEach(item => {
            const id = item.dataset.id;
            const input = item.querySelector('input');
            if (input) input.checked = this.activeDeviceIds.has(id);
        });

        this.updateCount();

        // Disparar actualización visual del mapa de forma segura
        if (window.updateMapVisuals && !window.preventSimSync) {
            window.preventSimSync = true;
            window.updateMapVisuals();
            window.preventSimSync = false;
        }
    }

    renderList(filterText = '') {
        this.listContainer.innerHTML = '';
        const filterLower = filterText.toLowerCase();

        this.currentDevices.forEach(d => {
            // Filter logic
            if (filterText) {
                const match = d.n.toLowerCase().includes(filterLower) ||
                    (d.id && d.id.toLowerCase().includes(filterLower));
                if (!match) return;
            }

            const item = document.createElement('div');
            // Tailwind classes: flex row, padding, border, hover effect
            item.className = 'flex items-center justify-between p-3 border-b border-slate-800 hover:bg-slate-700/30 transition-colors group cursor-pointer';
            item.dataset.id = d.db_id;

            const isChecked = d.db_id ? this.activeDeviceIds.has(d.db_id.toString()) : false;

            // Icon color based on type
            let iconColor = '#ef4444'; // detector
            if (d.t === 'pulsador') iconColor = '#3b82f6';
            else if (d.t === 'sirena') iconColor = '#f59e0b';
            else if (d.t === 'central') iconColor = '#8b5cf6';

            // HTML structure
            item.innerHTML = `
                <div class="flex items-center gap-3 flex-1 mr-2">
                    <div class="w-2 h-2 rounded-full shrink-0" style="background-color: ${iconColor}; box-shadow: 0 0 5px ${iconColor}"></div>
                    <div class="flex flex-col min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-white text-[11px] uppercase truncate group-hover:text-blue-400 transition-colors">
                                ${d.t || 'Elemento'} #${d.n || '?'}
                            </span>
                            <span class="text-[9px] font-mono text-slate-500 shrink-0">${d.id || ''}</span>
                        </div>
                        <span class="text-[10px] text-slate-400 truncate">${d.loc || 'Sin ubicación'}</span>
                    </div>
                </div>
                <!-- Custom Tailwind Toggle -->
                <label class="relative inline-flex items-center cursor-pointer shrink-0" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} class="sr-only peer">
                    <div class="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            `;

            // Item click -> Highlight on map
            item.addEventListener('click', () => {
                if (window.highlightDevice) window.highlightDevice(d.db_id || d.id);
            });

            // Toggle change -> Simulation
            const input = item.querySelector('input');
            input.addEventListener('change', (e) => {
                this.toggleDevice(String(d.db_id || d.id));
            });

            this.listContainer.appendChild(item);
        });
        this.updateCount();
    }

    updateCount() {
        this.countLabel.textContent = `${this.activeDeviceIds.size} / ${this.currentDevices.length}`;
    }

    saveState() {
        if (!this.floorId) return;
        const key = `sim:${this.buildingId}:${this.floorId}`;
        const data = {
            isActive: this.isActive,
            activeIds: Array.from(this.activeDeviceIds)
        };
        localStorage.setItem(key, JSON.stringify(data));
    }

    loadState() {
        if (!this.floorId) return;
        const key = `sim:${this.buildingId}:${this.floorId}`;
        const raw = localStorage.getItem(key);
        if (raw) {
            try {
                const data = JSON.parse(raw);
                this.isActive = data.isActive;
                this.activeDeviceIds = new Set(data.activeIds);
                this.toggleSimulation(this.isActive); // restore UI toggle
            } catch (e) {
                console.error("Error loading sim state", e);
            }
        } else {
            // Defaults
            this.isActive = false;
            this.activeDeviceIds.clear();
            this.toggleSimulation(false);
        }
    }
}
