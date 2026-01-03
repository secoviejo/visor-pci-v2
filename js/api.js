const API_URL = '/api';

// Token Management
let authToken = localStorage.getItem('auth_token');

function getHeaders() {
    const headers = {};
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
}

export function isLoggedIn() {
    return !!authToken;
}

function handleAuthError(res) {
    if (res.status === 401 || res.status === 403) {
        console.warn('Auth error detected. Logging out...');
        logout();
        window.location.href = 'index.html';
        return true;
    }
    return false;
}

export async function login(username, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (res.ok) {
        const data = await res.json();
        authToken = data.token;
        localStorage.setItem('auth_token', authToken);
        return data;
    } else {
        throw new Error('Login failed');
    }
}

export function logout() {
    authToken = null;
    localStorage.removeItem('auth_token');
}

export async function getCampuses() {
    const res = await fetch(`${API_URL}/campuses`);
    if (!res.ok) throw new Error('Error loading campuses');
    return res.json();
}

export async function updateCampus(id, data) {
    const headers = getHeaders();
    headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_URL}/campuses/${id}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(data)
    });

    if (!res.ok) {
        if (handleAuthError(res)) return { success: false, error: 'Auth failed' };
        throw new Error('Error updating campus');
    }
    return res.json();
}

export async function getBuildings(campusId = null) {
    let url = `${API_URL}/buildings`;
    if (campusId) {
        url += `?campusId=${campusId}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error loading buildings');
    return res.json();
}

export async function createBuilding(name, campusId) {
    const headers = getHeaders();
    headers['Content-Type'] = 'application/json';
    const body = { name };
    if (campusId) body.campusId = campusId;

    const res = await fetch(`${API_URL}/buildings`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Error creating building');
    return res.json();
}

export async function updateBuilding(id, data) {
    const headers = getHeaders();
    headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_URL}/buildings/${id}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(data)
    });

    if (!res.ok) {
        if (handleAuthError(res)) return { success: false, error: 'Auth failed' };
        throw new Error('Error updating building');
    }
    return res.json();
}

export async function uploadBuildingConfig(buildingId, file) {
    const headers = getHeaders();
    if (headers['Content-Type']) delete headers['Content-Type'];

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_URL}/buildings/${buildingId}/config`, {
        method: 'POST',
        headers: headers,
        body: formData
    });

    if (!res.ok) throw new Error('Error uploading config');
    return res.json();
}

export async function getFloors(buildingId = null) {
    let url = `${API_URL}/floors`;
    if (buildingId) {
        url += `?buildingId=${buildingId}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error loading floors');
    return res.json();
}

// Helper for easier usage
export async function uploadFloor(buildingId, name, file) {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('buildingId', buildingId);
    formData.append('image', file);
    return createFloor(formData);
}

export async function deleteFloor(id) {
    const headers = getHeaders();
    const res = await fetch(`${API_URL}/floors/${id}`, {
        method: 'DELETE',
        headers: headers
    });
    if (!res.ok) {
        if (handleAuthError(res)) return { success: false, error: 'Auth failed' };
        throw new Error('Error deleting floor');
    }
    return res.json();
}

export async function createFloor(formData) {
    const headers = getHeaders();
    // Fetch automatically sets Content-Type for FormData, but we need Auth
    // Headers object for FormData requests usually shouldn't have Content-Type set manually
    // So we need to be careful.

    // Explicitly delete Content-Type to let browser set it with boundary
    if (headers['Content-Type']) delete headers['Content-Type'];

    const res = await fetch(`${API_URL}/floors`, {
        method: 'POST',
        headers: headers,
        body: formData
    });
    if (!res.ok) throw new Error('Error uploading floor');
    return res.json();
}

export async function getDevices(floorId) {
    const res = await fetch(`${API_URL}/floors/${floorId}/devices`);
    if (!res.ok) throw new Error('Error loading devices');
    return res.json();
}

export async function createDevice(device) {
    const headers = getHeaders();
    headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_URL}/devices`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(device)
    });
    if (!res.ok) throw new Error('Error creating device');
    return res.json();
}

export async function updateDevice(dbId, data) {
    const headers = getHeaders();
    headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_URL}/devices/${dbId}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        if (handleAuthError(res)) return { success: false, error: 'Auth failed' };
        const errData = await res.json().catch(() => ({}));
        console.error('Update failed:', res.status, errData);
        throw new Error('Error updating device');
    }
    return res.json();
}

export async function deleteDevice(dbId) {
    try {
        const headers = getHeaders();
        const res = await fetch(`${API_URL}/devices/${dbId}`, {
            method: 'DELETE',
            headers: headers
        });
        if (!res.ok) throw new Error('Error deleting device');
        return res.json();
    } catch (e) {
        console.error(e);
        return { success: false };
    }
}

export async function controlDevice(action) {
    // action: 'activate' | 'deactivate'
    const headers = getHeaders();
    headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_URL}/devices/control`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ action })
    });
    if (!res.ok) throw new Error('Control failed');
    return res.json();
}

export async function getEvents(filters = {}) {
    let url = `${API_URL}/events`;
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    if (filters.type) params.append('type', filters.type);
    if (filters.resolved !== undefined) params.append('resolved', filters.resolved);
    if (filters.campusId) params.append('campusId', filters.campusId);

    if (params.toString()) url += `?${params.toString()}`;

    const headers = getHeaders();
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Error loading events');
    return res.json();
}

export async function acknowledgeEvent(eventId) {
    const headers = getHeaders();
    headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_URL}/events/${eventId}/acknowledge`, {
        method: 'POST',
        headers: headers
    });
    if (!res.ok) throw new Error('Error acknowledging event');
    return res.json();
}

// ADMIN API
export async function getUsers() {
    const headers = getHeaders();
    const res = await fetch(`${API_URL}/users`, { headers });
    if (!res.ok) throw new Error('Error loading users');
    return res.json();
}

export async function createUser(username, password, role) {
    const headers = getHeaders();
    headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ username, password, role })
    });
    if (!res.ok) throw new Error('Error creating user');
    return res.json();
}

export async function deleteUser(id) {
    const headers = getHeaders();
    const res = await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE',
        headers: headers
    });
    if (!res.ok) throw new Error('Error deleting user');
    return res.json();
}

export async function getGateways() {
    const headers = getHeaders();
    const res = await fetch(`${API_URL}/gateways`, { headers });
    if (!res.ok) throw new Error('Error loading gateways');
    return res.json();
}

export async function createGateway(gateway) {
    const headers = getHeaders();
    headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_URL}/gateways`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(gateway)
    });
    if (!res.ok) throw new Error('Error creating gateway');
    return res.json();
}

// SIMULATOR CONTROL
export async function getSimulatorStatus() {
    const headers = getHeaders();
    const res = await fetch(`${API_URL}/admin/simulator/status`, { headers });
    if (!res.ok) throw new Error('Error getting simulator status');
    return res.json();
}

export async function startSimulator() {
    const headers = getHeaders();
    const res = await fetch(`${API_URL}/admin/simulator/start`, {
        method: 'POST',
        headers
    });
    if (!res.ok) throw new Error('Error starting simulator');
    return res.json();
}

export async function stopSimulator() {
    const headers = getHeaders();
    const res = await fetch(`${API_URL}/admin/simulator/stop`, {
        method: 'POST',
        headers
    });
    if (!res.ok) throw new Error('Error stopping simulator');
    return res.json();
}

export function getCurrentUser() {
    if (!authToken) return null;
    try {
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        return payload;
    } catch (e) { return null; }
}
