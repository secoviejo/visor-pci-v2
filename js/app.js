import * as api from './api.js';
import { Simulator } from './simulator.js';
import { AlertSystem } from './alerts.js';

// ===========================================
// VARIABLES GLOBALES
// ===========================================
const viewport = document.getElementById('viewport');
const mapContainer = document.getElementById('map-container');
const mapImg = document.getElementById('plano-img');
const emptyState = document.getElementById('empty-state');
const toast = document.getElementById('toast');
const floorSelect = document.getElementById('floor-select');

// Simulator & Alerts instances
const simulator = new Simulator();
window.simulator = simulator;

const alertSystem = new AlertSystem();
window.alerts = alertSystem; // Public access

// UI Refs
const modalInfo = document.getElementById('modal-info');
const modalAdd = document.getElementById('modal-add');

// State
window.currentFloorId = null;
window.currentBuildingId = null;
let currentFloorId = null; // Local copy for internal logic if needed, but better to use window.
let currentBuildingId = null;
let devices = [];
window.currentDevices = []; // Referencia global para el explorador
let scale = 1, pointX = 0, pointY = 0;
let isPanning = false, startX = 0, startY = 0;
let draggingEl = null;
let longPressTimer = null;
let isDragMode = false;
let mouseStartX = 0, mouseStartY = 0;
let hasMoved = false;

// ===========================================
// INICIALIZACIÓN
// ===========================================
window.addEventListener('load', async () => {
    // Initialize Alerts Panel (Do this first to catch startup events)
    const alertPanel = document.getElementById('alerts-panel');
    if (alertPanel) {
        alertSystem.init(alertPanel);
    }

    // Listen for Alerts
    window.addEventListener('pci:alarm:on', (e) => {
        alertSystem.raiseAlert(e.detail);
        updateMapVisuals();
    });

    window.addEventListener('pci:alarm:off', (e) => {
        alertSystem.resolveAlert(e.detail.elementId, e.detail.type);
        updateMapVisuals();
    });

    window.addEventListener('pci:alert:click', (e) => {
        const { elementId, floorId, buildingId } = e.detail;

        // If different floor/building, load it first
        if (currentFloorId != floorId) {
            // Future logic to switch floors would go here
            return;
        }

        const target = document.querySelector(`.hotspot[data-db-id="${elementId}"]`);
        if (target) {
            target.style.transition = 'transform 0.5s';
            target.style.transform = 'translate(-50%, -50%) scale(2.5)';
            setTimeout(() => target.style.transform = '', 1000);
        }
    });

    try {
        await loadBuildings();
    } catch (error) {
        console.error("Error initializing:", error);
        showToast("❌ Error conectando con el servidor");
    }
});

async function loadBuildings() {
    const urlParams = new URLSearchParams(window.location.search);
    const campusId = urlParams.get('campusId');

    // If we have a campusId, filter buildings. If not, maybe we should redirect to dashboard?
    // For now, if no campusId, we show ALL (legacy behavior) or redirect.
    // Let's support ALL for backward compatibility but log it.

    const buildings = await api.getBuildings(campusId);

    // Admin Select
    const adminSel = document.getElementById('building-select');
    const publicSel = document.getElementById('building-select-public');

    // Breadcrumb Campus Logic
    const bcCampus = document.getElementById('bc-campus');
    if (campusId) {
        try {
            const campuses = await api.getCampuses(); // Valid await here (loadBuildings is async)
            const campus = campuses.find(c => c.id == campusId);
            if (campus) {
                bcCampus.textContent = campus.name;
                bcCampus.href = `campus_view.html?campusId=${campusId}`;
            } else {
                bcCampus.textContent = "Campus Desconocido";
            }
        } catch (e) { console.error("Error loading campus info", e); }
    } else {
        bcCampus.textContent = "Todos los Campus";
        bcCampus.href = "dashboard.html";
    }

    // Helper to populate
    const populate = (sel) => {
        sel.innerHTML = '';
        if (buildings.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = "Sin edificios";
            sel.appendChild(opt);
            return;
        }

        buildings.forEach(b => {
            const option = document.createElement('option');
            option.value = b.id;
            option.textContent = b.name;
            sel.appendChild(option);
        });

        sel.addEventListener('change', (e) => loadFloors(e.target.value));
    };

    populate(adminSel);
    populate(publicSel);

    checkAuth();

    // Check for buildingId in URL to pre-select
    const buildingIdParam = urlParams.get('buildingId');
    let initialBuildingId = null;

    if (buildingIdParam) {
        // Verify it exists in the filtered list
        const exists = buildings.find(b => b.id == buildingIdParam);
        if (exists) initialBuildingId = buildingIdParam;
    }

    if (!initialBuildingId && buildings.length > 0) {
        initialBuildingId = buildings[0].id;
    }

    if (initialBuildingId) {
        loadFloors(initialBuildingId);
    }
}

async function loadFloors(buildingId) {
    currentBuildingId = buildingId;
    window.currentBuildingId = buildingId; // Expose globally for debugging

    // Update Building Breadcrumb
    const sel = document.getElementById('building-select');
    // Find name from select (simplest way since we populated it)
    const option = [...sel.options].find(o => o.value == buildingId);
    if (option) {
        document.getElementById('bc-building').textContent = option.textContent;
    }

    // Sync selects (if user changed one, change the other visually so state is consistent)
    document.getElementById('building-select').value = buildingId;
    document.getElementById('building-select-public').value = buildingId;

    const floors = await api.getFloors(buildingId);

    const selectAdmin = document.getElementById('floor-select');
    const selectPublic = document.getElementById('floor-select-public');

    // Helper to populate
    const populate = (sel) => {
        if (!sel) return;
        sel.innerHTML = '';
        if (floors.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = "Sin plantas";
            sel.appendChild(opt);
            return;
        }
        floors.forEach(f => {
            const option = document.createElement('option');
            option.value = f.id;
            option.textContent = f.name;
            option.dataset.image = f.image_filename;
            sel.appendChild(option);
        });
        sel.onchange = (e) => {
            const val = e.target.value;
            // Sync other select
            if (sel.id === 'floor-select' && selectPublic) selectPublic.value = val;
            if (sel.id === 'floor-select-public' && selectAdmin) selectAdmin.value = val;
            loadFloorData(val);
        };
    };

    populate(selectAdmin);
    populate(selectPublic);

    if (floors.length > 0) {
        loadFloorData(floors[0].id);
    } else {
        // Clear view
        mapImg.src = '';
        emptyState.style.display = 'flex';
        renderDevices([]); // clear dots
    }
}

async function loadFloorData(floorId) {
    if (!floorId) return;
    currentFloorId = floorId;

    // Get the image from whichever select is available and has the right value
    const selectAdmin = document.getElementById('floor-select');
    const selectPublic = document.getElementById('floor-select-public');

    // Sync values
    if (selectAdmin) selectAdmin.value = floorId;
    if (selectPublic) selectPublic.value = floorId;

    const sel = (selectAdmin && selectAdmin.options.length > 0 && selectAdmin.value == floorId) ? selectAdmin : selectPublic;
    if (!sel || !sel.options[sel.selectedIndex]) {
        console.warn("No selection found for floorId:", floorId);
        return;
    }
    const selectedOption = sel.options[sel.selectedIndex];
    const imageName = selectedOption.dataset.image;

    // Load Image - handle both old format (filename only) and new format (img/filename)
    const imagePath = imageName.startsWith('img/') ? `/${imageName}` : `/img/${imageName}`;
    mapImg.src = imagePath;

    mapImg.onload = () => {
        emptyState.style.display = 'none';
        resetView();
    };

    // Load Devices
    devices = await api.getDevices(floorId);

    // Update Simulator Context
    simulator.loadContext(currentBuildingId, currentFloorId, devices);

    renderDevices();
}

function renderDevices() {
    console.log(`[App] Rendering ${devices.length} devices for floor ${currentFloorId}`);
    document.querySelectorAll('.hotspot').forEach(el => el.remove());

    devices.forEach(d => {
        // ... (rest same, logging central)
        if (d.t === 'central') console.log('[App] Rendering central device:', d);
        const dot = document.createElement('div');
        let typeClass = 'type-detector';
        if (d.t === 'pulsador') typeClass = 'type-pulsador';
        if (d.t === 'sirena') typeClass = 'type-sirena';
        if (d.t === 'detector_ft') typeClass = 'type-detector_ft';
        if (d.t === 'central') typeClass = 'type-central';

        dot.className = `hotspot ${typeClass}`;
        dot.style.left = d.x + '%';
        dot.style.top = d.y + '%';
        dot.textContent = d.n;
        dot.setAttribute('data-tooltip', d.loc);
        dot.dataset.dbId = d.db_id;
        dot.dataset.deviceId = d.id; // Store string ID for matching
        dot.classList.add('device-marker'); // Class for querySelector
        dot.setAttribute('data-dbid', d.db_id); // Attribute for selector

        if (window.lastCreatedDeviceId == d.db_id) {
            dot.classList.add('new-device');
        }

        dot.addEventListener('mousedown', (e) => handleHotspotMouseDown(e, dot, d));
        dot.addEventListener('dragstart', (e) => e.preventDefault());

        mapContainer.appendChild(dot);
    });

    // Re-apply filters just in case state was saved but we re-rendered
    applyFilters();

    // Re-apply visuals (Sim + Real)
    updateMapVisuals();

    // Update global reference for explorer
    window.currentDevices = devices;
    // Update Sidebar
    if (window.renderSidebarDevices) window.renderSidebarDevices(document.getElementById('sim-filter-input')?.value || '');
}

// Global Visual Update Function
window.updateMapVisuals = function () {
    const activeAlerts = window.alerts ? window.alerts.alerts.filter(a => a.status === 'ACTIVA') : [];

    // Simulator Active Set
    const simActiveIds = window.simulator ? window.simulator.activeDeviceIds : new Set();
    const isSimActive = window.simulator ? window.simulator.isActive : false;

    // Check if there are ANY active alarms for the CURRENT building (Real or Simulated)
    const hasAnyBuildingAlarm = activeAlerts.some(a => {
        const alertBuildingId = a.buildingId || a.building_id;
        const matchesBuilding = String(alertBuildingId) === String(window.currentBuildingId) ||
            a.building_name === document.getElementById('bc-building')?.textContent;

        // Match all alarm types: ALARM, detector, pulsador, sirena
        const isCritical = ['ALARM', 'detector', 'pulsador', 'sirena'].includes(a.type);

        return matchesBuilding && a.status === 'ACTIVA' && isCritical;
    });

    document.querySelectorAll('.hotspot').forEach(dot => {
        let isBlinking = false;
        const dbId = String(dot.dataset.dbId);
        const devId = dot.dataset.deviceId;
        const isCentral = dot.classList.contains('type-central');

        // 1. Check Simulator (Direct Device hit) - if simulation is globally ON
        if (isSimActive && simActiveIds.has(dbId)) {
            isBlinking = true;
        }

        // 2. Check Alerts (Real or Simulated) - if device is in active alerts list
        if (!isBlinking) {
            const hasAlert = activeAlerts.some(alert =>
                (alert.elementId == dbId || alert.elementId == devId) &&
                ['ALARM', 'detector', 'pulsador', 'sirena'].includes(alert.type)
            );
            if (hasAlert) isBlinking = true;
        }

        // 3. Central Logic: If I am a Central, and there is ANY active alarm in this building, I blink.
        if (isCentral && hasAnyBuildingAlarm) {
            isBlinking = true;
        }

        if (isBlinking) {
            dot.classList.add('blinking');
        } else {
            dot.classList.remove('blinking');
        }
    });

    // Synchronize simulator checkboxes without triggering a loop
    if (window.simulator && !window.preventSimSync) {
        window.preventSimSync = true;
        window.simulator.updateVisuals();
        window.preventSimSync = false;
    }
}

// ===========================================
// LÓGICA DRAG & DROP
// ===========================================
function handleHotspotMouseDown(e, dot, data) {
    // Permission Check
    if (!api.isLoggedIn()) {
        openInfoModal(data);
        return;
    }

    e.stopPropagation();
    // No preventDefault here to allow potential click events if needed, 
    // but handled manually anyway.

    mouseStartX = e.clientX;
    mouseStartY = e.clientY;
    hasMoved = false;

    // Start timer for visual drag activation
    longPressTimer = setTimeout(() => {
        if (!hasMoved) startDragging(dot);
    }, 400);

    const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - mouseStartX;
        const dy = moveEvent.clientY - mouseStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 5 && !isDragMode) {
            hasMoved = true;
            clearTimeout(longPressTimer);
            startDragging(dot);
        }
    };

    const onMouseUp = () => {
        clearTimeout(longPressTimer);
        window.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (!isDragMode) {
            // It was a simple click or short press without much movement
            openInfoModal(data);
        } else {
            // It was a drag, save the new position
            stopDragging(dot);
        }
    };

    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function startDragging(dot) {
    isDragMode = true;
    draggingEl = dot;
    dot.classList.add('dragging');
    viewport.classList.add('dragging-mode');
    mapContainer.classList.add('no-transition');
}

async function stopDragging(dot) {
    isDragMode = false;
    draggingEl = null;
    dot.classList.remove('dragging');
    viewport.classList.remove('dragging-mode');
    mapContainer.classList.remove('no-transition');

    // Save Position
    const dbId = dot.dataset.dbId;
    const newX = parseFloat(dot.style.left).toFixed(2);
    const newY = parseFloat(dot.style.top).toFixed(2);

    // Update local state
    const device = devices.find(d => d.db_id == dbId);
    if (device) {
        device.x = parseFloat(newX);
        device.y = parseFloat(newY);
    }

    console.log(`Attempting to save position for device ${dbId}: x=${newX}, y=${newY}`);

    try {
        if (!dbId) throw new Error("ID de dispositivo no encontrado");
        await api.updateDevice(dbId, { x: newX, y: newY });
        showToast("✅ Posición actualizada");
    } catch (err) {
        console.error("Error updating position:", err);
        showToast(`❌ Error guardando posición: ${err.message || ''}`);
    }
}

window.addEventListener('mousemove', (e) => {
    if (isDragMode && draggingEl) {
        e.preventDefault();
        const rect = mapContainer.getBoundingClientRect();
        const scaleX = rect.width / mapContainer.offsetWidth;
        const scaleY = rect.height / mapContainer.offsetHeight;

        const offsetX = (e.clientX - rect.left) / scaleX;
        const offsetY = (e.clientY - rect.top) / scaleY;

        const percentX = (offsetX / mapContainer.offsetWidth) * 100;
        const percentY = (offsetY / mapContainer.offsetHeight) * 100;

        draggingEl.style.left = percentX + '%';
        draggingEl.style.top = percentY + '%';
        return;
    }

    if (isPanning && !isDragMode) {
        e.preventDefault();
        pointX = e.clientX - startX;
        pointY = e.clientY - startY;
        setTransform();
    }
});

// ===========================================
// VIEWPORT LOGIC
// ===========================================
viewport.addEventListener('mousedown', (e) => {
    if (!mapImg.src || isDragMode) return;
    isPanning = true;
    startX = e.clientX - pointX;
    startY = e.clientY - pointY;
    viewport.style.cursor = 'grabbing';
});

window.addEventListener('mouseup', () => {
    isPanning = false;
    if (!isDragMode) viewport.style.cursor = 'grab';
});

viewport.addEventListener('wheel', (e) => {
    if (!mapImg.src) return;
    e.preventDefault();
    const xs = (e.clientX - pointX) / scale;
    const ys = (e.clientY - pointY) / scale;
    const delta = -e.deltaY;
    (delta > 0) ? (scale *= 1.1) : (scale /= 1.1);
    if (scale < 0.5) scale = 0.5; if (scale > 6) scale = 6;
    pointX = e.clientX - xs * scale; pointY = e.clientY - ys * scale;
    setTransform();
});

function setTransform() {
    mapContainer.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
}

// Exposed to window for HTML onclick handlers
window.resetView = function () {
    const img = document.getElementById('plano-img');
    const container = document.getElementById('viewport');

    if (!img || !img.naturalWidth) {
        // Fallback
        scale = 1; pointX = 0; pointY = 0; setTransform();
        return;
    }

    const vw = container.clientWidth;
    const vh = container.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    // Calculate fit scale (90% of viewport)
    const scaleX = vw / iw;
    const scaleY = vh / ih;
    const fitScale = Math.min(scaleX, scaleY) * 0.90;

    // Apply logic: zoom to fit even if it means zooming in
    scale = fitScale;

    // Reset panning to center (viewport flex centers content)
    pointX = 0;
    pointY = 0;

    setTransform();
};

// ===========================================
// FILTER LOGIC
// ===========================================
const visibleTypes = {
    detector: true,
    pulsador: true,
    sirena: true,
    central: true
};

window.toggleFilter = function (type) {
    visibleTypes[type] = !visibleTypes[type];

    // Update Button UI
    const btn = document.getElementById(`filter-${type}`);
    if (visibleTypes[type]) {
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-outline');
        btn.style.opacity = '1';
    } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
        btn.style.opacity = '0.7';
    }

    applyFilters();
}

function applyFilters() {
    const allDots = document.querySelectorAll('.hotspot');
    allDots.forEach(dot => {
        let isVisible = false;
        // Detectors filter covers both normal and fake ceiling detectors
        if ((dot.classList.contains('type-detector') || dot.classList.contains('type-detector_ft')) && visibleTypes.detector) isVisible = true;
        if (dot.classList.contains('type-pulsador') && visibleTypes.pulsador) isVisible = true;
        if (dot.classList.contains('type-sirena') && visibleTypes.sirena) isVisible = true;
        if (dot.classList.contains('type-central') && visibleTypes.central) isVisible = true;

        dot.style.display = isVisible ? 'flex' : 'none';
    });
}


// ===========================================
// MODALS & UI
// ===========================================
let currentEditingId = null;

function openInfoModal(device) { // Changed parameter name from 'd' to 'device' for clarity
    currentEditingId = device.db_id; // Populate Modal
    document.getElementById('edit-id').value = device.id || '';
    document.getElementById('edit-num').value = device.n || '';
    document.getElementById('edit-type').value = device.t;
    document.getElementById('edit-loc').value = device.loc || ''; // Add location

    // Role Check for Edit Buttons
    const user = api.getCurrentUser();
    const isAdmin = user && user.role === 'admin';
    const btnSave = document.querySelector('#modal-info button[onclick="saveDeviceEdits()"]');
    const btnDelete = document.getElementById('btn-delete-device');

    // Hide the whole button group row if not admin, or just buttons
    // Assuming btnSave's parent is the container for edit/delete buttons
    if (btnSave && btnSave.parentElement) {
        btnSave.parentElement.style.display = isAdmin ? 'flex' : 'none';
    }
    // Individual buttons are also hidden in case the parent structure is different
    if (btnSave) btnSave.style.display = isAdmin ? 'inline-block' : 'none';
    if (btnDelete) btnDelete.style.display = isAdmin ? 'inline-block' : 'none';

    // Setup delete button (only if admin)
    if (isAdmin && btnDelete) {
        btnDelete.onclick = () => handleDelete(device.db_id);
    }

    // Siren Control Button (Keep logic but respect role?)
    // Operators might need to activate sirens manually? Let's say yes for now, or restriction? 
    // Usually operators can control. Admins can configure.
    // Let's leave Siren Control visible if it was visible.
    const btnSiren = document.getElementById('btn-activate-siren');
    if (btnSiren) {
        if (device.t === 'sirena') {
            btnSiren.style.display = 'block';
            btnSiren.onclick = async () => {
                try {
                    // Toggle state logic could be fancier, but for now just Activate
                    if (confirm('¿Activar sirena física (DO0)?')) {
                        await api.controlDevice('activate');
                        showToast("🔔 Sirena ACTIVADA");
                    }
                } catch (e) {
                    showToast("❌ Error activando sirena");
                }
            };
        } else {
            btnSiren.style.display = 'none';
        }
    }

    modalInfo.style.display = 'flex';
}

window.saveDeviceEdits = async function () {
    if (!currentEditingId) return;

    const n = document.getElementById('edit-num').value;
    const t = document.getElementById('edit-type').value;
    const loc = document.getElementById('edit-loc').value;
    const id = document.getElementById('edit-id').value;

    try {
        await api.updateDevice(currentEditingId, { n, t, loc, id });
        showToast("💾 Cambios guardados");
        closeModal('modal-info');
        loadFloorData(currentFloorId); // Reload to reflect changes
    } catch (error) {
        console.error(error);
        showToast("❌ Error guardando cambios");
    }
}

async function handleDelete(dbId) {
    if (!confirm('¿Estás seguro de borrar este elemento?')) return;

    await api.deleteDevice(dbId);
    showToast("🗑️ Elemento eliminado");
    closeModal('modal-info');
    loadFloorData(currentFloorId); // Reload
}

window.openAddModal = function () {
    document.getElementById('add-form').reset();
    modalAdd.style.display = 'flex';
}

window.saveNewDevice = async function (e) {
    e.preventDefault();
    const type = document.getElementById('add-type').value;
    const number = document.getElementById('add-number').value;
    const loc = document.getElementById('add-loc').value;

    const newDevice = {
        floorId: currentFloorId,
        t: type,
        n: number,
        loc: loc,
        x: 50, // Default center
        y: 50
    };

    try {
        const res = await api.createDevice(newDevice);
        window.lastCreatedDeviceId = res.db_id; // Store to highlight
        showToast("✨ Dispositivo añadido");
        closeModal('modal-add');
        await loadFloorData(currentFloorId);

        // Remove highlight after 10 seconds
        setTimeout(() => {
            window.lastCreatedDeviceId = null;
            renderDevices();
        }, 10000);
    } catch (error) {
        showToast("❌ Error añadiendo");
    }
}

// ===========================================
// FLOOR MANAGEMENT
// ===========================================
window.openAddFloorModal = function () {
    document.getElementById('add-floor-form').reset();
    document.getElementById('modal-add-floor').style.display = 'flex';
}

window.openAddBuildingModal = function () {
    document.getElementById('modal-add-building').style.display = 'flex';
}

window.saveNewBuilding = async function (e) {
    e.preventDefault();
    const name = document.getElementById('add-building-name').value;
    try {
        const res = await api.createBuilding(name);
        showToast("✅ Edificio creado");
        closeModal('modal-add-building');
        await loadBuildings(); // Refresh everything
        // Switch to new building
        loadFloors(res.id);
    } catch (e) {
        showToast("❌ Error creando edificio");
    }
}

window.saveNewFloor = async function (e) {
    e.preventDefault();
    const name = document.getElementById('add-floor-name').value;
    const fileInput = document.getElementById('add-floor-file');

    if (fileInput.files.length === 0) return;

    if (!currentBuildingId) {
        showToast("⚠️ Selecciona un edificio primero");
        return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('image', fileInput.files[0]);
    formData.append('buildingId', currentBuildingId); // Important!

    try {
        const res = await api.createFloor(formData);
        showToast("✅ Planta creada exitosamente");
        closeModal('modal-add-floor');

        // Refresh and switch to new floor
        await loadFloors(currentBuildingId);
        // Force select new floor
        document.getElementById('floor-select').value = res.id;
        loadFloorData(res.id);
    } catch (error) {
        console.error(error);
        showToast("❌ Error subiendo planta");
    }
}

// ===========================================
// AUTH MANAGEMENT
// ===========================================
function checkAuth() {
    const isLogged = api.isLoggedIn();
    const adminControls = document.getElementById('admin-controls');

    // Public controls
    const publicBuildingSelect = document.getElementById('building-select-public');
    const publicFloorSelect = document.getElementById('floor-select-public');
    const commonControlsContainer = publicFloorSelect.parentElement;

    const loginBtn = document.getElementById('btn-login');
    const logoutBtn = document.getElementById('btn-logout');

    if (isLogged) {
        // Logged In Mode
        adminControls.style.display = 'flex';

        // Role Based UI
        const user = api.getCurrentUser();
        const isAdmin = user && user.role === 'admin';

        // Admin-only buttons in Header
        const btnAddBuilding = document.querySelector('button[title="Nuevo Edificio"]');
        const btnAddFloor = document.querySelector('button[title="Nueva Planta"]');
        const btnAddElement = document.querySelector('button[onclick="openAddModal()"]');

        if (btnAddBuilding) btnAddBuilding.style.display = isAdmin ? 'inline-block' : 'none';
        if (btnAddFloor) btnAddFloor.style.display = isAdmin ? 'inline-block' : 'none';
        if (btnAddElement) btnAddElement.style.display = isAdmin ? 'inline-block' : 'none';

        // Hide public selects (duplicates), but KEEP container visible for Filters & Center button
        publicBuildingSelect.style.display = 'none';
        publicFloorSelect.style.display = 'none';
        commonControlsContainer.style.display = 'flex';

        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
    } else {
        // Public Mode
        adminControls.style.display = 'none';

        // Show public selects
        publicBuildingSelect.style.display = 'block';
        publicFloorSelect.style.display = 'block';
        commonControlsContainer.style.display = 'flex';

        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
    }
}

// Fix for my previous HTML mess: I introduced two floor selects.
// I need to make sure both work or sync them.
// To keep it clean: I will populate BOTH selects when loading floors.

window.openLoginModal = function () {
    document.getElementById('modal-login').style.display = 'flex';
}

window.handleLogin = async function (e) {
    e.preventDefault();
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;

    try {
        await api.login(u, p);
        showToast("🔓 Sesión iniciada");
        closeModal('modal-login');
        checkAuth();
        // Reload to ensure state is clean
        window.location.reload();
    } catch (e) {
        showToast("❌ Usuario o contraseña incorrectos");
    }
}

window.performLogout = function () {
    api.logout();
    checkAuth();
    window.location.href = 'index.html';
}

window.closeModal = function (id) {
    document.getElementById(id).style.display = 'none';
}

window.onclick = function (event) {
    if (event.target == modalInfo) modalInfo.style.display = "none";
    if (event.target == modalAdd) modalAdd.style.display = "none";
    if (event.target == document.getElementById('modal-add-floor')) document.getElementById('modal-add-floor').style.display = "none";
    if (event.target == document.getElementById('modal-add-building')) document.getElementById('modal-add-building').style.display = "none";
    if (event.target == document.getElementById('modal-login')) document.getElementById('modal-login').style.display = "none";
}

function showToast(msg) {
    toast.textContent = msg;
    toast.style.opacity = 1;
    setTimeout(() => toast.style.opacity = 0, 2000);
}

// Explorer / Sidebar List Logic
window.renderSidebarDevices = function (filterText = '') {
    const listContainer = document.getElementById('sim-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const devices = window.currentDevices || [];

    // Sort logic (maybe by type or number?)
    const filtered = devices.filter(d => {
        if (!filterText) return true;
        const txt = filterText.toLowerCase();
        return (d.device_id && d.device_id.toLowerCase().includes(txt)) ||
            (d.location && d.location.toLowerCase().includes(txt)) ||
            (d.type && d.type.toLowerCase().includes(txt)) ||
            (d.number && d.number.toString().includes(txt));
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div style="padding:10px; color:#999; text-align:center;">No se encontraron elementos</div>';
        return;
    }

    filtered.forEach(d => {
        const item = document.createElement('div');
        // Re-using simulator styling for now
        item.className = 'sim-item';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '8px';
        item.style.borderBottom = '1px solid #eee';
        item.style.cursor = 'pointer';

        // Icon
        let iconHtml = '';
        if (d.type === 'detector' || d.type === 'detector_ft') iconHtml = '<div class="legend-dot circle" style="background:var(--detector-color); width:10px; height:10px;"></div>';
        else if (d.type === 'pulsador') iconHtml = '<div class="legend-dot square" style="background:var(--pulsador-color); width:10px; height:10px;"></div>';
        else if (d.type === 'sirena') iconHtml = '<div class="legend-dot circle" style="background:var(--sirena-color); width:10px; height:10px; border:1px solid #333"></div>';
        else if (d.type === 'central') iconHtml = '<div class="legend-dot square" style="background:var(--central-color); width:10px; height:10px;"></div>';

        item.innerHTML = `
            <div style="flex:1; display:flex; align-items:center; gap:8px;">
                ${iconHtml}
                <div>
                    <div style="font-weight:bold; font-size:0.9em;">${(d.t || 'Elemento').toUpperCase()} #${d.n || '?'}</div>
                    <div style="font-size:0.8em; color:#666;">${d.loc || 'Sin ubicación'}</div>
                </div>
            </div>
            <div style="font-family:monospace; font-size:0.8em; color:#999;">${d.device_id || d.id || ''}</div>
        `;

        item.onclick = function () {
            highlightDevice(d.id);
        };

        listContainer.appendChild(item);
    });

    // Update count
    const countSpan = document.getElementById('sim-active-count'); // reusing ID
    if (countSpan) countSpan.textContent = `${filtered.length} / ${devices.length}`;
}

window.highlightDevice = function (dbId) {
    // 1. Find device
    const device = window.currentDevices.find(d => d.id === dbId);
    if (!device) return;

    // Trigger highlight visual
    const marker = document.querySelector(`.device-marker[data-dbid="${dbId}"]`);
    if (marker) {
        // Remove existing highlights
        document.querySelectorAll('.device-highlight').forEach(el => el.classList.remove('device-highlight'));
        marker.classList.add('device-highlight');

        // Add temporary ping animation class
        marker.classList.add('ping-animation');
        setTimeout(() => marker.classList.remove('ping-animation'), 2000);
    }
}

// Hook up search input
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('sim-filter-input');
    if (searchInput) {
        searchInput.placeholder = "Buscar (Tipo, ID, Ubicación)...";
        searchInput.addEventListener('input', (e) => {
            renderSidebarDevices(e.target.value);
        });
    }

    // Initial fetch of events
    if (api.isLoggedIn()) {
        loadEvents();
    }
});

// ===========================================
// EVENTS SYSTEM LOGIC
// ===========================================
window.toggleEventsPanel = function () {
    const p = document.getElementById('events-panel');
    if (p.style.display === 'none' || !p.style.display) {
        p.style.display = 'flex';
        loadEvents();
    } else {
        p.style.display = 'none';
    }
}

window.loadEvents = async function () {
    const container = document.getElementById('events-list');
    if (!container) return;

    try {
        const events = await api.getEvents({ limit: 50 });
        renderEventsList(events);
    } catch (e) {
        console.error("Error loading events", e);
        container.innerHTML = '<div style="color:red; text-align:center;">Error cargando eventos</div>';
    }
}

window.renderEventsList = function (events) {
    const container = document.getElementById('events-list');
    container.innerHTML = '';

    if (events.length === 0) {
        container.innerHTML = '<div style="color:#999; text-align:center;">Sin eventos recientes</div>';
        return;
    }

    events.forEach(ev => {
        const div = document.createElement('div');
        div.style.padding = '8px';
        div.style.borderBottom = '1px solid #eee';
        div.style.fontSize = '0.85rem';

        // Color coding
        let borderLeft = '4px solid #ccc'; // INFO
        if (ev.type === 'ALARM') borderLeft = '4px solid #dc3545';
        else if (ev.type === 'FAULT') borderLeft = '4px solid #ffc107';

        div.style.borderLeft = borderLeft;
        div.style.marginBottom = '5px';
        div.style.background = ev.acknowledged ? '#fff' : '#fff3cd'; // Highlight unacked

        const time = new Date(ev.timestamp).toLocaleTimeString();

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-weight:bold; color:#333;">${ev.type}</span>
                <span style="color:#666;">${time}</span>
            </div>
            <div style="margin-bottom:4px;">${ev.message} <span style="font-family:monospace;">${ev.device_id || ''}</span></div>
            ${!ev.acknowledged && ev.type !== 'INFO' ?
                `<button onclick="ackEvent(${ev.id})" style="width:100%; border:1px solid #ccc; background:#f9f9f9; padding:2px; cursor:pointer;">Reconocer</button>` :
                `<div style="font-size:0.75em; color:#999; text-align:right;">${ev.acknowledged ? 'Reconocido' : ''}</div>`
            }
        `;
        container.appendChild(div);
    });
}

window.ackEvent = async function (id) {
    try {
        await api.acknowledgeEvent(id);
        // Optimistic update
        const btn = document.activeElement;
        if (btn) btn.disabled = true;
        showToast("Evento reconocido");
        loadEvents(); // Reload to be sure
    } catch (e) {
        showToast("Error al reconocer");
    }
}

// Socket Listeners for Events
// We need to access the io() socket. It's in window.socket (exposed by realtime.js ideally, or we grab it)
// Checking realtime.js ... assuming it exposes 'socket' globally or we need to import it.
// Actually standard socket.io client adds 'socket' if established.
// Let's hook into the global socket if available.
setTimeout(() => {
    if (window.socket) {
        window.socket.on('event:new', (ev) => {
            showToast(`⚠️ Nuevo Evento: ${ev.type}`);
            if (document.getElementById('events-panel').style.display !== 'none') {
                loadEvents();
            }
        });
        window.socket.on('event:ack', () => {
            if (document.getElementById('events-panel').style.display !== 'none') {
                loadEvents();
            }
        });
    }
}, 1000);
