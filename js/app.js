// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBvAFdaZfCJO_aXWP2XvYuurXaPHaqytgY",
    authDomain: "clientes-4a2d0.firebaseapp.com",
    databaseURL: "https://clientes-4a2d0-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "clientes-4a2d0",
    storageBucket: "clientes-4a2d0.firebasestorage.app",
    messagingSenderId: "880704686667",
    appId: "1:880704686667:web:5590870d431b5a47bc5bce"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// Variables globales
let clients = [];

// Elementos del DOM
const btnAddClient = document.getElementById('btn-add-client');
const tabAll = document.getElementById('tab-all');
const tabPending = document.getElementById('tab-pending');
const tabDistance = document.getElementById('tab-distance');
const tabInhabitants = document.getElementById('tab-inhabitants');
const tabNoContact = document.getElementById('tab-no-contact');
const tabCalendar = document.getElementById('tab-calendar');
const tabVip = document.getElementById('tab-vip');
const tabBilling = document.getElementById('tab-billing');
const pendingBadge = document.getElementById('pending-badge');
const calendarView = document.getElementById('calendar-view');
const clientsBody = document.getElementById('clients-body');
const hoverPreview = document.getElementById('hover-preview');
const clientCount = document.getElementById('client-count');
const searchInput = document.getElementById('search-input');
const btnExport = document.getElementById('btn-export');
const btnImportTrigger = document.getElementById('btn-import-trigger');
const inputImport = document.getElementById('input-import');
const tableWrapper = document.getElementById('table-wrapper');
const topScrollbarContainer = document.getElementById('top-scrollbar-container');
const topScrollbarContent = document.getElementById('top-scrollbar-content');

const filterProvince = document.getElementById('filter-province');
const filterInhabitants = document.getElementById('filter-inhabitants');

// Elementos del Modal
const clientModal = document.getElementById('client-modal');
const modalDetails = document.getElementById('modal-details');
const btnModalDelete = document.getElementById('btn-modal-delete');
const btnModalSave = document.getElementById('btn-modal-save');
const closeModalX = document.querySelector('.close-modal');
const closeModalBtns = document.querySelectorAll('.close-btn');

let currentActiveClientId = null;
let openedFromTab = null;
let dailyStats = JSON.parse(localStorage.getItem('laser_daily_stats') || '{}');

// Al iniciar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar datos
    loadClients();
    updateDailyStatsUI();
    createCustomTooltip();

    // Configurar Event Listeners con seguridad
    if (btnAddClient) btnAddClient.addEventListener('click', () => openClientDetails(null));
    if (tabAll) tabAll.addEventListener('click', () => switchTab('all'));
    if (tabPending) tabPending.addEventListener('click', () => switchTab('pending'));
    if (tabDistance) tabDistance.addEventListener('click', () => switchTab('distance'));
    if (tabInhabitants) tabInhabitants.addEventListener('click', () => switchTab('inhabitants'));
    if (tabNoContact) tabNoContact.addEventListener('click', () => switchTab('no-contact'));
    if (tabCalendar) tabCalendar.addEventListener('click', () => switchTab('calendar'));
    if (tabVip) tabVip.addEventListener('click', () => switchTab('vip'));
    if (tabBilling) tabBilling.addEventListener('click', () => switchTab('billing'));

    if (document.getElementById('prev-month')) document.getElementById('prev-month').onclick = () => changeMonth(-1);
    if (document.getElementById('next-month')) document.getElementById('next-month').onclick = () => changeMonth(1);

    if (searchInput) searchInput.addEventListener('input', filterClients);
    if (btnExport) btnExport.addEventListener('click', exportData);
    if (btnImportTrigger) btnImportTrigger.addEventListener('click', () => {
        if (inputImport) inputImport.click();
    });
    if (inputImport) inputImport.addEventListener('change', importData);

    if (filterProvince) filterProvince.addEventListener('change', filterClients);
    if (filterInhabitants) filterInhabitants.addEventListener('change', filterClients);

    // Listener de Login
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.addEventListener('click', handleLogin);

    // Control de acceso con Firebase
    auth.onAuthStateChanged((user) => {
        const loginOverlay = document.getElementById('login-overlay');
        if (user) {
            console.log("Acceso concedido:", user.email);
            if (loginOverlay) loginOverlay.style.display = 'none';
            loadClients(); // Cargar datos solo tras el login
            
            // Sincronizar Estadísticas (Contadores diarios)
            db.ref('dailyStats').on('value', (snap) => {
                if (snap.val()) {
                    dailyStats = snap.val();
                    localStorage.setItem('laser_daily_stats', JSON.stringify(dailyStats));
                    updateDailyStatsUI();
                }
            });

            // Sincronizar Plantillas de Textos
            db.ref('textTemplates').on('value', (snap) => {
                if (snap.val()) {
                    emailTemplates = snap.val();
                    localStorage.setItem('laser_text_templates', JSON.stringify(emailTemplates));
                }
            });

            // Activar indicador de conexión real
            const connectedRef = db.ref(".info/connected");
            connectedRef.on("value", (snap) => {
                const dot = document.getElementById('cloud-status-dot');
                const text = document.getElementById('cloud-status-text');
                if (snap.val() === true) {
                    if (dot) { dot.classList.remove('offline'); dot.classList.add('online'); }
                    if (text) text.textContent = "Sincronizado";
                } else {
                    if (dot) { dot.classList.remove('online'); dot.classList.add('offline'); }
                    if (text) text.textContent = "Desconectado";
                }
            });
        } else {
            console.log("Esperando login...");
            if (loginOverlay) loginOverlay.style.display = 'flex';
            clients = []; // Limpiar datos si no hay sesión
            filterClients();
        }
    });

    // Restaurar Listeners del Modal
    if (closeModalX) closeModalX.onclick = closeModal;
    closeModalBtns.forEach(btn => {
        if (btn) btn.onclick = closeModal;
    });
    window.onclick = (event) => { if (event.target == clientModal) closeModal(); };
    if (btnModalDelete) btnModalDelete.onclick = deleteClientFromModal;
    if (btnModalSave) btnModalSave.onclick = saveClientChanges;

    // Estado inicial de la vista
    switchTab('pending');
});

function closeModal() {
    if (clientModal) clientModal.style.display = "none";
    // Limpiar posibles estados de edición del historial
    const saveBtn = document.getElementById('btn-save-history');
    if (saveBtn) {
        delete saveBtn.dataset.editIndex;
        saveBtn.textContent = "Guardar Registro";
    }
}

// Sincronización de scroll
if (topScrollbarContainer && tableWrapper) {
    topScrollbarContainer.onscroll = function () {
        tableWrapper.scrollLeft = topScrollbarContainer.scrollLeft;
    };
    tableWrapper.onscroll = function () {
        topScrollbarContainer.scrollLeft = tableWrapper.scrollLeft;
    };
}

// Atajos de Teclado
document.addEventListener('keydown', (e) => {
    // CTRL + F: Buscar
    if (e.ctrlKey && e.key === 'f') {
        if (searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
    }
});

/**
 * Carga los clientes desde LocalStorage
 */
/**
 * Maneja el inicio de sesión
 */
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    if (!email || !pass) {
        errorMsg.textContent = "Introduce email y contraseña.";
        errorMsg.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.textContent = "Verificando...";

    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (error) {
        console.error("Error de login:", error);
        errorMsg.textContent = "Email o contraseña incorrectos.";
        errorMsg.style.display = 'block';
        btn.disabled = false;
        btn.textContent = "Entrar al Sistema";
    }
}

function loadClients() {
    // 1. Carga rápida desde LocalStorage
    const saved = localStorage.getItem('laser_clients');
    if (saved) {
        try {
            clients = JSON.parse(saved);
            filterClients();
            updateProvinceFilter();
            updatePendingBadge();
        } catch (e) { console.error("Error cargando local", e); }
    }

    // 2. Sincronización en tiempo real con Firebase
    if (typeof db !== 'undefined') {
        db.ref('clients').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                console.log("Datos sincronizados desde Firebase");
                clients = data;
                localStorage.setItem('laser_clients', JSON.stringify(clients));
                filterClients();
                updateProvinceFilter();
                updatePendingBadge();
                updateDailyStatsUI();
            }
        });
    }
}

/**
 * Normaliza el nombre de la provincia
 */
function normalizeProvince(client) {
    if (client.province) {
        const provMap = {
            'Castellon': 'Castellón',
            'Castelló': 'Castellón',
            'Almeria': 'Almería',
            'Cadiz': 'Cádiz',
            'Cordoba': 'Córdoba',
            'Jaen': 'Jaén',
            'Malaga': 'Málaga',
            'Leon': 'León',
            'Avila': 'Ávila',
            'Caceres': 'Cáceres',
            'Gipuzkoa': 'Guipúzcoa',
            'Bizkaia': 'Vizcaya',
        };
        // Limpiar espacios y capitalizar
        let p = client.province.trim();
        if (p) {
            p = p.charAt(0).toUpperCase() + p.slice(1);
            if (provMap[p]) client.province = provMap[p];
            else client.province = p;
        }
    }
    return client;
}

/**
 * Guarda los clientes en LocalStorage
 */
function saveClients() {
    // 1. Guardar copia local
    localStorage.setItem('laser_clients', JSON.stringify(clients));

    // 2. Guardar en la nube (Firebase)
    if (typeof db !== 'undefined') {
        db.ref('clients').set(clients)
            .then(() => console.log("Nube actualizada"))
            .catch(err => console.error("Error subiendo a nube:", err));
    }
}

/**
 * Rellena el desplegable de provincias dinámicamente
 */
function updateProvinceFilter() {
    if (!filterProvince) return;

    // Guardar el valor actual para no perderlo al recargar
    const currentVal = filterProvince.value;

    // Obtener provincias únicas
    const provinces = [...new Set(clients.map(c => c.province).filter(p => p))].sort();

    filterProvince.innerHTML = '<option value="">Todas las Provincias</option>' +
        provinces.map(p => `<option value="${p}" ${p === currentVal ? 'selected' : ''}>${p}</option>`).join('');

    // Actualizar también el datalist para autocompletado en el modal
    const provinceList = document.getElementById('province-list');
    if (provinceList) {
        provinceList.innerHTML = provinces.map(p => `<option value="${p}">`).join('');
    }
}

/**
 * Renderiza la tabla en el HTML
 */
function renderTable(dataToRender) {
    const table = document.getElementById('clients-table');
    const tbody = document.getElementById('clients-body');
    const thead = document.querySelector('#clients-table thead');
    if (!tbody || !thead) return;

    tbody.innerHTML = '';
    clientCount.textContent = dataToRender.length;
    updateAuditCounter();

    const isPending = currentTab === 'pending';
    const isVip = currentTab === 'vip';
    const isSimplified = ['distance', 'inhabitants', 'no-contact'].includes(currentTab);

    // 1. Renderizar Cabecera según la pestaña
    if (isPending) {
        thead.innerHTML = `
            <tr>
                <th>Nombre</th>
                <th>Empresa/Pueblo</th>
                <th>Tel.</th>
                <th>Email</th>
                <th>Seguim.</th>
                <th>Próx. 1</th>
                <th>Próx. 2</th>
                <th>Últ. Trab.</th>
                <th>Acc.</th>
            </tr>
        `;
    } else if (currentTab === 'billing') {
        thead.innerHTML = `
            <tr>
                <th>Top</th>
                <th>Nombre</th>
                <th>Empresa/Pueblo</th>
                <th style="color: #16a34a;">Total Facturado</th>
                <th>Provincia</th>
                <th>Último Trabajo</th>
                <th>Acciones</th>
            </tr>
        `;
    } else if (isVip) {
        thead.innerHTML = `
            <tr>
                <th>VIP</th>
                <th>Nombre</th>
                <th>Empresa/Pueblo</th>
                <th>Prov.</th>
                <th>Hab.</th>
                <th>Km</th>
                <th>Tel.</th>
                <th>Acc.</th>
            </tr>
        `;
    } else if (isSimplified) {
        thead.innerHTML = `
            <tr>
                <th>Nombre</th>
                <th>Empresa/Pueblo</th>
                <th>Prov.</th>
                <th>Hab.</th>
                <th>Km</th>
                <th>Tel.</th>
                <th>Email</th>
                <th>Últ. Trab.</th>
                <th>Acc.</th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr>
                <th>Nombre</th>
                <th>Empresa/Pueblo</th>
                <th>Prov.</th>
                <th>Hab.</th>
                <th>Km</th>
                <th>Tel.</th>
                <th>Email</th>
                <th>Últ. Trab.</th>
                <th>Últ. Cont.</th>
                <th>Seguim.</th>
                <th>Próx. 1</th>
                <th>Próx. 2</th>
                <th>Acc.</th>
            </tr>
        `;
    }

    if (dataToRender.length === 0) {
        let colSpan = 13;
        if (isPending) colSpan = 9;
        else if (isSimplified) colSpan = 9;
        tbody.innerHTML = `<tr><td colspan="${colSpan}" class="empty-state">No hay clientes. Haz clic en "+ Añadir Cliente" para empezar.</td></tr>`;
        return;
    }

    // 2. Renderizar Filas
    dataToRender.forEach((c, index) => {
        const tr = document.createElement('tr');
        const empresaPueblo = [c.clientName, c.town].filter(Boolean).join(' / ');
        const alerts = renderAlertIcons(c);
        tr.className = `status-${c.status || 'no-trabajado'}`;

        if (isPending) {
            tr.innerHTML = `
                <td><strong>${escapeHTML(c.contactName || '')}</strong>${alerts}</td>
                <td>${escapeHTML(empresaPueblo)}</td>
                <td>${escapeHTML(c.phone || '')}</td>
                <td onclick="event.stopPropagation(); copyToClipboard('${escapeHTML(c.email || '')}', this)" style="cursor: copy; color: var(--primary-color); text-decoration: underline;" title="Clic para copiar email">
                    ${escapeHTML(c.email || '')}
                </td>
                <td>${formatDateWithAlert(c.proximo3)}</td>
                <td>${formatDateWithAlert(c.proximo1)}</td>
                <td>${formatDateWithAlert(c.proximo2)}</td>
                <td>${formatDateForDisplay(c.ultimoTrabajo)}</td>
                <td onclick="event.stopPropagation()">
                    <button class="btn btn-danger" onclick="deleteClient('${c.id}')">Eliminar</button>
                </td>
            `;
        } else if (isVip) {
            tr.innerHTML = `
                <td><div class="vip-score-badge" onmouseenter="showVipTooltip(event, this)" onmouseleave="hideVipTooltip()" data-reason="${c._vipReason || ''}">${Math.round(c._vipScore || 0)} pts</div></td>
                <td><strong>${escapeHTML(c.contactName || '')}</strong>${alerts}</td>
                <td>${escapeHTML(empresaPueblo)}</td>
                <td>${escapeHTML(c.province || '')}</td>
                <td>${escapeHTML(c.inhabitants || '')}</td>
                <td>${escapeHTML(c.distance || '')} km</td>
                <td>${escapeHTML(c.phone || '')}</td>
                <td onclick="event.stopPropagation()">
                    <button class="btn btn-danger" onclick="deleteClient('${c.id}')">Eliminar</button>
                </td>
            `;
        } else if (currentTab === 'billing') {
            const total = (c.history || []).reduce((acc, h) => acc + (parseFloat(h.amount) || 0), 0);
            tr.innerHTML = `
                <td style="font-weight:bold; color:#64748b;">#${index + 1}</td>
                <td><strong>${escapeHTML(c.contactName || '')}</strong>${alerts}</td>
                <td>${escapeHTML(empresaPueblo)}</td>
                <td style="font-weight:bold; color:#16a34a;">${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</td>
                <td>${escapeHTML(c.province || '')}</td>
                <td>${formatDateForDisplay(c.ultimoTrabajo)}</td>
                <td onclick="event.stopPropagation()">
                    <button class="btn btn-danger" onclick="deleteClient('${c.id}')">Eliminar</button>
                </td>
            `;
        } else if (isSimplified) {
            tr.innerHTML = `
                <td><strong>${escapeHTML(c.contactName || '')}</strong>${alerts}</td>
                <td>${escapeHTML(empresaPueblo)}</td>
                <td>${escapeHTML(c.province || '')}</td>
                <td>${escapeHTML(c.inhabitants || '')}</td>
                <td>${escapeHTML(c.distance || '')} ${c.distance ? 'km' : ''}</td>
                <td>${escapeHTML(c.phone || '')}</td>
                <td onclick="event.stopPropagation(); copyToClipboard('${escapeHTML(c.email || '')}', this)" style="cursor: copy; color: var(--primary-color); text-decoration: underline;" title="Clic para copiar email">
                    ${escapeHTML(c.email || '')}
                </td>
                <td>${formatDateForDisplay(c.ultimoTrabajo)}</td>
                <td onclick="event.stopPropagation()">
                    <button class="btn btn-danger" onclick="deleteClient('${c.id}')">Eliminar</button>
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td><strong>${escapeHTML(c.contactName || '')}</strong>${alerts}</td>
                <td>${escapeHTML(empresaPueblo)}</td>
                <td>${escapeHTML(c.province || '')}</td>
                <td>${escapeHTML(c.inhabitants || '')}</td>
                <td>${escapeHTML(c.distance || '')} ${c.distance ? 'km' : ''}</td>
                <td>${escapeHTML(c.phone || '')}</td>
                <td onclick="event.stopPropagation(); copyToClipboard('${escapeHTML(c.email || '')}', this)" style="cursor: copy; color: var(--primary-color); text-decoration: underline;" title="Clic para copiar email">
                    ${escapeHTML(c.email || '')}
                </td>
                <td>${formatDateForDisplay(c.ultimoTrabajo)}</td>
                <td>${formatDateForDisplay(c.ultimoContacto)}</td>
                <td>${formatDateWithAlert(c.proximo3)}</td>
                <td>${formatDateWithAlert(c.proximo1)}</td>
                <td>${formatDateWithAlert(c.proximo2)}</td>
                <td onclick="event.stopPropagation()">
                    <button class="btn btn-danger" onclick="deleteClient('${c.id}')">Eliminar</button>
                </td>
            `;
        }

        tr.onclick = () => openClientDetails(c);

        // Hover Preview Logic
        tr.onmouseenter = (e) => showPreview(e, c);
        tr.onmousemove = (e) => movePreview(e);
        tr.onmouseleave = () => hidePreview();

        clientsBody.appendChild(tr);
    });

    // Actualizar ancho del scroll superior
    updateTopScrollbarWidth();
}

/**
 * Abre el modal con todos los detalles del cliente
 */
/**
 * Abre el modal con todos los detalles del cliente o vacío para crear uno nuevo
 */
function openClientDetails(client) {
    const isNew = !client;
    currentActiveClientId = isNew ? null : client.id;
    openedFromTab = currentTab; // Guardar de qué pestaña viene

    const fields = [
        // Fila 1
        { label: 'Nombre de Contacto', value: isNew ? '' : client.contactName, key: 'contactName' },
        { label: 'Empresa / Cliente', value: isNew ? '' : client.clientName, key: 'clientName' },
        { label: 'Pueblo', value: isNew ? '' : client.town, key: 'town' },

        // Fila 2
        { label: 'Provincia', value: isNew ? '' : client.province, key: 'province' },
        { label: 'Teléfono', value: isNew ? '' : client.phone, key: 'phone' },
        { label: 'Email', value: isNew ? '' : client.email, key: 'email' },

        // Fila 3
        { label: 'Habitantes', value: isNew ? '' : client.inhabitants, key: 'inhabitants' },
        { label: 'Distancia (km)', value: isNew ? '' : client.distance, key: 'distance', span: 2 },

        // Fila 4 (Fechas 1)
        { label: 'Último Trabajo', value: isNew ? '' : client.ultimoTrabajo, key: 'ultimoTrabajo' },
        { label: 'Importe Facturado (€)', value: isNew ? '' : client.invoicedAmount, key: 'invoicedAmount', placeholder: '0.00' },
        { label: 'Último Contacto', value: isNew ? '' : client.ultimoContacto, key: 'ultimoContacto' },

        // Fila 5 (Fechas 2)
        { label: 'Seguim. (+15 días)', value: isNew ? '' : client.proximo3, key: 'proximo3' },
        { label: 'Próx. Cont. 1 (+1 año)', value: isNew ? '' : client.proximo1, key: 'proximo1' },
        { label: 'Próx. Cont. 2 (+1 año)', value: isNew ? '' : client.proximo2, key: 'proximo2' }
    ];

    let htmlFields = fields.map(f => {
        const isDateField = f.key.includes('ultimo') || f.key.includes('proximo');
        const isAmount = f.key === 'invoicedAmount';
        const isProximo = f.key.includes('proximo');
        const inputType = isDateField ? 'date' : (isAmount ? 'number' : 'text');
        const formattedValue = isDateField ? formatDateForInput(f.value) : (f.value || '');

        // Determinar si falta el dato y si es un campo crítico
        const isCritical = ['province', 'distance', 'inhabitants'].includes(f.key);
        const isMissing = isCritical && !formattedValue.trim();
        const missingClass = isMissing ? 'input-missing-data' : '';
        const onInputAttr = isCritical ? 'oninput="this.classList.remove(\'input-missing-data\'); this.parentElement.parentElement.querySelector(\'.required-star\')?.remove()"' : '';
        const requiredStar = isMissing ? '<span class="required-star" style="color: #ef4444; margin-left: 4px; font-weight: bold;">*</span>' : '';

        if (isProximo) {
            const isSeguimiento = f.key === 'proximo3';
            const btnLabel = isSeguimiento ? '+15 días' : '+1 Año';
            const btnFunc = isSeguimiento ? 'add15DaysToInput(this)' : 'addYearToInput(this)';

            return `
                <div class="detail-item" style="${f.span ? `grid-column: span ${f.span};` : ''}">
                    <div class="detail-label">${f.label}</div>
                    <div class="detail-value">
                        <div class="date-input-group">
                            <input type="${inputType}" data-key="${f.key}" value="${escapeHTML(formattedValue)}">
                            <button type="button" class="btn-add-year" onclick="${btnFunc}">${btnLabel}</button>
                        </div>
                    </div>
                </div>
            `;
        }

        if (f.key === 'ultimoContacto') {
            return `
                <div class="detail-item">
                    <div class="detail-label">${f.label}</div>
                    <div class="detail-value">
                        <div class="date-input-group">
                            <input type="${inputType}" data-key="${f.key}" value="${escapeHTML(formattedValue)}">
                            <button type="button" class="btn-add-year" style="background-color: #10b981;" onclick="setTodayToInput(this)">Hoy</button>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="detail-item" style="${f.span ? `grid-column: span ${f.span};` : ''}">
                <div class="detail-label">${f.label}${requiredStar}</div>
                <div class="detail-value">
                    <input type="${inputType}" data-key="${f.key}" value="${escapeHTML(formattedValue)}" 
                           class="${missingClass}" ${onInputAttr}
                           ${isAmount ? 'step="0.01"' : ''}
                           placeholder="Escribe aquí..." ${f.key === 'province' ? 'list="province-list"' : ''}>
                </div>
            </div>
        `;
    }).join('');

    const isInterested = client && client.status === 'interesado';

    const statusHtml = `
        <div class="detail-item" style="grid-column: span 3; padding: 10px 0; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border-color); margin-bottom: 10px;">
            <input type="checkbox" id="modal-interested-check" ${isInterested ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
            <label for="modal-interested-check" style="font-weight: 600; color: var(--text-main); cursor: pointer;">Cliente Interesado (Color Amarillo)</label>
        </div>
    `;

    modalDetails.innerHTML = statusHtml + htmlFields;

    const historyContainer = document.getElementById('modal-history-container');
    if (historyContainer) {
        const totalFacturado = isNew ? 0 : (client.history || []).reduce((acc, h) => acc + (parseFloat(h.amount) || 0), 0);

        historyContainer.innerHTML = isNew ? '' : `
            <div class="history-section">
                <div class="history-header">
                    <h3>Historial</h3>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="total-facturado-badge">Total: ${totalFacturado.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</div>
                        <button type="button" class="btn btn-secondary" onclick="toggleHistoryForm()" style="padding: 5px 10px; font-size: 0.8rem;">+ Añadir</button>
                    </div>
                </div>
                
                <div id="history-form" class="history-form">
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <label style="display: block; font-size: 0.7rem; color: #64748b; margin-bottom: 2px;">Fecha</label>
                            <div class="date-input-group">
                                <input type="date" id="new-history-date">
                                <button type="button" class="btn-add-year" style="background-color: #10b981;" onclick="setTodayToInput(this)">Hoy</button>
                            </div>
                        </div>
                        <div style="width: 120px;">
                            <label style="display: block; font-size: 0.7rem; color: #64748b; margin-bottom: 2px;">Importe (€)</label>
                            <input type="number" id="new-history-amount" step="0.01" placeholder="0.00" style="width: 100%; box-sizing: border-box;">
                        </div>
                    </div>
                    <label style="display: block; font-size: 0.7rem; color: #64748b; margin-bottom: 2px;">Nota / Descripción</label>
                    <textarea id="new-history-note" placeholder="Escribe aquí..." style="margin-bottom: 10px;"></textarea>
                    <div style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="toggleHistoryForm()" style="padding: 5px; font-size: 0.8rem;">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-history" onclick="saveHistoryEntry()" style="padding: 5px; font-size: 0.8rem;">Guardar</button>
                    </div>
                </div>

                <div id="history-list" class="history-list">
                    <!-- Se rellena dinámicamente -->
                </div>
            </div>
        `;
    }

    if (!isNew) {
        renderHistoryList(client.history || []);
    }

    btnModalDelete.style.display = isNew ? "none" : "block";
    btnModalSave.textContent = isNew ? "Crear Cliente" : "Guardar Cambios";
    document.getElementById('modal-title').textContent = isNew ? "Nuevo Cliente" : "Ficha del Cliente";

    clientModal.style.display = "block";
}

/**
 * Guarda los cambios realizados en el modal (Crear o Editar)
 */
function saveClientChanges() {
    // AUTO-GUARDAR HISTORIAL: Si el usuario escribió una nota pero no le dio a "Guardar Registro"
    const pendingNote = document.getElementById('new-history-note');
    if (pendingNote && pendingNote.value.trim() !== '') {
        saveHistoryEntry();
    }

    const inputs = modalDetails.querySelectorAll('input[data-key]');
    const interestedCheck = document.getElementById('modal-interested-check');

    // Preservar el estado actual si ya hemos trabajado con él
    const currentClient = currentActiveClientId ? clients.find(c => c.id === currentActiveClientId) : null;
    let newStatus = (interestedCheck && interestedCheck.checked) ? 'interesado' : 'no-trabajado';

    if (currentClient && currentClient.status === 'hemos-trabajado' && newStatus === 'no-trabajado') {
        newStatus = 'hemos-trabajado';
    }

    const updatedData = {
        status: newStatus
    };

    // Verificar si ha cambiado alguna fecha relevante para contar como contacto
    const dateKeys = ['ultimoTrabajo', 'ultimoContacto', 'proximo1', 'proximo2', 'proximo3'];
    let dateModified = false;

    inputs.forEach(input => {
        const key = input.getAttribute('data-key');
        const newValue = input.value.trim();
        updatedData[key] = newValue;

        // Si es una fecha y estamos editando, comparar con el valor antiguo
        if (dateKeys.includes(key) && currentActiveClientId) {
            const client = clients.find(c => c.id === currentActiveClientId);
            if (client) {
                const oldValue = formatDateForInput(client[key]);
                const newFormatted = formatDateForInput(newValue);
                if (newFormatted !== oldValue) {
                    dateModified = true;
                }
            }
        } else if (dateKeys.includes(key) && !currentActiveClientId && newValue) {
            // Si es un cliente nuevo y se ha puesto una fecha
            dateModified = true;
        }
    });

    if (dateModified && ['distance', 'inhabitants', 'no-contact', 'vip'].includes(openedFromTab)) {
        trackContact(openedFromTab);
    }

    if (currentActiveClientId) {
        // Editar existente
        const index = clients.findIndex(c => c.id === currentActiveClientId);
        if (index !== -1) {
            Object.assign(clients[index], updatedData);
            clients[index] = ensureEventoHistory(autoUpdateStatus(clients[index]));
        }
    } else {
        // Crear nuevo
        let newClient = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            type: 'manual',
            ...updatedData
        };
        // Auto-actualizar estado por fecha antes de validar
        newClient = ensureEventoHistory(autoUpdateStatus(newClient));

        // Solo añadir si tiene algún dato relevante
        if (newClient.contactName || newClient.clientName || newClient.town || newClient.phone) {
            clients.unshift(newClient);
        } else {
            alert("Rellena al menos el nombre, la empresa o el teléfono.");
            return;
        }
    }

    saveClients();
    updateProvinceFilter(); // Actualizar el desplegable de provincias inmediatamente
    filterClients(); // Respetar pestaña y búsqueda actual
    updatePendingBadge();
    if (currentTab === 'calendar') renderCalendar();
    closeModal();
}

/**
 * Automatiza el estado según la fecha de último trabajo
 */
function autoUpdateStatus(client) {
    // 1. Si está marcado como interesado, es Amarillo (siempre manda lo manual)
    if (client.status === 'interesado') {
        return client;
    }

    // 2. Si no tiene fecha de último trabajo, es Rojo
    if (!client.ultimoTrabajo) {
        client.status = 'no-trabajado';
        return client;
    }

    const lastWorkDate = new Date(client.ultimoTrabajo);
    if (isNaN(lastWorkDate.getTime())) {
        client.status = 'no-trabajado';
        return client;
    }

    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    // 3. Si la fecha es futura o tiene menos de un año, es Verde
    if (lastWorkDate >= oneYearAgo) {
        client.status = 'hemos-trabajado';
    } else {
        // 4. Si tiene más de un año, es Rojo
        client.status = 'no-trabajado';
    }

    return client;
}

/**
 * Asegura que exista un evento en el historial si hay fecha de último trabajo
 */
function ensureEventoHistory(client) {
    if (client.ultimoTrabajo) {
        if (!client.history) client.history = [];

        const targetDate = formatDateForInput(client.ultimoTrabajo);
        if (!targetDate) return client;

        const hasEvento = client.history.some(h =>
            h.note.toLowerCase().includes('evento') &&
            formatDateForInput(h.date) === targetDate
        );

        if (!hasEvento) {
            client.history.push({
                date: targetDate,
                note: 'Evento',
                amount: parseFloat(client.invoicedAmount) || 0
            });
            // Borrar el importe de la ficha una vez pasado al historial
            client.invoicedAmount = '';
            // Ordenar historial por fecha reciente
            client.history.sort((a, b) => {
                const da = new Date(formatDateForInput(a.date)).getTime();
                const db = new Date(formatDateForInput(b.date)).getTime();
                return db - da;
            });
        }
    }
    return client;
}

/**
 * Intenta formatear una fecha (DD/MM/YYYY o cualquier cosa) al formato YYYY-MM-DD que requiere el input date
 */
function formatDateForInput(dateStr) {
    if (!dateStr) return '';

    // Si ya viene en formato YYYY-MM-DD, lo devolvemos tal cual
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    // Si viene en formato DD/MM/YYYY o DD/MM/YY
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
        let day = parts[0].padStart(2, '0');
        let month = parts[1].padStart(2, '0');
        let year = parts[2];

        if (year.length === 4) { // DD/MM/YYYY
            return `${year}-${month}-${day}`;
        } else if (year.length === 2) { // DD/MM/YY
            return `20${year}-${month}-${day}`;
        } else if (day.length === 4) { // YYYY/MM/DD
            return `${day}-${month}-${year.padStart(2, '0')}`;
        }
    }

    return ''; // Si no reconoce el formato, mejor dejarlo vacío para que el usuario use el calendario
}

/**
 * Añade un año a la fecha del input actual
 */
window.addYearToInput = function (btn) {
    const input = btn.parentElement.querySelector('input');
    if (!input || !input.value) return;

    const date = new Date(input.value);
    if (isNaN(date.getTime())) return;

    date.setFullYear(date.getFullYear() + 1);

    // Formatear a YYYY-MM-DD
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    input.value = `${y}-${m}-${d}`;
}

/**
 * Añade 15 días a la fecha del input actual
 */
window.add15DaysToInput = function (btn) {
    const input = btn.parentElement.querySelector('input');
    if (!input || !input.value) return;

    const date = new Date(input.value);
    if (isNaN(date.getTime())) return;

    date.setDate(date.getDate() + 15);

    // Formatear a YYYY-MM-DD
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    input.value = `${y}-${m}-${d}`;
}

/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD ajustada a la hora local
 */
function getLocalTodayISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - offset)).toISOString().split('T')[0];
    return localISOTime;
}

/**
 * Pone la fecha de hoy en el input actual
 */
window.setTodayToInput = function (btn) {
    const input = btn.parentElement.querySelector('input');
    if (!input) return;
    input.value = getLocalTodayISO();
}

/**
 * Historial de Gestiones
 */
window.toggleHistoryForm = function () {
    const form = document.getElementById('history-form');
    form.style.display = form.style.display === 'block' ? 'none' : 'block';
    if (form.style.display === 'block') {
        document.getElementById('new-history-date').value = getLocalTodayISO();
    }
}

window.saveHistoryEntry = function () {
    const dateInput = document.getElementById('new-history-date');
    const noteInput = document.getElementById('new-history-note');
    const amountInput = document.getElementById('new-history-amount');
    const saveBtn = document.getElementById('btn-save-history');
    const editIndex = saveBtn.dataset.editIndex;

    if (!noteInput.value.trim()) {
        alert("Escribe una nota para el registro.");
        return;
    }

    const client = clients.find(c => c.id === currentActiveClientId);
    if (!client) return;

    if (!client.history) client.history = [];

    const entry = {
        date: dateInput.value || getLocalTodayISO(),
        note: noteInput.value.trim(),
        amount: parseFloat(amountInput.value) || 0
    };

    if (editIndex !== undefined) {
        client.history[parseInt(editIndex)] = entry;
    } else {
        client.history.push(entry);
    }

    // Ordenar historial por fecha reciente
    client.history.sort((a, b) => {
        const da = new Date(formatDateForInput(a.date)).getTime();
        const db = new Date(formatDateForInput(b.date)).getTime();
        return db - da;
    });

    saveClients();

    // Recalcular total y refrescar UI
    const totalFacturado = client.history.reduce((acc, h) => acc + (parseFloat(h.amount) || 0), 0);
    const badge = document.querySelector('.total-facturado-badge');
    if (badge) badge.textContent = `Total: ${totalFacturado.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`;

    renderHistoryList(client.history);

    // Limpiar y ocultar
    noteInput.value = '';
    amountInput.value = '';
    document.getElementById('history-form').style.display = 'none';
    delete document.getElementById('btn-save-history').dataset.editIndex;
}

window.editHistoryEntry = function (index) {
    const client = clients.find(c => c.id === currentActiveClientId);
    if (!client || !client.history[index]) return;

    const entry = client.history[index];

    // Mostrar formulario si estaba oculto
    const form = document.getElementById('history-form');
    form.style.display = 'block';

    document.getElementById('new-history-date').value = formatDateForInput(entry.date);
    document.getElementById('new-history-note').value = entry.note;
    document.getElementById('new-history-amount').value = entry.amount || '';

    // Guardar el índice que estamos editando
    const saveBtn = document.getElementById('btn-save-history');
    saveBtn.dataset.editIndex = index;
    saveBtn.textContent = "Actualizar Registro";
}

window.deleteHistoryEntry = function (index) {
    if (!confirm("¿Seguro que quieres borrar este registro del historial?")) return;

    const client = clients.find(c => c.id === currentActiveClientId);
    if (!client) return;

    client.history.splice(index, 1);
    saveClients();

    // Recalcular total y refrescar UI
    const totalFacturado = client.history.reduce((acc, h) => acc + (parseFloat(h.amount) || 0), 0);
    const badge = document.querySelector('.total-facturado-badge');
    if (badge) badge.textContent = `Total: ${totalFacturado.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`;

    renderHistoryList(client.history);
}

function deleteClientFromModal() {
    if (currentActiveClientId) {
        if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
            clients = clients.filter(c => c.id !== currentActiveClientId);
            saveClients();
            filterClients();
            closeModal();
        }
    }
}

function renderHistoryList(history) {
    const list = document.getElementById('history-list');
    if (!list) return;

    if (history.length === 0) {
        list.innerHTML = '<p style="color: #64748b; font-style: italic; margin-top: 10px;">No hay registros previos.</p>';
        return;
    }

    list.innerHTML = history.map((h, index) => {
        const isEvento = h.note.toLowerCase().trim() === 'evento';
        return `
        <div class="history-entry${isEvento ? ' history-entry--evento' : ''}">
            <div class="history-actions">
                <button class="btn-action btn-edit-note" onclick="editHistoryEntry(${index})" title="Editar">✎</button>
                <button class="btn-action btn-delete-note" onclick="deleteHistoryEntry(${index})" title="Borrar">✕</button>
            </div>
            <div class="history-entry-top">
                <div class="history-entry-date">${formatDateForDisplay(h.date)}</div>
                ${h.amount ? `<div class="history-entry-amount">${parseFloat(h.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</div>` : ''}
            </div>
            <div class="history-entry-note">${escapeHTML(h.note)}</div>
        </div>`;
    }).join('');
}

/**
 * Lógica de Vista Previa (Hover)
 */
function showPreview(e, client) {
    const history = client.history || [];
    if (history.length === 0) return;

    const lastEntries = history.slice(0, 3); // Coger las 3 últimas
    let html = `<div class="preview-title">Últimas Gestiones:</div>`;

    html += lastEntries.map(h => `
        <div class="preview-entry">
            <div class="preview-date">${formatDateForDisplay(h.date)}</div>
            <div class="history-entry-note">${escapeHTML(h.note)}</div>
        </div>
    `).join('');

    hoverPreview.innerHTML = html;
    hoverPreview.style.display = 'block';
    movePreview(e);
}

function movePreview(e) {
    if (hoverPreview.style.display === 'block') {
        const padding = 15;
        let x = e.clientX + padding;
        let y = e.clientY + padding;

        // Evitar que se salga por la derecha
        if (x + 300 > window.innerWidth) {
            x = e.clientX - 315;
        }
        // Evitar que se salga por abajo
        if (y + 200 > window.innerHeight) {
            y = e.clientY - 215;
        }

        hoverPreview.style.left = x + 'px';
        hoverPreview.style.top = y + 'px';
    }
}

function hidePreview() {
    hoverPreview.style.display = 'none';
}

/**
 * Actualiza el ancho del div interno del scroll superior para que coincida con la tabla
 */
function updateTopScrollbarWidth() {
    if (topScrollbarContent && tableWrapper) {
        const table = tableWrapper.querySelector('table');
        if (table) {
            topScrollbarContent.style.width = table.offsetWidth + 'px';
        }
    }
}

/**
 * Filtra los clientes en la tabla
 */
let currentTab = 'pending';

function switchTab(tab) {
    currentTab = tab;
    if (tabAll) tabAll.classList.toggle('active', tab === 'all');
    if (tabPending) tabPending.classList.toggle('active', tab === 'pending');
    if (tabDistance) tabDistance.classList.toggle('active', tab === 'distance');
    if (tabInhabitants) tabInhabitants.classList.toggle('active', tab === 'inhabitants');
    if (tabNoContact) tabNoContact.classList.toggle('active', tab === 'no-contact');
    if (tabCalendar) tabCalendar.classList.toggle('active', tab === 'calendar');
    if (tabVip) tabVip.classList.toggle('active', tab === 'vip');
    if (tabBilling) tabBilling.classList.toggle('active', tab === 'billing');

    // Mostrar/Ocultar tabla o calendario
    if (calendarView && tableWrapper) {
        if (tab === 'calendar') {
            calendarView.style.display = 'block';
            tableWrapper.style.display = 'none';
            if (topScrollbarContainer) topScrollbarContainer.style.display = 'none';
            renderCalendar();
        } else {
            calendarView.style.display = 'none';
            tableWrapper.style.display = 'block';
            if (topScrollbarContainer) topScrollbarContainer.style.display = 'block';
            filterClients();
        }
    }
}

function filterClients() {
    if (!searchInput) return;
    const term = searchInput.value.toLowerCase();
    const prov = filterProvince ? filterProvince.value : '';
    const habRange = filterInhabitants ? filterInhabitants.value : '';

    let filtered = clients.filter(c => {
        // Filtro de texto
        const matchText = (c.clientName && c.clientName.toLowerCase().includes(term)) ||
            (c.contactName && c.contactName.toLowerCase().includes(term)) ||
            (c.town && c.town.toLowerCase().includes(term)) ||
            (c.province && c.province.toLowerCase().includes(term)) ||
            (c.phone && c.phone.toLowerCase().includes(term)) ||
            (c.email && c.email.toLowerCase().includes(term));

        if (!matchText) return false;

        // Filtro de provincia
        if (prov && c.province !== prov) return false;

        // Filtro de habitantes
        if (habRange) {
            const hab = parseInt(String(c.inhabitants || '0').replace(/\./g, '')) || 0;
            switch (habRange) {
                case 'very-small': if (hab >= 500) return false; break;
                case 'small': if (hab < 500 || hab > 1000) return false; break;
                case 'medium': if (hab < 1000 || hab > 5000) return false; break;
                case 'large': if (hab < 5000 || hab > 10000) return false; break;
                case 'very-large': if (hab <= 10000 || hab >= 1000000) return false; break;
                case 'mancomunidad': if (hab !== 1000000) return false; break;
            }
        }

        return true;
    });

    if (currentTab === 'pending') {
        filtered = filtered.filter(c => c.proximo1 || c.proximo2 || c.proximo3);
        filtered.sort((a, b) => {
            const getMinDate = (client) => {
                const dates = [client.proximo1, client.proximo2, client.proximo3]
                    .filter(d => d)
                    .map(d => {
                        const iso = formatDateForInput(d);
                        const timestamp = new Date(iso).getTime();
                        return isNaN(timestamp) ? Infinity : timestamp;
                    });
                return dates.length > 0 ? Math.min(...dates) : Infinity;
            };
            return getMinDate(a) - getMinDate(b);
        });
    } else if (currentTab === 'distance') {
        const today = new Date().getTime();
        const ms334Days = 334 * 24 * 60 * 60 * 1000;

        filtered = filtered.filter(c => {
            // Solo si tiene el campo distancia relleno
            if (!c.distance || c.distance.trim() === '') return false;

            // Si tiene alguna gestión próxima programada, no aparece aquí
            if (c.proximo1 || c.proximo2 || c.proximo3) return false;

            if (!c.ultimoContacto) return true; // Si nunca hemos contactado, entra en la lista
            const iso = formatDateForInput(c.ultimoContacto);
            const contactTime = new Date(iso).getTime();
            if (isNaN(contactTime)) return true;
            return (today - contactTime) > ms334Days;
        });

        filtered.sort((a, b) => {
            const distA = parseFloat(a.distance) || 0;
            const distB = parseFloat(b.distance) || 0;
            return distA - distB;
        });
    } else if (currentTab === 'vip') {
        const today = new Date().getTime();
        const ms334Days = 334 * 24 * 60 * 60 * 1000;

        // Filtro de entrada VIP
        filtered = filtered.filter(c => {
            // Excluir interesados (ya están en pendientes)
            if (c.status === 'interesado') return false;

            // Excluir si ya tiene gestión pendiente programada (manual)
            if (c.proximo1 || c.proximo2 || c.proximo3) return false;

            // Filtro de 334 días (enfriamiento)
            if (!c.ultimoContacto) return true;
            const iso = formatDateForInput(c.ultimoContacto);
            const contactTime = new Date(iso).getTime();
            if (isNaN(contactTime)) return true;
            return (today - contactTime) > ms334Days;
        });

        // Calcular puntuaciones y ordenar
        filtered.forEach(c => {
            const result = calculateLaserScore(c);
            c._vipScore = result.total;
            c._vipReason = result.reason;
        });

        filtered.sort((a, b) => b._vipScore - a._vipScore);
    } else if (currentTab === 'inhabitants') {
        const today = new Date().getTime();
        const ms334Days = 334 * 24 * 60 * 60 * 1000;

        filtered = filtered.filter(c => {
            // Si tiene alguna gestión próxima programada, no aparece aquí
            if (c.proximo1 || c.proximo2 || c.proximo3) return false;

            // Excluir Mancomunidades (1.000.000 habitantes)
            const hab = parseInt(String(c.inhabitants || '0').replace(/\./g, '')) || 0;
            if (hab === 1000000) return false;

            if (!c.ultimoContacto) return true;
            const iso = formatDateForInput(c.ultimoContacto);
            const contactTime = new Date(iso).getTime();
            if (isNaN(contactTime)) return true;
            return (today - contactTime) > ms334Days;
        });

        filtered.sort((a, b) => {
            // Limpiar puntos de los habitantes si existen (ej: 1.000 -> 1000)
            const habA = parseInt(String(a.inhabitants || '0').replace(/\./g, '')) || 0;
            const habB = parseInt(String(b.inhabitants || '0').replace(/\./g, '')) || 0;
            return habB - habA; // De más a menos
        });
    } else if (currentTab === 'no-contact') {
        filtered = filtered.filter(c => {
            // No tiene ninguna fecha en ningún campo
            const noDates = !c.ultimoTrabajo && !c.ultimoContacto && !c.proximo1 && !c.proximo2 && !c.proximo3;

            // Excluir Mancomunidades (1.000.000 habitantes)
            const hab = parseInt(String(c.inhabitants || '0').replace(/\./g, '')) || 0;
            const isMancomunidad = hab === 1000000;

            return noDates && !isMancomunidad;
        });

    } else if (currentTab === 'billing') {
        // En facturación mostramos todos los que tengan ALGO facturado
        filtered = filtered.filter(c => (c.history || []).length > 0);

        filtered.forEach(c => {
            c._totalFacturado = (c.history || []).reduce((acc, h) => acc + (parseFloat(h.amount) || 0), 0);
        });
        filtered.sort((a, b) => b._totalFacturado - a._totalFacturado);
    }
    renderTable(filtered);
}

function formatDateWithAlert(dateStr) {
    if (!dateStr) return '-';

    const displayDate = formatDateForDisplay(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Usamos formatDateForInput para asegurar un formato ISO (YYYY-MM-DD) antes de comparar
    const isoDate = formatDateForInput(dateStr);
    const date = new Date(isoDate);

    if (isNaN(date.getTime())) return `<strong>${escapeHTML(displayDate)}</strong>`;

    let className = '';
    if (date < today) {
        className = 'date-expired';
    } else if (date.getTime() === today.getTime()) {
        className = 'date-today';
    }

    return `<span class="${className}">${escapeHTML(displayDate)}</span>`;
}

function formatDateForDisplay(dateStr) {
    if (!dateStr) return '-';
    // Escapamos primero por seguridad
    const cleanStr = escapeHTML(dateStr.toString());
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
        const [y, m, d] = cleanStr.split('-');
        return `${d}/${m}/${y}`;
    }
    return cleanStr.replace(/-/g, '/');
}

/**
 * Elimina un cliente por su ID
 */
window.deleteClient = function (id) {
    if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
        clients = clients.filter(c => c.id !== id);
        saveClients();

        // Reaplicar filtro si hay búsqueda activa
        if (searchInput.value) {
            filterClients();
        } else {
            renderTable(clients);
        }
    }
};

/**
 * Exportar datos a JSON (Backup manual)
 */
function exportData() {
    if (clients.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(clients));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "backup_clientes_laser_" + new Date().toISOString().split('T')[0] + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

/**
 * Importar datos desde JSON
 */
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedClients = JSON.parse(e.target.result);
            if (Array.isArray(importedClients)) {
                if (confirm(`Se han encontrado ${importedClients.length} clientes en el archivo. ¿Deseas reemplazar la base de datos actual o añadirlos a los existentes?\n\nOK = Reemplazar\nCancelar = Añadir`)) {
                    clients = importedClients;
                } else {
                    clients = [...importedClients, ...clients];
                }
                saveClients();
                renderTable(clients);
                alert("Datos importados con éxito.");
            } else {
                alert("El archivo no tiene un formato válido.");
            }
        } catch (error) {
            alert("Error al leer el archivo JSON.");
            console.error(error);
        }
        // Limpiar el input file
        inputImport.value = '';
    };
    reader.readAsText(file);
}

/**
 * Función de seguridad para escapar HTML
 */
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

/**
 * Copia un texto al portapapeles y muestra un feedback visual
 */
window.copyToClipboard = function (text, element) {
    if (!text || text === '-') return;

    navigator.clipboard.writeText(text).then(() => {
        // Crear un pequeño aviso flotante (Toast)
        const toast = document.createElement('div');
        toast.textContent = '¡Email copiado!';
        toast.style.position = 'fixed';
        toast.style.background = 'var(--primary-color)';
        toast.style.color = 'white';
        toast.style.padding = '8px 12px';
        toast.style.borderRadius = '4px';
        toast.style.fontSize = '0.85rem';
        toast.style.zIndex = '10000';
        toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        toast.style.pointerEvents = 'none';

        // Posicionar cerca del clic
        const rect = element.getBoundingClientRect();
        toast.style.top = (rect.top - 30) + 'px';
        toast.style.left = rect.left + 'px';

        document.body.appendChild(toast);

        // Animación de salida
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 1500);
    }).catch(err => {
        console.error('Error al copiar:', err);
    });
}

/**
 * Notificaciones Visuales
 */
function updatePendingBadge() {
    if (!pendingBadge) return;

    const today = getLocalTodayISO();
    const hasUrgent = clients.some(c => {
        const dates = [c.proximo1, c.proximo2, c.proximo3].filter(d => d);
        return dates.some(d => formatDateForInput(d) <= today);
    });

    pendingBadge.style.display = hasUrgent ? 'inline-block' : 'none';
}

/**
 * Sistema de Estadísticas Diarias
 */
function trackContact(tabName) {
    const today = getLocalTodayISO();
    if (!dailyStats[today]) {
        dailyStats[today] = { distance: 0, inhabitants: 0, 'no-contact': 0, vip: 0 };
    }

    // Solo incrementamos si el nombre de la pestaña es válido para estadísticas
    const validTabs = ['distance', 'inhabitants', 'no-contact', 'vip'];
    if (validTabs.includes(tabName)) {
        dailyStats[today][tabName] = (dailyStats[today][tabName] || 0) + 1;
        localStorage.setItem('laser_daily_stats', JSON.stringify(dailyStats));
        if (typeof db !== 'undefined') db.ref('dailyStats').set(dailyStats);
        updateDailyStatsUI();
    }
}

function updateDailyStatsUI() {
    const statsBar = document.getElementById('daily-stats-bar');
    if (!statsBar) return;

    const today = getLocalTodayISO();
    const s = dailyStats[today] || { distance: 0, inhabitants: 0, 'no-contact': 0, vip: 0 };

    statsBar.innerHTML = `
        <div class="stat-item ${s.vip > 0 ? 'active' : ''}" style="border-color: var(--primary-color);" title="Contactados hoy desde la pestaña Ranking VIP">
            ⭐ VIP: <span>${s.vip || 0}</span>
        </div>
        <div class="stat-item ${s.distance > 0 ? 'active' : ''}" title="Contactados hoy desde la pestaña Distancia">
            📍 Distancia: <span>${s.distance || 0}</span>
        </div>
        <div class="stat-item ${s.inhabitants > 0 ? 'active' : ''}" title="Contactados hoy desde la pestaña Habitantes">
            👥 Habitantes: <span>${s.inhabitants || 0}</span>
        </div>
        <div class="stat-item ${s['no-contact'] > 0 ? 'active' : ''}" title="Contactados hoy desde la pestaña Sin Contactar">
            📵 Sin contactar: <span>${s['no-contact'] || 0}</span>
        </div>
    `;
}

/**
 * Lógica del Calendario
 */
/**
 * Cerebro del Sistema: Calcula el Ranking VIP (0-100 pts)
 */
function calculateLaserScore(client) {
    // Excluir mancomunidades del cálculo base (1,000,000 hab)
    const scoredClients = clients.filter(c => {
        const inhabs = parseInt(String(c.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
        return inhabs !== 1000000 && c.history && c.history.some(entry => (parseFloat(entry.amount) || 0) > 0);
    });

    // Si el cliente actual es una mancomunidad, su score es 0 o muy bajo
    const currentH = parseInt(String(client.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
    if (currentH === 1000000) return { total: 0, reason: "Mancomunidades excluidas del ranking VIP" };
    let scoreDistance = 0;
    let scoreProvince = 0;
    let scoreTiming = 0;
    let reasons = [];

    // 1. Potencial Económico (40 pts) - Basado en éxito REAL por rangos de habitantes
    const ranges = {
        '<100': { total: 0, count: 0 },
        '100-499': { total: 0, count: 0 },
        '500-1.999': { total: 0, count: 0 },
        '2.000-4.999': { total: 0, count: 0 },
        '5.000-9.999': { total: 0, count: 0 },
        '10.000-19.999': { total: 0, count: 0 },
        '20.000-49.999': { total: 0, count: 0 },
        '50.000-99.999': { total: 0, count: 0 },
        '100.000-499.999': { total: 0, count: 0 },
        '500.000+': { total: 0, count: 0 }
    };

    const getRangeKey = (h) => {
        const cleanH = parseInt(String(h).replace(/[^\d]/g, '')) || 0;
        if (cleanH >= 500000) return '500.000+';
        if (cleanH >= 100000) return '100.000-499.999';
        if (cleanH >= 50000) return '50.000-99.999';
        if (cleanH >= 20000) return '20.000-49.999';
        if (cleanH >= 10000) return '10.000-19.999';
        if (cleanH >= 5000) return '5.000-9.999';
        if (cleanH >= 2000) return '2.000-4.999';
        if (cleanH >= 500) return '500-1.999';
        if (cleanH >= 100) return '100-499';
        return '<100';
    };

    // Paso 1: Calcular medias solo con dinero REAL
    scoredClients.forEach(c => {
        const inhabs = parseInt(String(c.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
        const total = c.history.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
        const key = getRangeKey(inhabs);
        ranges[key].total += total;
        ranges[key].count++;
    });

    const averages = Object.entries(ranges).map(([key, data]) => ({
        key,
        avg: data.count > 0 ? data.total / data.count : 0
    }));
    const maxAvg = Math.max(...averages.map(a => a.avg));

    let scoreInhabitants = 0;
    if (maxAvg > 0) {
        const inhabs = parseInt(String(client.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
        const currentKey = getRangeKey(inhabs);
        const currentAvg = ranges[currentKey].total / (ranges[currentKey].count || 1);
        scoreInhabitants = (currentAvg / maxAvg) * 40;
        reasons.push(`Rentabilidad: ${Math.round(scoreInhabitants)}/40 pts (${currentKey})`);
    }

    // Paso 2: Crear lista de REFERENCIA (Éxitos Reales + Interesados Virtuales)
    // Esto servirá para Logística y Provincia
    const referenceData = clients.filter(c => {
        const inhabs = parseInt(String(c.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
        const hasMoney = c.history && c.history.some(e => (parseFloat(e.amount) || 0) > 0);
        return inhabs !== 1000000 && (hasMoney || c.status === 'interesado');
    }).map(c => {
        const inhabs = parseInt(String(c.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
        const rKey = getRangeKey(inhabs);
        const realAmount = c.history ? c.history.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0) : 0;

        // Si no tiene dinero real pero es interesado, le asignamos la media de su rango
        const virtualAmount = realAmount > 0 ? realAmount : (ranges[rKey].total / (ranges[rKey].count || 1));

        return {
            distance: parseFloat(c.distance) || 0,
            province: c.province,
            amount: virtualAmount
        };
    });

    // 2. Logística (30 pts) - Basada en cercanía a Éxitos o Interesados
    const distances = referenceData.map(d => d.distance).filter(d => d > 0);
    if (distances.length > 0) {
        const minDist = Math.min(...distances);
        const maxDist = Math.max(...distances);
        const currentDist = parseFloat(client.distance) || 0;
        if (currentDist > 0 && maxDist > minDist) {
            const score = 30 * (1 - (currentDist - minDist) / (maxDist - minDist));
            scoreDistance = Math.max(0, Math.min(30, score));
            reasons.push(`Logística: ${Math.round(scoreDistance)}/30 pts (${currentDist} km)`);
        } else if (currentDist > 0 && currentDist <= minDist) {
            scoreDistance = 30;
            reasons.push(`Logística: 30/30 pts (Distancia mínima)`);
        }
    }

    // 3. Provincia (10 pts) - Basada en volumen real + potencial interesado
    const provStats = {};
    referenceData.forEach(d => {
        if (!d.province) return;
        provStats[d.province] = (provStats[d.province] || 0) + d.amount;
    });

    const bills = Object.values(provStats);
    if (bills.length > 0) {
        const maxBill = Math.max(...bills);
        const currentProvBill = provStats[client.province] || 0;
        scoreProvince = (currentProvBill / maxBill) * 10;
        if (scoreProvince > 0) {
            reasons.push(`Provincia: ${Math.round(scoreProvince)}/10 pts (${client.province})`);
        }
    }

    // 4. Timing Predictivo (Máx 20 pts)
    // No calculamos fechas manuales porque esos clientes se excluyen del ranking
    if (true) {
        // PRIORIDAD PREDICTIVA REFINADA (Máx 20 pts)
        const inhabitants = parseInt(String(client.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
        const currentProv = client.province;

        const getRangeKey = (h) => {
            const cleanH = parseInt(String(h).replace(/[^\d]/g, '')) || 0;
            if (cleanH >= 500000) return '500.000+';
            if (h >= 100000) return '100.000-499.999';
            if (h >= 50000) return '50.000-99.999';
            if (h >= 20000) return '20.000-49.999';
            if (h >= 10000) return '10.000-19.999';
            if (h >= 5000) return '5.000-9.999';
            if (h >= 2000) return '2.000-4.999';
            if (h >= 500) return '500-1.999';
            if (h >= 100) return '100-499';
            return '<100';
        };

        const rangeKey = getRangeKey(inhabitants);

        // Buscar clientes "afines" (Misma provincia y mismo rango) que tengan fechas proximo1 o proximo2
        const similarClients = clients.filter(c => {
            if (c.id === client.id) return false;
            if (c.province !== currentProv) return false;
            const h = parseInt(String(c.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
            const r = getRangeKey(h);
            const hasMoney = c.history && c.history.some(e => (parseFloat(e.amount) || 0) > 0);
            return r === rangeKey && (hasMoney || c.status === 'interesado') && (c.proximo1 || c.proximo2);
        });

        let totalPredictiveScore = 0;
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalizar a medianoche

        similarClients.forEach(c => {
            [c.proximo1, c.proximo2].forEach(dateStr => {
                if (!dateStr) return;
                const d = new Date(formatDateForInput(dateStr));
                if (isNaN(d.getTime())) return;

                // Crear fecha de comparación para este año
                let compareDate = new Date(now.getFullYear(), d.getMonth(), d.getDate());

                // Calcular distancia absoluta
                let diffMs = Math.abs(now - compareDate);
                let diffDays = diffMs / (1000 * 60 * 60 * 24);

                // Si la diferencia es mayor a 180 días, probar con el año anterior/siguiente 
                // para encontrar la distancia cíclica real
                if (diffDays > 182) {
                    diffDays = 365 - diffDays;
                }

                // Lógica de puntuación escalada (±15 días)
                if (diffDays <= 2) {
                    totalPredictiveScore += 20;
                } else if (diffDays <= 15) {
                    // Escalar de 20 a 5 puntos entre el día 2 y el día 15
                    const points = 20 - ((diffDays - 2) * (15 / 13));
                    totalPredictiveScore += Math.max(5, points);
                }
            });
        });

        timingPuntos = Math.min(20, totalPredictiveScore);
        if (timingPuntos > 0) {
            reasons.push(`Timing: ${Math.round(timingPuntos)}/20 pts (Predicción: ${currentProv})`);
        }
    }
    scoreTiming = timingPuntos;

    return {
        total: scoreInhabitants + scoreDistance + scoreProvince + scoreTiming,
        reason: reasons.join('\n')
    };
}

/**
 * Lógica de Alertas de Calidad de Datos
 */
function renderAlertIcons(client) {
    let html = '';
    const today = getLocalTodayISO();
    const inhabitants = parseInt(String(client.inhabitants || '0').replace(/\./g, '')) || 0;
    const isMancomunidad = inhabitants === 1000000;

    const hasHistory = (client.history && client.history.some(h => (parseFloat(h.amount) || 0) > 0)) || (parseFloat(client.invoicedAmount) || 0) > 0;

    // 1. Alerta de Datos Incompletos (Warning) - OMITIR EN MANCOMUNIDADES
    if (hasHistory && !isMancomunidad) {
        const missing = [];
        if (!client.province) missing.push('Provincia');
        if (!client.inhabitants) missing.push('Habitantes');
        if (!client.distance) missing.push('Distancia');

        if (missing.length > 0) {
            html += `<span class="alert-icon alert-icon--warning" data-tooltip="Falta: ${missing.join(', ')}">⚠️</span>`;
        }
    }

    // 2. Alerta de Importe Pendiente (Danger)
    if (client.ultimoTrabajo) {
        const workDate = formatDateForInput(client.ultimoTrabajo);
        if (workDate < today) {
            const hasAmountInHistory = client.history && client.history.some(h =>
                formatDateForInput(h.date) === workDate && (parseFloat(h.amount) || 0) > 0
            );

            if (!hasAmountInHistory) {
                html += `<span class="alert-icon alert-icon--danger" data-tooltip="Importe pendiente (Evento pasado)">💰</span>`;
            }
        }
    }

    return html;
}

function updateAuditCounter() {
    const auditSpan = document.getElementById('client-count');
    if (!auditSpan) return;

    const today = getLocalTodayISO();
    const incompleteCount = clients.filter(c => {
        const inhabitants = parseInt(String(c.inhabitants || '0').replace(/\./g, '')) || 0;
        const isMancomunidad = inhabitants === 1000000;

        const hasHistory = (c.history && c.history.some(h => (parseFloat(h.amount) || 0) > 0)) || (parseFloat(c.invoicedAmount) || 0) > 0;
        const missingData = !isMancomunidad && hasHistory && (!c.province || !c.inhabitants || !c.distance);

        let missingAmount = false;
        if (c.ultimoTrabajo) {
            const workDate = formatDateForInput(c.ultimoTrabajo);
            if (workDate < today) {
                const hasAmountInHistory = c.history && c.history.some(h =>
                    formatDateForInput(h.date) === workDate && (parseFloat(h.amount) || 0) > 0
                );
                if (!hasAmountInHistory) missingAmount = true;
            }
        }

        return missingData || missingAmount;
    }).length;

    if (incompleteCount > 0) {
        let existingAudit = document.getElementById('audit-info');
        if (!existingAudit) {
            existingAudit = document.createElement('span');
            existingAudit.id = 'audit-info';
            existingAudit.className = 'audit-counter';
            auditSpan.parentElement.appendChild(existingAudit);
        }
        existingAudit.innerHTML = `| <b>${incompleteCount}</b> por revisar`;
    } else {
        const existingAudit = document.getElementById('audit-info');
        if (existingAudit) existingAudit.remove();
    }
}

/**
 * Sistema de Tooltips Inteligentes (Evita recortes en los bordes de pantalla)
 */
function createCustomTooltip() {
    if (!document.getElementById('custom-tooltip')) {
        const div = document.createElement('div');
        div.id = 'custom-tooltip';
        div.className = 'custom-tooltip';
        document.body.appendChild(div);
    }
}

window.showVipTooltip = function (e, element) {
    const tooltip = document.getElementById('custom-tooltip');
    if (!tooltip) return;

    const reason = element.getAttribute('data-reason');
    if (!reason) return;

    tooltip.textContent = reason;
    tooltip.style.display = 'block';

    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.top - tooltipRect.height - 10;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    // Si se sale por arriba, mostrar debajo
    if (top < 10) {
        top = rect.bottom + 10;
    }

    // Si se sale por la izquierda
    if (left < 10) left = 10;

    // Si se sale por la derecha
    if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
    }

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
};

window.hideVipTooltip = function () {
    const tooltip = document.getElementById('custom-tooltip');
    if (tooltip) tooltip.style.display = 'none';
};

let calendarDate = new Date();

function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const monthYearLabel = document.getElementById('calendar-month-year');
    if (monthYearLabel) {
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        monthYearLabel.textContent = `${monthNames[month]} ${year}`;
    }

    const calendarDays = document.getElementById('calendar-days');
    if (!calendarDays) return;
    calendarDays.innerHTML = '';

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Ajuste para que el lunes sea 0 (JS usa 0=Domingo)
    let startDay = firstDay.getDay() - 1;
    if (startDay === -1) startDay = 6;

    // Días del mes anterior para rellenar el grid
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay; i > 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.innerHTML = `<span class="day-number">${prevLastDay - i + 1}</span>`;
        calendarDays.appendChild(dayDiv);
    }

    // Días del mes actual
    const today = getLocalTodayISO();
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const dayDiv = document.createElement('div');
        const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        dayDiv.className = 'calendar-day' + (dateISO === today ? ' today' : '');

        dayDiv.innerHTML = `<span class="day-number">${i}</span>`;

        // Añadir estadísticas diarias si existen
        if (dailyStats[dateISO]) {
            const s = dailyStats[dateISO];
            if (s.distance > 0 || s.inhabitants > 0 || s['no-contact'] > 0 || s.vip > 0) {
                const statsDiv = document.createElement('div');
                statsDiv.className = 'calendar-day-stats';
                if (s.vip > 0) statsDiv.innerHTML += `<span class="day-stat-pill" style="background: var(--primary-color); color: white;">⭐ ${s.vip}</span>`;
                if (s.distance > 0) statsDiv.innerHTML += `<span class="day-stat-pill">📍 ${s.distance}</span>`;
                if (s.inhabitants > 0) statsDiv.innerHTML += `<span class="day-stat-pill">👥 ${s.inhabitants}</span>`;
                if (s['no-contact'] > 0) statsDiv.innerHTML += `<span class="day-stat-pill">📵 ${s['no-contact']}</span>`;
                dayDiv.appendChild(statsDiv);
            }
        }

        // Buscar eventos para este día
        const isTodayCell = (dateISO === today);

        // Usar un Set para evitar duplicados del mismo cliente en la misma celda
        const renderedClientsInDay = new Set();

        clients.forEach(c => {
            const clientDates = [
                { val: c.proximo1, label: 'P1' },
                { val: c.proximo2, label: 'P2' },
                { val: c.proximo3, label: 'P3' }
            ].filter(d => d.val);

            // Determinar si este cliente debe aparecer en esta celda
            let statusClass = '';
            let labelExtra = '';
            let shouldRender = false;

            for (const d of clientDates) {
                const eventDateISO = formatDateForInput(d.val);

                if (eventDateISO === dateISO) {
                    shouldRender = true;
                    if (eventDateISO < today) statusClass = 'overdue-event';
                    else if (eventDateISO === today) statusClass = 'today-event';
                    break; // Ya sabemos que se pinta aquí, no miramos más fechas de este cliente
                } else if (isTodayCell && eventDateISO < today) {
                    shouldRender = true;
                    statusClass = 'today-event';
                    labelExtra = ' [ATRASADO]';
                    break;
                }
            }

            if (shouldRender && !renderedClientsInDay.has(c.id)) {
                const eventDiv = document.createElement('div');
                eventDiv.className = `calendar-event ${statusClass}`;
                eventDiv.textContent = `${c.clientName || c.contactName}${labelExtra}`;
                eventDiv.onclick = (e) => {
                    e.stopPropagation();
                    openClientDetails(c);
                };
                dayDiv.appendChild(eventDiv);
                renderedClientsInDay.add(c.id);
            }
        });

        calendarDays.appendChild(dayDiv);
    }
}

function changeMonth(delta) {
    calendarDate.setMonth(calendarDate.getMonth() + delta);
    renderCalendar();
}

/**
 * Gestión de Plantillas de Textos
 */
let emailTemplates = {
    "Juventud": { subject: "", body: "" },
    "Joventut": { subject: "", body: "" },
    "Ayuntamientos": { subject: "", body: "" },
    "Ajuntaments": { subject: "", body: "" }
};

function loadTemplates() {
    const saved = localStorage.getItem('laser_text_templates');
    if (saved) {
        emailTemplates = JSON.parse(saved);
    }
}

window.openTextosModal = function () {
    loadTemplates();
    const container = document.getElementById('textos-container');
    if (!container) return;

    container.innerHTML = Object.entries(emailTemplates).map(([name, data]) => `
        <div class="texto-card" id="card-${name}" data-name="${name}">
            <h3>${name}</h3>
            
            <div class="texto-view-mode" id="view-${name}">
                <div class="texto-actions-row">
                    <button class="btn btn-secondary" onclick="copyDirect('${name}', 'subject', this)">📋 Asunto</button>
                    <button class="btn btn-secondary" onclick="copyDirect('${name}', 'body', this)">📄 Cuerpo</button>
                    <button class="btn btn-primary" style="background-color: var(--text-muted); min-width: 40px; padding: 8px;" onclick="toggleEditTemplate('${name}')" title="Editar">✎</button>
                </div>
            </div>

            <div class="texto-edit-mode" id="edit-${name}" style="display: none; margin-top: 10px; border-top: 1px solid #ddd; padding-top: 10px;">
                <div class="texto-field-group">
                    <label>Asunto:</label>
                    <input type="text" class="template-subject" value="${escapeHTML(data.subject)}" placeholder="Asunto...">
                </div>
                <div class="texto-field-group">
                    <label>Cuerpo:</label>
                    <textarea class="template-body" placeholder="Cuerpo...">${escapeHTML(data.body)}</textarea>
                </div>
                <button class="btn btn-primary" onclick="saveTemplate('${name}')">Guardar ${name}</button>
            </div>
        </div>
    `).join('');

    const panel = document.getElementById('textos-panel');
    panel.style.display = 'flex';

    // Inicializar arrastre si no se ha hecho
    initDraggablePanel(panel, document.getElementById('textos-panel-drag-handle'));
}

window.toggleEditTemplate = function (name) {
    const editDiv = document.getElementById(`edit-${name}`);
    editDiv.style.display = editDiv.style.display === 'none' ? 'block' : 'none';
}

window.copyDirect = function (name, field, btn) {
    const text = emailTemplates[name][field];
    if (!text || text.trim() === "") {
        alert("Esta plantilla está vacía. Pulsa 'Editar' para añadir texto.");
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.textContent;
        btn.textContent = "¡Listo!";
        btn.style.backgroundColor = "#10b981";
        btn.style.color = "white";
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = "";
            btn.style.color = "";
        }, 1500);
    });
}

window.saveTemplate = function (name) {
    const card = document.getElementById(`card-${name}`);
    const subject = card.querySelector('.template-subject').value;
    const body = card.querySelector('.template-body').value;

    emailTemplates[name] = { subject, body };
    localStorage.setItem('laser_text_templates', JSON.stringify(emailTemplates));
    if (typeof db !== 'undefined') db.ref('textTemplates').set(emailTemplates);

    // Ocultar edición
    toggleEditTemplate(name);
    // No mostramos alert para no interrumpir el flujo si está copiando varios
}

window.closeTextosModal = function () {
    document.getElementById('textos-panel').style.display = 'none';
}

/**
 * Lógica para hacer el panel arrastrable
 */
function initDraggablePanel(panel, handle) {
    if (panel.dataset.draggableInitialized) return;

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // Obtener posición del ratón al inicio
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // Calcular nueva posición
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        // Establecer nueva posición del panel
        let newTop = panel.offsetTop - pos2;
        let newLeft = panel.offsetLeft - pos1;

        // Límites de la pantalla
        if (newTop < 0) newTop = 0;
        if (newLeft < 0) newLeft = 0;
        if (newTop + panel.offsetHeight > window.innerHeight) newTop = window.innerHeight - panel.offsetHeight;
        if (newLeft + panel.offsetWidth > window.innerWidth) newLeft = window.innerWidth - panel.offsetWidth;

        panel.style.top = newTop + "px";
        panel.style.left = newLeft + "px";
        panel.style.bottom = "auto";
        panel.style.right = "auto";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }

    panel.dataset.draggableInitialized = "true";
}

/**
 * PANEL DE AUDITORÍA: Permite ver cómo el sistema está puntuando cada factor
 */
window.showAlgorithmAudit = function () {
    // 1. Recopilar datos de éxito (lo mismo que hace calculateLaserScore)
    const scoredClients = clients.filter(c => {
        const inhabs = parseInt(String(c.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
        return inhabs !== 1000000 && c.history && c.history.some(entry => (parseFloat(entry.amount) || 0) > 0);
    });

    if (scoredClients.length === 0) {
        alert("No hay suficientes datos de facturación para auditar el algoritmo.");
        return;
    }

    // --- RANGOS ---
    const ranges = {
        '<100': { total: 0, count: 0 },
        '100-499': { total: 0, count: 0 },
        '500-1.999': { total: 0, count: 0 },
        '2.000-4.999': { total: 0, count: 0 },
        '5.000-9.999': { total: 0, count: 0 },
        '10.000-19.999': { total: 0, count: 0 },
        '20.000-49.999': { total: 0, count: 0 },
        '50.000-99.999': { total: 0, count: 0 },
        '100.000-499.999': { total: 0, count: 0 },
        '500.000+': { total: 0, count: 0 }
    };

    const getRangeKey = (h) => {
        const cleanH = parseInt(String(h).replace(/[^\d]/g, '')) || 0;
        if (cleanH >= 500000) return '500.000+';
        if (cleanH >= 100000) return '100.000-499.999';
        if (cleanH >= 50000) return '50.000-99.999';
        if (cleanH >= 20000) return '20.000-49.999';
        if (cleanH >= 10000) return '10.000-19.999';
        if (cleanH >= 5000) return '5.000-9.999';
        if (cleanH >= 2000) return '2.000-4.999';
        if (cleanH >= 500) return '500-1.999';
        if (cleanH >= 100) return '100-499';
        return '<100';
    };

    scoredClients.forEach(c => {
        const inhabs = parseInt(String(c.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
        const total = c.history.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
        const key = getRangeKey(inhabs);
        ranges[key].total += total;
        ranges[key].count++;
    });

    const averages = Object.entries(ranges).map(([key, data]) => ({ key, avg: data.count > 0 ? data.total / data.count : 0 }));
    const maxAvg = Math.max(...averages.map(a => a.avg));

    // --- REFERENCIA (Éxitos Reales + Interesados Virtuales) ---
    const referenceData = clients.filter(c => {
        const inhabs = parseInt(String(c.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
        const hasMoney = c.history && c.history.some(e => (parseFloat(e.amount) || 0) > 0);
        return inhabs !== 1000000 && (hasMoney || c.status === 'interesado');
    }).map(c => {
        const inhabs = parseInt(String(c.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
        const rKey = getRangeKey(inhabs);
        const realAmount = c.history ? c.history.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0) : 0;

        // Si no tiene dinero real pero es interesado, le asignamos la media de su rango
        const virtualAmount = realAmount > 0 ? realAmount : (ranges[rKey].total / (ranges[rKey].count || 1));

        return {
            distance: parseFloat(c.distance) || 0,
            province: c.province,
            amount: virtualAmount
        };
    });

    // --- PROVINCIAS ---
    const provStats = {};
    referenceData.forEach(d => {
        if (!d.province) return;
        provStats[d.province] = (provStats[d.province] || 0) + d.amount;
    });
    const provList = Object.entries(provStats);
    const maxProvBill = Math.max(...provList.map(p => p[1]) || [0]);

    // --- DISTANCIAS ---
    const distances = referenceData.map(d => d.distance).filter(d => d > 0);
    const minDist = distances.length > 0 ? Math.min(...distances) : 0;
    const maxDist = distances.length > 0 ? Math.max(...distances) : 0;

    // --- RENDERIZAR HTML ---
    let html = `
        <div class="modal" id="audit-modal" style="display:block;">
            <div class="modal-content" style="max-width: 800px;">
                <span class="close-modal" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2 style="margin-bottom: 20px;">🔍 Auditoría del Algoritmo VIP</h2>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <!-- Tabla Habitantes -->
                    <div>
                        <h4 style="color: var(--primary-color);">Potencial Económico (Máx 40 pts)</h4>
                        <table style="font-size: 0.7rem; margin-top:10px; width:100%;">
                            <thead><tr><th>Rango</th><th>Media Fact.</th><th>Puntos</th></tr></thead>
                            <tbody>
                                ${Object.entries(ranges).map(([key, data]) => {
        const avg = data.count > 0 ? data.total / data.count : 0;
        const pts = maxAvg > 0 ? (avg / maxAvg) * 40 : 0;
        return `<tr><td>${key}</td><td>${Math.round(avg)}€</td><td style="font-weight:bold; color:${pts > 20 ? '#16a34a' : '#475569'}">${Math.round(pts)}/40</td></tr>`;
    }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Tabla Provincias -->
                    <div>
                        <h4 style="color: var(--primary-color);">Bonus Provincia (Máx 10 pts)</h4>
                        <table style="font-size: 0.7rem; margin-top:10px; width:100%;">
                            <thead><tr><th>Provincia</th><th>Total Fact.</th><th>Puntos</th></tr></thead>
                            <tbody>
                                ${provList.sort((a, b) => b[1] - a[1]).map(([name, total]) => {
        const pts = maxProvBill > 0 ? (total / maxProvBill) * 10 : 0;
        return `<tr><td>${name}</td><td>${Math.round(total)}€</td><td style="font-weight:bold; color:#16a34a">${Math.round(pts)}/10</td></tr>`;
    }).join('')}
                            </tbody>
                        </table>

                        <h4 style="color: var(--primary-color); margin-top:20px;">Logística (Máx 30 pts)</h4>
                        <p style="font-size: 0.8rem; margin-top:10px;">
                            Escala de 30 a 0 puntos basada en:<br>
                            Mínima distancia facturada: <b>${minDist} km</b> (30 pts)<br>
                            Máxima distancia facturada: <b>${maxDist} km</b> (0 pts)
                        </p>
                    </div>
                </div>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <h4 style="color: var(--primary-color);">📅 Oportunidades de Timing Hoy (Máx 20 pts)</h4>
                    <p style="font-size: 0.75rem; color: #64748b; margin-bottom: 10px;">
                        Solo se muestran los grupos (Provincia + Rango) que tienen una ventana activa hoy.
                    </p>
                    <div style="max-height: 250px; overflow-y: auto;">
                        <table style="font-size: 0.7rem; width:100%;">
                            <thead><tr><th>Provincia</th><th>Rango Hab.</th><th>Fechas Clave</th><th>Puntos Hoy</th></tr></thead>
                            <tbody>
                                ${(() => {
            const combinations = {};
            // 1. Agrupar todas las fechas por Provincia + Rango (INCLUYE PAGADORES E INTERESADOS)
            clients.forEach(c => {
                if (!c.province) return;

                // Extraer fechas de seguimiento limpias
                const datesToProcess = [c.proximo1, c.proximo2, c.proximo3].filter(d => d);
                if (datesToProcess.length === 0) return;

                const inhabs = parseInt(String(c.inhabitants || '0').replace(/[^\d]/g, '')) || 0;
                const rKey = getRangeKey(inhabs);

                const hasMoney = c.history && c.history.some(e => (parseFloat(e.amount) || 0) > 0);
                const isInterested = String(c.status).toLowerCase() === 'interesado';

                // IMPORTANTE: Incluir si tiene dinero O si es interesado
                if (!(hasMoney || isInterested)) return;

                const combKey = `${c.province}|${rKey}`;
                if (!combinations[combKey]) combinations[combKey] = [];

                datesToProcess.forEach(dStr => {
                    // Asegurar formato YYYY-MM-DD para el constructor de Date
                    const d = new Date(formatDateForInput(dStr));
                    if (!isNaN(d.getTime())) {
                        combinations[combKey].push(d);
                    }
                });
            });

            const rows = [];
            const today = new Date();
            const nowMonthDay = today.getMonth() * 100 + today.getDate();

            Object.entries(combinations).forEach(([combKey, dates]) => {
                const [province, range] = combKey.split('|');

                // Calcular puntos hoy para esta combinación (LÓGICA IDÉNTICA A VIP)
                let totalPredictiveScore = 0;
                const now = new Date();
                now.setHours(0, 0, 0, 0);

                dates.forEach(d => {
                    // Crear fecha de comparación para este año
                    let compareDate = new Date(now.getFullYear(), d.getMonth(), d.getDate());

                    // Calcular distancia absoluta
                    let diffMs = Math.abs(now - compareDate);
                    let diffDays = diffMs / (1000 * 60 * 60 * 24);

                    // Distancia cíclica
                    if (diffDays > 182) {
                        diffDays = 365 - diffDays;
                    }

                    // Puntuación escalada
                    if (diffDays <= 2) {
                        totalPredictiveScore += 20;
                    } else if (diffDays <= 15) {
                        const points = 20 - ((diffDays - 2) * (15 / 13));
                        totalPredictiveScore += Math.max(5, points);
                    }
                });

                const maxPts = Math.min(20, totalPredictiveScore);

                // SOLO mostrar si hay puntos hoy
                if (maxPts > 0) {
                    // Filtrar para mostrar SOLO las fechas que están aportando puntos hoy (diffDays <= 15)
                    const activeDates = dates.filter(d => {
                        let compareDate = new Date(now.getFullYear(), d.getMonth(), d.getDate());
                        let diffMs = Math.abs(now - compareDate);
                        let diffDays = diffMs / (1000 * 60 * 60 * 24);
                        if (diffDays > 182) diffDays = 365 - diffDays;
                        return diffDays <= 15;
                    });

                    const dateStrings = [...new Set(activeDates.map(d =>
                        d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                    ))].join(', ');

                    rows.push(`
                                                <tr>
                                                    <td style="font-weight:bold;">${province}</td>
                                                    <td>${range}</td>
                                                    <td style="color: #dc2626; font-weight: 500;">🔥 ${dateStrings}</td>
                                                    <td style="font-weight:bold; color:${maxPts >= 18 ? '#16a34a' : (maxPts >= 5 ? '#ca8a04' : '#475569')}">${Math.round(maxPts)}/20</td>
                                                </tr>
                                            `);
                }
            });

            return rows.length > 0 ? rows.join('') : '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">No se han detectado ventanas de oportunidad para el día de hoy.</td></tr>';
        })()}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #64748b;">
                    * El factor <b>Timing</b> (20 pts) analiza cuándo sueles tener seguimientos en cada provincia y rango para avisarte del momento ideal de llamada.
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
}
