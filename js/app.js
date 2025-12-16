import * as api from './api.js';

// ===========================================
// VARIABLES GLOBALES
// ===========================================
const viewport = document.getElementById('viewport');
const mapContainer = document.getElementById('map-container');
const mapImg = document.getElementById('plano-img');
const emptyState = document.getElementById('empty-state');
const toast = document.getElementById('toast');
const floorSelect = document.getElementById('floor-select');

// UI Refs
const modalInfo = document.getElementById('modal-info');
const modalAdd = document.getElementById('modal-add');

// State
let currentFloorId = null;
let currentBuildingId = null;
let devices = [];
let scale = 1, pointX = 0, pointY = 0;
let isPanning = false, startX = 0, startY = 0;
let draggingEl = null;
let longPressTimer = null;
let isDragMode = false;

// ===========================================
// INICIALIZACIÓN
// ===========================================
window.addEventListener('load', async () => {
    try {
        await loadBuildings();
    } catch (error) {
        console.error("Error initializing:", error);
        showToast("❌ Error conectando con el servidor");
    }
});

async function loadBuildings() {
    const buildings = await api.getBuildings();

    // Admin Select
    const adminSel = document.getElementById('building-select');
    const publicSel = document.getElementById('building-select-public');

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

    // Select first building by default
    if (buildings.length > 0) {
        loadFloors(buildings[0].id);
    }
}

async function loadFloors(buildingId) {
    currentBuildingId = buildingId;

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
        sel.onchange = (e) => loadFloorData(e.target.value); // Reset listener
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
    currentFloorId = floorId;
    const selectedOption = floorSelect.options[floorSelect.selectedIndex];
    const imageName = selectedOption.dataset.image;

    // Load Image
    mapImg.src = imageName;
    mapImg.onload = () => {
        emptyState.style.display = 'none';
        resetView();
    };

    // Load Devices
    devices = await api.getDevices(floorId);
    renderDevices();
}

function renderDevices() {
    document.querySelectorAll('.hotspot').forEach(el => el.remove());

    devices.forEach(d => {
        const dot = document.createElement('div');
        let typeClass = 'type-detector';
        if (d.t === 'pulsador') typeClass = 'type-pulsador';
        if (d.t === 'sirena') typeClass = 'type-sirena';
        if (d.t === 'detector_ft') typeClass = 'type-detector_ft';

        dot.className = `hotspot ${typeClass}`;
        dot.style.left = d.x + '%';
        dot.style.top = d.y + '%';
        dot.textContent = d.n;
        dot.setAttribute('data-tooltip', d.loc);
        dot.dataset.dbId = d.db_id;

        dot.addEventListener('mousedown', (e) => handleHotspotMouseDown(e, dot, d));
        dot.addEventListener('dragstart', (e) => e.preventDefault());

        mapContainer.appendChild(dot);
    });

    // Re-apply filters just in case state was saved but we re-rendered
    applyFilters();
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
    e.preventDefault();

    longPressTimer = setTimeout(() => {
        startDragging(dot, e);
    }, 500);

    const onMouseUp = () => {
        clearTimeout(longPressTimer);
        document.removeEventListener('mouseup', onMouseUp);
        if (!isDragMode) openInfoModal(data);
        else stopDragging(dot);
    };
    document.addEventListener('mouseup', onMouseUp);
}

function startDragging(dot, e) {
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

    try {
        await api.updateDevice(dbId, { x: newX, y: newY });
        showToast("✅ Posición actualizada");
    } catch (e) {
        showToast("❌ Error guardando posición");
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
    scale = 1; pointX = 0; pointY = 0; setTransform();
};

// ===========================================
// FILTER LOGIC
// ===========================================
const visibleTypes = {
    detector: true,
    pulsador: true,
    sirena: true
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

        dot.style.display = isVisible ? 'flex' : 'none';
    });
}


// ===========================================
// MODALS & UI
// ===========================================
let currentEditingId = null;

function openInfoModal(d) {
    currentEditingId = d.db_id;
    document.getElementById('edit-num').value = d.n;
    document.getElementById('edit-type').value = d.t;
    document.getElementById('edit-loc').value = d.loc;
    document.getElementById('edit-id').value = d.id;

    // Setup delete button
    document.getElementById('btn-delete-device').onclick = () => handleDelete(d.db_id);
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
        await api.createDevice(newDevice);
        showToast("✨ Dispositivo añadido");
        closeModal('modal-add');
        loadFloorData(currentFloorId);
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
        // Admin Mode
        adminControls.style.display = 'flex';

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
    window.location.reload();
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
