const { createClient } = supabase;
        
// ==========================================
// ⚠️ CREDENCIALES DE SUPABASE
const SUPABASE_URL = 'https://qsqnwktlujhtsapzfgjv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AvtIIl9-Umlkb6URHmF4lw_0JC53Vm6';
// ==========================================

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- SISTEMA DE TRADUCCIÓN ---
const i18n = {
    es: {
        login_subtitle: "Acceso Restringido", email: "Correo Electrónico", password: "Contraseña", btn_login: "Iniciar Sesión",
        pos_terminal: "Terminal POS", all_furniture: "Todos los Muebles", view_order: "Ver Orden", current_ticket: "Ticket Actual",
        subtotal: "Subtotal", discount: "Descuento global", total_pay: "Total a Pagar", btn_checkout: "Siguiente Paso",
        settings: "Configuración", language: "Idioma", theme: "Tema Visual", text_size: "Tamaño del Texto", logout: "Cerrar Sesión",
        finish_sale: "Finalizar Venta", client_data: "1. Datos del Cliente", name: "Nombre / Razón Social", document: "Documento",
        rut: "RUT", logistics: "2. Logística y Pago", pay_method: "Medio de Pago", channel: "Canal Origen", delivery: "Entrega",
        pickup: "Retiro en Taller", shipping: "Despacho Domicilio", shipping_cost: "Flete ($)", notes: "Notas de Producción",
        total_register: "Total a Registrar", btn_confirm: "Confirmar Transacción", empty_cart: "Orden en blanco"
    },
    en: {
        login_subtitle: "Restricted Access", email: "Email Address", password: "Password", btn_login: "Sign In",
        pos_terminal: "POS Terminal", all_furniture: "All Furniture", view_order: "View Order", current_ticket: "Current Ticket",
        subtotal: "Subtotal", discount: "Global Discount", total_pay: "Total to Pay", btn_checkout: "Next Step",
        settings: "Settings", language: "Language", theme: "Visual Theme", text_size: "Text Size", logout: "Log Out",
        finish_sale: "Complete Sale", client_data: "1. Client Details", name: "Full Name / Company", document: "Document",
        rut: "Tax ID", logistics: "2. Logistics & Payment", pay_method: "Payment Method", channel: "Source Channel", delivery: "Fulfillment",
        pickup: "Workshop Pickup", shipping: "Home Delivery", shipping_cost: "Shipping ($)", notes: "Production Notes",
        total_register: "Total to Register", btn_confirm: "Confirm Transaction", empty_cart: "Empty Order"
    }
};

window.changeLanguage = function(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang][key]) el.innerText = i18n[lang][key];
    });
    updateCartUI();
};

// --- SISTEMA DE CONFIGURACIÓN (TEMA Y TEXTO) ---
window.toggleSettings = function() {
    document.getElementById('settingsModal').classList.toggle('hidden');
};

window.setTheme = function(mode) {
    const html = document.documentElement;
    const btnLight = document.getElementById('btn_light');
    const btnDark = document.getElementById('btn_dark');

    if(mode === 'dark') {
        html.classList.add('dark');
        btnDark.classList.add('bg-white', 'dark:bg-neutral-800', 'shadow', 'text-gray-900', 'dark:text-white');
        btnDark.classList.remove('text-gray-700', 'dark:text-gray-400');
        
        btnLight.classList.remove('bg-white', 'shadow', 'text-gray-900', 'dark:text-white');
        btnLight.classList.add('text-gray-700', 'dark:text-gray-400');
    } else {
        html.classList.remove('dark');
        btnLight.classList.add('bg-white', 'shadow', 'text-gray-900', 'dark:text-white');
        btnLight.classList.remove('text-gray-700', 'dark:text-gray-400');
        
        btnDark.classList.remove('bg-white', 'dark:bg-neutral-800', 'shadow', 'text-gray-900', 'dark:text-white');
        btnDark.classList.add('text-gray-700', 'dark:text-gray-400');
    }
};

window.changeTextSize = function(val) {
    document.body.style.fontSize = val + 'px';
    document.getElementById('textSizeDisplay').innerText = val;
};

// --- SISTEMA DE AUTENTICACIÓN ---
let isAppInitialized = false;

function handleSessionUpdate(session) {
    if (session) {
        document.getElementById('loginScreen').classList.add('hidden');
        const app = document.getElementById('mainApp');
        app.classList.remove('hidden');
        setTimeout(() => app.classList.remove('opacity-0'), 50);
        
        if (!isAppInitialized) {
            initPOS();
            isAppInitialized = true;
        }
    } else {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden', 'opacity-0');
    }
}

supabaseClient.auth.getSession().then(({ data: { session } }) => {
    handleSessionUpdate(session);
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    handleSessionUpdate(session);
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnLogin');
    const err = document.getElementById('loginError');
    btn.disabled = true; btn.innerText = "..."; err.classList.add('hidden');
    
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: document.getElementById('auth_email').value,
        password: document.getElementById('auth_pass').value,
    });

    if (error) { err.innerText = "Credenciales incorrectas"; err.classList.remove('hidden'); }
    btn.disabled = false; btn.innerText = i18n[document.getElementById('langSelect').value].btn_login;
});

window.logout = async function() {
    await supabaseClient.auth.signOut();
    document.getElementById('settingsModal').classList.add('hidden');
};

// --- LÓGICA POS ---
let appData = { products: [], categories: [], channels: [], payments: [] };
let activeCategoryId = 'all';
let cart = [];

async function initPOS() {
    document.getElementById('current_date').innerText = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    try {
        const [cats, prods, chans, pays] = await Promise.all([
            supabaseClient.from('product_categories').select('*').order('name'),
            supabaseClient.from('products').select('*').eq('is_active', true),
            supabaseClient.from('sales_channels').select('*'),
            supabaseClient.from('payment_methods').select('*')
        ]);
        appData.categories = cats.data || []; appData.products = prods.data || [];
        appData.channels = chans.data || []; appData.payments = pays.data || [];
        renderFilters(); renderProducts(); populateSelects();
    } catch (err) { console.error(err); }
}

function renderFilters() {
    const m = document.getElementById('mobile_category_filters'), d = document.getElementById('desktop_category_filters');
    let dHtml = `<button onclick="filterCategory('all')" class="w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-between ${activeCategoryId === 'all' ? 'bg-yellow-500 text-black' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-950'}"><span data-i18n="all_furniture">${i18n[document.getElementById('langSelect').value].all_furniture}</span></button>`;
    let mHtml = `<button onclick="filterCategory('all')" class="px-5 py-2.5 rounded-full text-sm font-bold transition border ${activeCategoryId === 'all' ? 'bg-yellow-500 border-yellow-500 text-black' : 'bg-gray-100 border-gray-200 dark:bg-neutral-950 dark:border-neutral-700 text-gray-500'}">All</button>`;
    
    appData.categories.forEach(c => {
        const act = activeCategoryId === c.id;
        dHtml += `<button onclick="filterCategory('${c.id}')" class="w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-between ${act ? 'bg-yellow-500 text-black' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-950'}"><span>${c.name}</span></button>`;
        mHtml += `<button onclick="filterCategory('${c.id}')" class="px-5 py-2.5 rounded-full text-sm font-bold transition border ${act ? 'bg-yellow-500 border-yellow-500 text-black' : 'bg-gray-100 border-gray-200 dark:bg-neutral-950 dark:border-neutral-700 text-gray-500'}">${c.name}</button>`;
    });
    d.innerHTML = dHtml; m.innerHTML = mHtml;
}

window.filterCategory = function(catId) {
    activeCategoryId = catId;
    const t = document.getElementById('current_category_title');
    t.innerText = catId === 'all' ? i18n[document.getElementById('langSelect').value].all_furniture : appData.categories.find(c => c.id == catId)?.name || '';
    renderFilters(); renderProducts();
};

function renderProducts() {
    const c = document.getElementById('products_grid');
    const data = activeCategoryId === 'all' ? appData.products : appData.products.filter(p => p.category_id == activeCategoryId);
    c.innerHTML = data.map(p => `
        <div onclick="addToCart('${p.id}')" class="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-200 dark:border-neutral-800 cursor-pointer hover:border-yellow-500 dark:hover:border-yellow-500 hover:shadow-lg active:scale-95 transition flex flex-col justify-between min-h-[130px]">
            <h3 class="font-bold text-gray-900 dark:text-gray-200 leading-tight text-base sm:text-lg">${p.name}</h3>
            <div class="mt-3"><p class="text-xs text-gray-500 bg-gray-50 dark:bg-neutral-950 inline-block px-2.5 py-1 rounded border border-gray-200 dark:border-neutral-700">${p.base_material}</p></div>
        </div>`).join('');
}

window.addToCart = function(id) {
    const p = appData.products.find(x => x.id == id);
    const ex = cart.find(x => x.product.id == id);
    if (ex) { ex.qty += 1; } else {
        const pr = prompt(`Precio para / Price for:\n${p.name}`, "0");
        if(!pr || isNaN(pr)) return;
        cart.push({ product: p, qty: 1, unit_price: parseFloat(pr) });
    }
    updateCartUI();
};

window.updateQty = function(i, d) { cart[i].qty += d; if (cart[i].qty <= 0) cart.splice(i, 1); updateCartUI(); };

window.updateCartUI = function() {
    const c = document.getElementById('cart_items');
    const lang = document.getElementById('langSelect').value;
    let sub = 0;
    
    document.getElementById('mob_cart_badge').innerText = cart.reduce((s, x) => s + x.qty, 0);

    if (cart.length === 0) {
        c.innerHTML = `<div class="text-center text-gray-400 mt-20"><p class="font-medium">${i18n[lang].empty_cart}</p></div>`;
        document.getElementById('summary_subtotal').innerText = '$0';
        document.getElementById('summary_total').innerText = '$0';
        document.getElementById('mob_cart_total').innerText = '$0';
        document.getElementById('btnOpenCheckout').disabled = true; return;
    }

    document.getElementById('btnOpenCheckout').disabled = false;
    c.innerHTML = cart.map((item, i) => {
        const lt = item.qty * item.unit_price; sub += lt;
        return `
        <div class="bg-white dark:bg-neutral-950 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 flex justify-between items-center">
            <div class="flex-1 pr-2"><p class="font-bold text-sm text-gray-900 dark:text-gray-200 line-clamp-1">${item.product.name}</p><p class="text-xs text-gray-500 mt-1">$${item.unit_price} c/u</p></div>
            <div class="flex flex-col items-end gap-2"><p class="font-bold text-yellow-600 dark:text-yellow-500 text-base">$${lt}</p>
                <div class="flex items-center bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-700 h-10">
                    <button onclick="updateQty(${i}, -1)" class="px-4 h-full text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-l-lg text-lg">-</button>
                    <span class="px-3 text-sm font-bold dark:text-white">${item.qty}</span>
                    <button onclick="updateQty(${i}, 1)" class="px-4 h-full text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-r-lg text-lg">+</button>
                </div>
            </div>
        </div>`;
    }).join('');

    const final = sub - (parseFloat(document.getElementById('global_discount').value) || 0);
    document.getElementById('summary_subtotal').innerText = `$${sub}`;
    document.getElementById('summary_total').innerText = `$${final}`;
    document.getElementById('mob_cart_total').innerText = `$${final}`;
};

window.toggleMobileCart = () => { document.getElementById('cartPanel').classList.toggle('translate-x-full'); document.getElementById('cartBackdrop').classList.toggle('hidden'); };

function populateSelects() {
    document.getElementById('sales_channel').innerHTML = appData.channels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('payment_method').innerHTML = appData.payments.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

window.toggleShipping = () => {
    const method = document.getElementById('fulfillment_method').value;
    const input = document.getElementById('shipping_cost');
    input.disabled = (method !== 'delivery');
    if(input.disabled) input.value = 0; else input.focus();
    updateModalTotal();
};

window.updateModalTotal = function() {
    let sub = cart.reduce((a, b) => a + (b.qty * b.unit_price), 0);
    let disc = parseFloat(document.getElementById('global_discount').value) || 0;
    let ship = parseFloat(document.getElementById('shipping_cost').value) || 0;
    document.getElementById('modal_final_total').innerText = `$${(sub + ship) - disc}`;
};

document.getElementById('shipping_cost').addEventListener('input', updateModalTotal);
document.getElementById('btnOpenCheckout').addEventListener('click', () => { updateModalTotal(); document.getElementById('checkoutModal').classList.remove('hidden'); });

document.getElementById('btnCloseCheckout').addEventListener('click', () => { 
    document.getElementById('checkoutModal').classList.add('hidden'); 
    
    if (document.getElementById('btnConfirmSale').disabled) {
        cart = []; 
        document.getElementById('global_discount').value = 0; 
        document.getElementById('shipping_cost').value = 0;
        document.getElementById('checkoutForm').reset(); 
        
        const btnConfirm = document.getElementById('btnConfirmSale');
        btnConfirm.disabled = false;
        btnConfirm.innerText = i18n[document.getElementById('langSelect').value].btn_confirm;
        btnConfirm.classList.replace('bg-blue-600', 'bg-green-600');
        document.getElementById('btnPrint').classList.add('hidden');
        
        updateCartUI();
        if(!document.getElementById('cartPanel').classList.contains('translate-x-full')) toggleMobileCart();
    }
});

const generateFolio = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const randomHex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
    return `SF${year}-${randomHex}`;
};

function preparePrintData(folio, name, total) {
    document.getElementById('p_folio').innerText = folio;
    document.getElementById('p_date').innerText = new Date().toLocaleDateString('es-CL');
    document.getElementById('p_client').innerText = name || 'Cliente General';
    
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    document.getElementById('p_neto').innerText = `$${neto}`;
    document.getElementById('p_iva').innerText = `$${iva}`;
    document.getElementById('p_total').innerText = `$${total}`;
    
    document.getElementById('p_items').innerHTML = cart.map(i => {
        const itemTotal = i.qty * i.unit_price;
        const itemNeto = Math.round(itemTotal / 1.19);
        return `
        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span>${i.qty}x ${i.product.name}</span> 
            <span>$${itemNeto}</span>
        </div>
        `;
    }).join('');
    
    document.getElementById('btnPrint').classList.remove('hidden');
    const btnConfirm = document.getElementById('btnConfirmSale');
    btnConfirm.innerText = "¡Venta Registrada!";
    btnConfirm.classList.replace('bg-green-600', 'bg-blue-600');
    btnConfirm.disabled = true;
}

document.getElementById('btnConfirmSale').addEventListener('click', async () => {
    const form = document.getElementById('checkoutForm');
    if(!form.checkValidity()) { form.reportValidity(); return; }
    const btn = document.getElementById('btnConfirmSale'); 
    btn.disabled = true; 
    btn.innerText = 'Registrando...';

    try {
        const sub = cart.reduce((a, b) => a + (b.qty * b.unit_price), 0);
        const disc = parseFloat(document.getElementById('global_discount').value) || 0;
        const ship = parseFloat(document.getElementById('shipping_cost').value) || 0;
        const final = (sub + ship) - disc;

        const nuevoFolio = generateFolio();

        const cust = { 
            name: document.getElementById('customer_name').value, 
            email: document.getElementById('customer_email').value, 
            rut: document.getElementById('customer_rut').value, 
            notes: document.getElementById('order_notes').value 
        };

        // CAPTURAMOS LOS NOMBRES EN TEXTO PARA EL PDF
        const paySelect = document.getElementById('payment_method');
        const payName = paySelect.options[paySelect.selectedIndex].text;
        
        const fullSelect = document.getElementById('fulfillment_method');
        const fullName = fullSelect.options[fullSelect.selectedIndex].text;
        
        const payload = {
            folio: nuevoFolio,
            business_date: new Date().toISOString().split('T')[0], 
            customer_info: cust, 
            document_type: document.getElementById('doc_type').value,
            sales_channel_id: document.getElementById('sales_channel').value, 
            payment_method_id: document.getElementById('payment_method').value,
            total_amount: final, 
            delivery_status: 'pendiente', 
            fulfillment_method: document.getElementById('fulfillment_method').value,
            shipping_cost: ship, 
            total_discount: disc, 
            raw_payload: { 
                cart, 
                financials: {sub, disc, ship, final},
                payment_name: payName,       // <-- Enviamos el nombre
                fulfillment_name: fullName   // <-- Enviamos el nombre
            }
        };

        const { data, error } = await supabaseClient.from('orders').insert([payload]).select('id').single();
        if (error) throw error;

        const items = cart.map(i => ({
            order_id: data.id, product_id: i.product.id, product_name_snapshot: i.product.name,
            quantity: i.qty, unit_price: i.unit_price, line_total_amount: i.qty * i.unit_price, unit_discount: 0 
        }));
        const { error: itemsErr } = await supabaseClient.from('order_items').insert(items);
        if (itemsErr) throw itemsErr;

        preparePrintData(nuevoFolio, cust.name, final);

    } catch (e) { 
        alert('Error: ' + e.message); 
        btn.disabled = false; 
        btn.innerText = i18n[document.getElementById('langSelect').value].btn_confirm; 
    }
});

// ==========================================
// 📊 DASHBOARD & HISTORIAL (DATA ENGINEERING)
// ==========================================
let globalOrderHistory = [];
let chartInstance = null;

// Lógica de Navegación de Vistas
window.switchView = function(view) {
    const vPos = document.getElementById('view_pos');
    const vDash = document.getElementById('view_dashboard');
    const panelCart = document.getElementById('cartPanel');
    
    // Botones PC
    const btnPos = document.getElementById('nav_pos');
    const btnDash = document.getElementById('nav_dash');

    if (view === 'pos') {
        vPos.classList.remove('hidden');
        vDash.classList.add('hidden');
        panelCart.classList.remove('lg:hidden'); // Mostrar carrito en PC
        
        if(btnPos) {
            btnPos.classList.add('bg-yellow-500', 'text-black');
            btnPos.classList.remove('text-gray-500');
            btnDash.classList.remove('bg-yellow-500', 'text-black');
            btnDash.classList.add('text-gray-500');
        }
    } else if (view === 'dashboard') {
        vPos.classList.add('hidden');
        vDash.classList.remove('hidden');
        panelCart.classList.add('lg:hidden'); // Ocultar carrito en PC para expandir Dashboard
        
        if(btnPos) {
            btnDash.classList.add('bg-yellow-500', 'text-black');
            btnDash.classList.remove('text-gray-500');
            btnPos.classList.remove('bg-yellow-500', 'text-black');
            btnPos.classList.add('text-gray-500');
        }
        
        // Ponemos la fecha de hoy por defecto al entrar
        if(!document.getElementById('dash_filter_date').value) {
            document.getElementById('dash_filter_date').value = new Date().toISOString().split('T')[0];
        }
        
        loadDashboardData();
    }
};

// Carga principal de Datos
window.loadDashboardData = async function() {
    const listContainer = document.getElementById('history_list');
    const dateFilter = document.getElementById('dash_filter_date').value;
    
    listContainer.innerHTML = '<p class="text-gray-500 text-center py-10 animate-pulse">Analizando base de datos...</p>';

    // 1. Ejecutamos la Query a Supabase
    let query = supabaseClient
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    // Si hay filtro de fecha, lo aplicamos a nivel base de datos
    if (dateFilter) {
        query = query.eq('business_date', dateFilter);
    }

    const { data, error } = await query.limit(100);

    if (error) {
        listContainer.innerHTML = `<p class="text-red-500 text-sm">Error de conexión: ${error.message}</p>`;
        return;
    }

    globalOrderHistory = data || [];

    // 2. Calcular KPIs (Indicadores)
    const totalRevenue = data.reduce((sum, order) => sum + order.total_amount, 0);
    const totalOrders = data.length;
    const avgTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    document.getElementById('kpi_revenue').innerText = `$${totalRevenue.toLocaleString('es-CL')}`;
    document.getElementById('kpi_orders').innerText = totalOrders;
    document.getElementById('kpi_avg').innerText = `$${avgTicket.toLocaleString('es-CL')}`;

    // 3. Renderizar Tabla/Lista
    if (data.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 text-center py-10">No hay transacciones en este periodo.</p>';
    } else {
        listContainer.innerHTML = data.map(order => {
            // Formatear la fecha y hora exacta
            const exactTime = new Date(order.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
            const pMethod = order.raw_payload && order.raw_payload.payment_name ? order.raw_payload.payment_name : 'N/A';
            
            return `
            <div class="bg-gray-50 dark:bg-neutral-950 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-yellow-500 transition">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-black bg-yellow-500 text-black px-2 py-0.5 rounded">${order.folio}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">${exactTime}</span>
                    </div>
                    <h4 class="font-bold text-gray-900 dark:text-white">${order.customer_info.name || 'Cliente sin nombre'}</h4>
                    <p class="text-xs text-gray-500 uppercase">${pMethod} • ${order.fulfillment_method}</p>
                </div>
                <div class="text-left sm:text-right w-full sm:w-auto border-t sm:border-none border-gray-200 dark:border-neutral-800 pt-3 sm:pt-0">
                    <p class="text-lg font-black text-yellow-600 dark:text-yellow-500">$${order.total_amount.toLocaleString('es-CL')}</p>
                    <button onclick="reprintHistoricalOrder('${order.id}')" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline mt-1">🖨️ Reimprimir Boleta</button>
                </div>
            </div>`;
        }).join('');
    }

    // 4. Actualizar Gráfico
    renderChart(data);
};

// MOTOR DE REIMPRESIÓN EXACTA
window.reprintHistoricalOrder = function(orderId) {
    const order = globalOrderHistory.find(o => o.id === orderId);
    if (!order) return;

    // Recuperar el carrito encapsulado en la base de datos
    const historicalCart = order.raw_payload && order.raw_payload.cart ? order.raw_payload.cart : [];
    const total = order.total_amount;
    
    // Cálculos de IVA idénticos al checkout
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    // Inyectar datos en la plantilla de impresión
    document.getElementById('p_folio').innerText = order.folio;
    // CRÍTICO: La boleta debe mostrar la fecha/hora en la que OCURRIÓ la venta, no la actual
    document.getElementById('p_date').innerText = new Date(order.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
    document.getElementById('p_client').innerText = order.customer_info.name || 'Cliente General';
    
    document.getElementById('p_neto').innerText = `$${neto}`;
    document.getElementById('p_iva').innerText = `$${iva}`;
    document.getElementById('p_total').innerText = `$${total}`;

    document.getElementById('p_items').innerHTML = historicalCart.map(i => {
        const itemTotal = i.qty * i.unit_price;
        const itemNeto = Math.round(itemTotal / 1.19);
        return `
        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span>${i.qty}x ${i.product.name}</span> 
            <span>$${itemNeto}</span>
        </div>`;
    }).join('');

    // Forzar la impresión a través del navegador
    setTimeout(() => {
        window.print();
    }, 300); // Pequeño retraso para asegurar que el DOM se actualizó
};

// RENDERIZADO DEL GRÁFICO (Chart.js)
function renderChart(data) {
    const ctx = document.getElementById('revenueChart');
    if(!ctx) return;

    // Destruir gráfico anterior si existe para evitar superposición
    if(chartInstance) chartInstance.destroy();

    // Lógica Data Analyst: Agrupar ventas por día
    const salesByDate = {};
    data.forEach(order => {
        const date = order.business_date;
        salesByDate[date] = (salesByDate[date] || 0) + order.total_amount;
    });

    const labels = Object.keys(salesByDate).sort(); // Orden cronológico
    const chartData = labels.map(date => salesByDate[date]);

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(l => l.slice(-5)), // Mostrar solo mes/día "04-18"
            datasets: [{
                label: 'Ingresos Netos ($)',
                data: chartData,
                backgroundColor: '#EAB308', // yellow-500 de Tailwind
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' } },
                x: { grid: { display: false } }
            }
        }
    });
}