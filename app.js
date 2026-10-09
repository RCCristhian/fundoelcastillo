// Variables Globales
let moneda = localStorage.getItem("agro_moneda") || "S/.";
let currentView = "dashboard";

// Conexión Directa Automática a Supabase Cloud - Fundo El Castillo
const SUPABASE_URL = "https://myybakusxjpkvbrrcvmy.supabase.co";
const SUPABASE_KEY = "sb_publishable_m7m0tA0rjzV9lte44czjOA_Sp_G9fG2";
let supabaseClient = null;

function initSupabaseClient() {
  if (window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      return true;
    } catch (e) {
      console.error("Error al conectar Supabase:", e);
    }
  }
  return false;
}

// Estado de Campaña seleccionada
let campanaActiva = localStorage.getItem("fundo_campana_activa") || "2026";

// Cache de datos
let globalData = {
  campanas: [],
  variedades: [],
  parcelas: [],
  productos: [],
  trabajadores: [],
  ventas: [],
  gastosEspecificos: [],
  gastosGenerales: [],
  jornales: [],
  tratamientos: [],
  compras: [],
  dashboard: null
};

// Instancias de Chart.js
let chartEspeciesInst = null;
let chartGastosInst = null;

// Inicialización al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("monedaSelect").value = moneda;
  actualizarMonedaLabels();
  initFechasHoy();
  initSupabaseClient();
  cargarTodosLosDatos();
});

function toggleMobileMenu(open) {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("mobileOverlay");
  if (!sidebar || !overlay) return;

  if (open) {
    sidebar.classList.remove("-translate-x-full");
    overlay.classList.remove("hidden");
  } else {
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
  }
}

function initFechasHoy() {
  const hoy = new Date().toISOString().split("T")[0];
  ["ventaFecha", "jornalFecha", "trataFecha", "ggFecha", "geFecha", "compraFecha"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = hoy;
  });
}

function cambiarMoneda(nuevaMoneda) {
  moneda = nuevaMoneda;
  localStorage.setItem("agro_moneda", moneda);
  actualizarMonedaLabels();
  cargarTodosLosDatos();
}

function actualizarMonedaLabels() {
  document.querySelectorAll(".monedaLabel").forEach(el => el.textContent = moneda);
}

function formatMoney(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return `${moneda} 0.00`;
  return `${moneda} ${Number(amount).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNum(num, decimals = 1) {
  if (num === null || num === undefined || isNaN(num)) return "-";
  return Number(num).toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ================= NAVEGACIÓN =================
function navigate(viewName) {
  currentView = viewName;
  
  document.querySelectorAll("main > div > section").forEach(sec => sec.classList.add("hidden"));
  
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach(item => {
    if (item.getAttribute("data-view") === viewName) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  const titles = {
    "dashboard": ["Panel General", "Resumen integral de producción y finanzas por cultivo"],
    "resumen-especies": ["Rentabilidad por Especie", "P&L Agrícola: Ingresos vs Costos directos y prorrateados"],
    "ventas": ["Ventas y Cosecha", "Control de cosechas vendidas, acopiadores y cobranzas"],
    "gastos-especificos": ["Gastos Específicos", "Costes directos aplicados a un cultivo particular"],
    "gastos-generales": ["Gastos Generales y Arriendos", "Mantenimiento del campo, arriendos de las 3 Ha y costos comunes"],
    "jornales": ["Jornales y Mano de Obra", "Horas trabajadas por jornalero, cultivo asignado y labores realizadas"],
    "tratamientos": ["Tratamientos y Fitosanitarios", "Aplicaciones de fertilizantes, pesticidas y abonos por variedad"],
    "insumos": ["Almacén de Insumos y Compras", "Inventario valorizado de productos químicos y compras registradas"],
    "parcelas-variedades": ["Gestión de Cultivos y Parcelas", "Distribución de las 3 hectáreas, propietarios y árboles plantados"]
  };

  if (titles[viewName]) {
    document.getElementById("pageTitle").textContent = titles[viewName][0];
    document.getElementById("pageSubtitle").textContent = titles[viewName][1];
  }

  if (viewName === "jornales") {
    cargarMatrizMensualJornales();
  }
}

// Catálogo por defecto de 45 productos fitosanitarios y fertilizantes
const DEFAULT_PRODUCTOS_LIST = [
  'ABONO FOLIAR', 'ABONO ORGANICO', 'ACEITE AGRICOLA (FGA)', 'ACIDO FOLICO', 'ADHERENTE SILICONADO',
  'AKRON', 'ALGAS MARINAS', 'SULFATO DE AMONIO', 'AMINOACIDOS', 'AZUFRE', 'BIOL', 'BORO',
  'CAL OMEX', 'CALCIO BORO ZINC', 'CARBENDAZINA', 'CICLON', 'CITOQUININA', 'JABON POTASICO',
  'EMAMECTIN BENZOATO', 'ACETAMIPRID', 'ENRAIZADOR', 'ERAIZER', 'FOSFATO DIAMONICO', 'FOSFORO',
  'MELAZA', 'METOMIL', 'MICROELEMENTOS', 'NITRATO DE AMONIO', 'OLIGOMIX', 'PERMETRINA',
  'SULFATO DE COBRE', 'SULFATO DE COBRE GRANULADO', 'SULFATO DE POTASIO', 'TIFON', 'YESO AGRICOLA',
  'SANIX', 'ZINC', 'ABONO 20 20 20', 'SILICIO', 'PIRIMETANIL', 'BACILLUS', 'STIMULATE',
  'VIGOR PHOS', 'REGULADOR PH', 'TABACAZO'
];

const DEFAULT_TRABAJADORES = [
  { id: 1, nombre: "Mauro Robles", rol: "Jornalero / Campo", costo_hora_defecto: 10, activo: true },
  { id: 2, nombre: "Kike", rol: "Jornalero / Campo", costo_hora_defecto: 10, activo: true }
];

function getLocalTable(table) {
  try {
    return JSON.parse(localStorage.getItem("fundo_tbl_" + table) || "[]");
  } catch (e) {
    return [];
  }
}

function setLocalTable(table, data) {
  try {
    localStorage.setItem("fundo_tbl_" + table, JSON.stringify(data));
  } catch (e) {}
}

// ================= CAPA DE DATOS HÍBRIDA (SUPABASE / LOCAL REST / STORAGE) =================
async function dataFetch(table, selectQuery = "*", orderCol = "id", ascending = true) {
  // 1. Si Supabase está activo
  if (supabaseClient) {
    try {
      let query = supabaseClient.from(table).select(selectQuery);
      if (orderCol) query = query.order(orderCol, { ascending });
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
          setLocalTable(table, data);
          return { success: true, data };
        } else {
          const localData = getLocalTable(table);
          if (localData.length > 0) {
            return { success: true, data: localData };
          }
        }
      }
    } catch (e) {
      console.warn(`Error en Supabase leyendo ${table}, usando fallback:`, e);
    }
  }

  // 2. Fallback a LocalStorage y catálogos iniciales
  let localData = getLocalTable(table);
  if (table === "productos" && localData.length === 0) {
    localData = DEFAULT_PRODUCTOS_LIST.map((nom, idx) => ({
      id: idx + 1,
      nombre: nom,
      categoria: "Fertilizante / Fitosanitario",
      unidad: "Kg/L",
      stock_anterior: 0,
      stock_actual: 0,
      precio_referencial: 0
    }));
    setLocalTable("productos", localData);
  } else if (table === "trabajadores" && localData.length === 0) {
    localData = [...DEFAULT_TRABAJADORES];
    setLocalTable("trabajadores", localData);
  }

  if (orderCol && localData.length > 0) {
    localData.sort((a, b) => {
      const valA = a[orderCol] ?? "";
      const valB = b[orderCol] ?? "";
      if (valA < valB) return ascending ? -1 : 1;
      if (valA > valB) return ascending ? 1 : -1;
      return 0;
    });
  }

  return { success: true, data: localData };
}

async function dataInsert(table, record) {
  if (!record.id) {
    record.id = Date.now();
  }

  if (supabaseClient) {
    try {
      const { id, ...recordWithoutId } = record;
      const { data, error } = await supabaseClient.from(table).insert([recordWithoutId]).select();
      if (!error && data && data[0]?.id) {
        record.id = data[0].id;
      }
    } catch (e) {
      console.warn(`Supabase insert en ${table} no sincronizado (${e.message}), guardado localmente.`);
    }
  }

  const localList = getLocalTable(table);
  localList.push(record);
  setLocalTable(table, localList);
  return { success: true, id: record.id };
}

async function dataDelete(table, id) {
  if (!confirm("¿Deseas eliminar este registro?")) return false;

  if (supabaseClient) {
    try {
      await supabaseClient.from(table).delete().eq("id", id);
    } catch (e) {
      console.warn(`Supabase delete error en ${table}:`, e);
    }
  }

  const localList = getLocalTable(table);
  const filtered = localList.filter(item => item.id != id);
  setLocalTable(table, filtered);

  mostrarToast("Registro eliminado", "🗑️");
  actualizarDatos();
  return true;
}

async function dataUpdate(table, id, fields) {
  if (supabaseClient) {
    try {
      await supabaseClient.from(table).update(fields).eq("id", id);
    } catch (e) {
      console.warn(`Supabase update error en ${table}:`, e);
    }
  }

  const localList = getLocalTable(table);
  const idx = localList.findIndex(item => item.id == id);
  if (idx !== -1) {
    localList[idx] = { ...localList[idx], ...fields };
    setLocalTable(table, localList);
  }
  return true;
}

// ================= GESTIÓN DE CAMPAÑAS AGRÍCOLAS =================
async function cargarCampanas() {
  const res = await dataFetch("campanas", "*", "anio", false);
  let campanas = [];
  if (res.success && res.data && res.data.length > 0) {
    campanas = res.data;
  } else {
    const fallback = [
      { id: 1, nombre: "Campaña 2026", anio: 2026, activa: true },
      { id: 2, nombre: "Campaña 2025", anio: 2025, activa: false }
    ];
    const custom = JSON.parse(localStorage.getItem("fundo_campanas_custom") || "[]");
    campanas = [...fallback, ...custom];
  }
  // Ordenar por año más reciente primero (ej. 2026, luego 2025...)
  campanas.sort((a, b) => Number(b.anio) - Number(a.anio));
  globalData.campanas = campanas;

  // Asegurar que por defecto siempre esté seleccionada la campaña más reciente (ej. 2026)
  const guardada = localStorage.getItem("fundo_campana_activa");
  if (!guardada || (!campanas.some(c => String(c.anio) === String(guardada)) && guardada !== "todas")) {
    campanaActiva = campanas.length > 0 ? String(campanas[0].anio) : "2026";
    localStorage.setItem("fundo_campana_activa", campanaActiva);
  } else {
    campanaActiva = guardada;
  }

  const select = document.getElementById("selectCampana");
  if (select) {
    select.innerHTML = "";
    campanas.forEach(c => {
      select.innerHTML += `<option value="${c.anio}">${c.activa ? '🌾 ' : ''}${c.nombre}</option>`;
    });
    select.innerHTML += `<option value="todas">📊 Todas las Campañas (Histórico)</option>`;
    select.value = campanaActiva;
  }
}

function cambiarCampana(val) {
  campanaActiva = val;
  localStorage.setItem("fundo_campana_activa", campanaActiva);
  
  // Actualizar fechas por defecto de modales según la campaña
  if (val !== "todas") {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    const fechaCampana = `${val}-${mes}-${dia}`;
    ["ventaFecha", "jornalFecha", "trataFecha", "ggFecha", "geFecha", "compraFecha"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = fechaCampana;
    });
  }

  // Recalcular todo reactivamente para la campaña elegida
  calcularYRenderizarDashboard();
  renderTablaVentas(globalData.ventas.filter(filtroPorCampana));
  renderTablaGastosEspecificos(globalData.gastosEspecificos.filter(filtroPorCampana));
  renderTablaGastosGenerales(globalData.gastosGenerales.filter(filtroPorCampana));
  renderTablaJornales(globalData.jornales.filter(filtroPorCampana));
  renderTablaTratamientos(globalData.tratamientos.filter(filtroPorCampana));
  renderTablaCompras(globalData.compras.filter(filtroPorCampana));
  cargarMatrizMensualJornales();

  const msg = val === "todas" ? "Mostrando Histórico Consolidado" : `Campaña ${val} activada`;
  mostrarToast(msg, "🌾");
}

function abrirModalNuevaCampana() {
  document.getElementById("modalNuevaCampana")?.showModal();
}

async function guardarNuevaCampana(e) {
  e.preventDefault();
  const nombre = document.getElementById("campanaNombre").value.trim();
  const anio = parseInt(document.getElementById("campanaAnio").value);
  const notas = document.getElementById("campanaNotas").value.trim();
  const activa = document.getElementById("campanaActiva").checked;

  const data = { nombre, anio, activa, notas };
  const res = await dataInsert("campanas", data);
  if (!res.success) {
    const custom = JSON.parse(localStorage.getItem("fundo_campanas_custom") || "[]");
    if (!custom.some(c => c.anio === anio)) {
      custom.push({ id: Date.now(), nombre, anio, activa, notas });
      localStorage.setItem("fundo_campanas_custom", JSON.stringify(custom));
    }
  }

  cerrarDialog("modalNuevaCampana");
  document.getElementById("formNuevaCampana").reset();
  await cargarCampanas();
  if (activa) {
    document.getElementById("selectCampana").value = String(anio);
    cambiarCampana(String(anio));
  }
  mostrarToast(`Campaña ${nombre} creada con inventario trasladado`, "🌱");
}

async function borrarCampanaSeleccionada() {
  if (campanaActiva === "todas") {
    alert("No puedes eliminar la vista histórica de 'Todas las Campañas'. Por favor selecciona una campaña específica en el menú.");
    return;
  }

  const anio = parseInt(campanaActiva);
  const campanaObj = (globalData.campanas || []).find(c => Number(c.anio) === anio);
  const nombre = campanaObj ? campanaObj.nombre : `Campaña ${anio}`;
  const id = campanaObj ? campanaObj.id : null;

  await eliminarCampana(id, nombre, anio);
}

async function eliminarCampana(id, nombre, anio) {
  const confirmar = confirm(`¿Estás seguro de que deseas eliminar la "${nombre}"?`);
  if (!confirmar) return;

  if (id) {
    if (supabaseClient) {
      try {
        await supabaseClient.from("campanas").delete().eq("id", id);
      } catch (err) {
        console.error("Error borrando en Supabase:", err);
      }
    } else {
      try {
        await fetch(`/api/campanas/${id}`, { method: "DELETE" });
      } catch (err) {
        console.error("Error borrando en API local:", err);
      }
    }
  }

  // Eliminar de localStorage si existía
  const custom = JSON.parse(localStorage.getItem("fundo_campanas_custom") || "[]");
  const nuevoCustom = custom.filter(c => Number(c.anio) !== Number(anio) && String(c.id) !== String(id));
  localStorage.setItem("fundo_campanas_custom", JSON.stringify(nuevoCustom));

  // Retirar de memoria
  globalData.campanas = (globalData.campanas || []).filter(c => Number(c.anio) !== Number(anio) && String(c.id) !== String(id));

  // Si la campaña borrada era la activa, cambiar a otra disponible
  if (String(campanaActiva) === String(anio)) {
    const restante = globalData.campanas.find(c => Number(c.anio) !== Number(anio));
    campanaActiva = restante ? String(restante.anio) : "todas";
    localStorage.setItem("fundo_campana_activa", campanaActiva);
  }

  await cargarCampanas();
  cambiarCampana(campanaActiva);
  mostrarToast(`Campaña ${nombre} eliminada`, "🗑️");
}

function filtroPorCampana(item) {
  if (campanaActiva === "todas") return true;
  if (!item || !item.fecha) return true;
  return item.fecha.startsWith(String(campanaActiva));
}

// ================= CARGA DE DATOS =================
async function cargarTodosLosDatos() {
  await cargarCampanas();
  await Promise.all([
    cargarVariedades(),
    cargarParcelas(),
    cargarTrabajadores(),
    cargarVentas(),
    cargarGastosEspecificos(),
    cargarGastosGenerales(),
    cargarJornales(),
    cargarTratamientos(),
    cargarCompras()
  ]);

  // Cargar productos y recalcular inventario valorizado después de tener compras y aplicaciones
  await cargarProductos();
  recalcularStockYValorizacion();
  calcularYRenderizarDashboard();
}

async function actualizarDatos() {
  await cargarTodosLosDatos();
  mostrarToast("Datos actualizados", "🔄");
}

// Cargar Tablas
async function cargarVariedades() {
  const res = await dataFetch("variedades", "*", "nombre", true);
  if (!res.success) return;

  // Si aún no se han configurado los árboles reales y la base tenía los 1350 de plantilla de Excel, poner en 0
  const sumaPlantilla = res.data.reduce((a, b) => a + (Number(b.num_arboles) || 0), 0);
  if (sumaPlantilla === 1350 && !localStorage.getItem("fundo_arboles_reales_iniciado")) {
    res.data.forEach(v => { v.num_arboles = 0; });
  }

  // Cargar cantidades guardadas por el usuario si existen
  const customArboles = JSON.parse(localStorage.getItem("fundo_arboles_custom") || "{}");
  res.data.forEach(v => {
    if (customArboles[v.id] !== undefined) {
      v.num_arboles = customArboles[v.id];
    }
  });

  globalData.variedades = res.data;

  const selects = ["ventaVariedadId", "trataVariedadId", "jornalVariedadId", "geVariedadId"];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = "";
    if (id === "jornalVariedadId" || id === "geVariedadId") {
      el.innerHTML += `<option value="">-- General / Todo el Campo --</option>`;
    }
    res.data.forEach(v => {
      const arbStr = v.num_arboles > 0 ? `${v.num_arboles} árb.` : `sin registrar`;
      el.innerHTML += `<option value="${v.id}">${v.nombre} (${v.especie} - ${arbStr})</option>`;
    });
  });

  const tbody = document.getElementById("adminVariedadesBody");
  if (tbody) {
    tbody.innerHTML = "";
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400 italic">No hay cultivos registrados. Agrega tu primer cultivo con el botón "+ Cultivo".</td></tr>`;
    } else {
      res.data.forEach(v => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="py-2 px-3 font-bold text-slate-800">${v.nombre}</td>
          <td class="py-2 px-2 font-semibold text-slate-700">${v.num_arboles || 0}</td>
          <td class="py-2 px-2">${v.anio_plantacion || '-'}</td>
          <td class="py-2 px-2">${v.hectareas} Ha</td>
          <td class="py-2 px-2 text-center">
            <button onclick="abrirModalEditarVariedad(${v.id})" class="text-blue-600 hover:text-blue-800 p-1 mr-1" title="Editar">✏️</button>
            <button onclick="dataDelete('variedades', ${v.id})" class="text-rose-600 hover:text-rose-800 p-1" title="Eliminar">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }
}

function abrirModalGestionArboles() {
  const tbody = document.getElementById("listaGestionArbolesBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  globalData.variedades.forEach(v => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2 px-3 font-bold text-slate-800">${v.nombre}</td>
      <td class="py-2 px-2 text-slate-500">${v.hectareas || 0} Ha</td>
      <td class="py-1.5 px-3 text-right">
        <input type="number" min="0" data-var-id="${v.id}" value="${v.num_arboles || 0}" class="input-arboles w-24 px-2 py-1 border rounded text-right font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500">
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("modalGestionArboles")?.showModal();
}

function ponerArbolesEnCero() {
  document.querySelectorAll(".input-arboles").forEach(inp => inp.value = "0");
}

async function guardarGestionArboles(e) {
  e.preventDefault();
  const inputs = document.querySelectorAll(".input-arboles");
  const customArboles = JSON.parse(localStorage.getItem("fundo_arboles_custom") || "{}");

  for (const inp of inputs) {
    const varId = parseInt(inp.getAttribute("data-var-id"));
    const nArboles = parseInt(inp.value) || 0;
    
    const varObj = globalData.variedades.find(v => v.id == varId);
    if (varObj) varObj.num_arboles = nArboles;

    customArboles[varId] = nArboles;
    await dataUpdate("variedades", varId, { num_arboles: nArboles });
  }

  localStorage.setItem("fundo_arboles_custom", JSON.stringify(customArboles));
  localStorage.setItem("fundo_arboles_reales_iniciado", "true");
  cerrarDialog("modalGestionArboles");
  mostrarToast("Cantidades de plantas actualizadas", "🌳");
  await cargarVariedades();
  calcularYRenderizarDashboard();
}

async function cargarParcelas() {
  const res = await dataFetch("parcelas", "*", "id", true);
  if (!res.success) return;
  globalData.parcelas = res.data;

  const tbody = document.getElementById("adminParcelasBody");
  if (tbody) {
    tbody.innerHTML = "";
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400 italic">No hay arriendos registrados. Agrega uno con el botón "+ Arriendo".</td></tr>`;
    } else {
      res.data.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="py-2.5 px-3 font-bold text-slate-800">${p.nombre}</td>
          <td class="py-2.5 px-2 font-semibold text-emerald-700">${p.hectareas} Ha</td>
          <td class="py-2.5 px-2 text-slate-600">${p.propietario || '-'}</td>
          <td class="py-2.5 px-2 text-center whitespace-nowrap">
            <button onclick="abrirModalEditarParcela(${p.id})" class="text-blue-600 hover:text-blue-800 p-1 mr-1" title="Editar este arriendo">✏️</button>
            <button onclick="dataDelete('parcelas', ${p.id})" class="text-rose-600 hover:text-rose-800 p-1" title="Eliminar">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }
}

function abrirModalParcela() {
  const form = document.getElementById("formParcela");
  if (form) form.reset();
  if (document.getElementById("parcEditId")) document.getElementById("parcEditId").value = "";
  if (document.getElementById("modalParcelaTitle")) {
    document.getElementById("modalParcelaTitle").textContent = "Nuevo Arriendo / Parcela";
  }
  document.getElementById("modalParcela")?.showModal();
}

function abrirModalEditarParcela(id) {
  const p = globalData.parcelas.find(item => String(item.id) === String(id));
  if (!p) return;

  if (document.getElementById("parcEditId")) document.getElementById("parcEditId").value = p.id;
  if (document.getElementById("parcNombre")) document.getElementById("parcNombre").value = p.nombre || "";
  if (document.getElementById("parcHectareas")) document.getElementById("parcHectareas").value = p.hectareas || "";
  if (document.getElementById("parcTenencia")) document.getElementById("parcTenencia").value = p.tipo_tenencia || "Alquilado";
  if (document.getElementById("parcPropietario")) document.getElementById("parcPropietario").value = p.propietario || "";

  if (document.getElementById("modalParcelaTitle")) {
    document.getElementById("modalParcelaTitle").textContent = `Editar Arriendo: ${p.nombre}`;
  }

  document.getElementById("modalParcela")?.showModal();
}

function recalcularStockYValorizacion() {
  let valorTotalAlmacen = 0;

  (globalData.productos || []).forEach(p => {
    const comprasProd = (globalData.compras || []).filter(c => c.producto_id == p.id);
    const totComprado = comprasProd.reduce((a, b) => a + (Number(b.cantidad) || 0), 0);

    const tratProd = (globalData.tratamientos || []).filter(t => t.producto_id == p.id);
    const totAplicado = tratProd.reduce((a, b) => a + (Number(b.cantidad) || 0), 0);

    const stockInicial = Number(p.stock_anterior) || 0;
    p.total_comprado = totComprado;
    p.total_aplicado = totAplicado;
    p.stock_actual = Math.max(0, stockInicial + totComprado - totAplicado);

    // Si tiene compras registradas con precio, actualizar precio de referencia si era 0
    if (comprasProd.length > 0) {
      const conPrecio = comprasProd.filter(c => Number(c.precio_unitario) > 0);
      if (conPrecio.length > 0) {
        const ult = conPrecio[conPrecio.length - 1];
        if (ult && ult.precio_unitario > 0 && (!p.precio_referencial || p.precio_referencial == 0)) {
          p.precio_referencial = Number(ult.precio_unitario);
        }
      }
    }

    const valor = (Number(p.stock_actual) || 0) * (Number(p.precio_referencial) || 0);
    valorTotalAlmacen += valor;
  });

  const badge = document.getElementById("badgeValorAlmacen");
  if (badge) badge.textContent = formatMoney(valorTotalAlmacen);

  const kpiStock = document.getElementById("kpiValorStock");
  if (kpiStock) kpiStock.textContent = formatMoney(valorTotalAlmacen);

  return valorTotalAlmacen;
}

async function cargarProductos() {
  const res = await dataFetch("productos", "*", "nombre", true);
  if (!res.success) return;
  globalData.productos = res.data;

  recalcularStockYValorizacion();

  const selects = ["trataProductoId", "compraProductoId"];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const prevVal = el.value;
    el.innerHTML = "";
    globalData.productos.forEach(p => {
      el.innerHTML += `<option value="${p.id}" data-precio="${p.precio_referencial}" data-stock="${p.stock_actual}">${p.nombre} (Stock: ${formatNum(p.stock_actual, 1)} ${p.unidad})</option>`;
    });
    if (prevVal) el.value = prevVal;
  });

  renderTablaInsumos(globalData.productos);
}

function renderTablaInsumos(productos) {
  const tbody = document.getElementById("insumosTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let valorTotalAlmacen = 0;

  productos.forEach(p => {
    const valor = (Number(p.stock_actual) || 0) * (Number(p.precio_referencial) || 0);
    valorTotalAlmacen += valor;
    const stockClass = (Number(p.stock_actual) || 0) <= 0 ? "text-slate-400" : "text-emerald-700 font-black";

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2 px-3 font-bold text-slate-800">${p.nombre}</td>
      <td class="py-2 px-2 text-slate-500">${p.unidad}</td>
      <td class="py-2 px-2 text-right text-slate-600">${formatNum(p.total_comprado || 0, 1)}</td>
      <td class="py-2 px-2 text-right text-slate-600">${formatNum(p.total_aplicado || 0, 1)}</td>
      <td class="py-2 px-3 text-right ${stockClass}">${formatNum(p.stock_actual || 0, 1)}</td>
      <td class="py-2 px-3 text-right text-slate-600">${formatMoney(p.precio_referencial || 0)}</td>
      <td class="py-2 px-3 text-right font-semibold text-slate-900">${formatMoney(valor)}</td>
      <td class="py-2 px-2 text-center">
        <button onclick="dataDelete('productos', ${p.id})" class="text-rose-600 hover:text-rose-800 p-1" title="Eliminar">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const badge = document.getElementById("badgeValorAlmacen");
  if (badge) badge.textContent = formatMoney(valorTotalAlmacen);
  const kpiStock = document.getElementById("kpiValorStock");
  if (kpiStock) kpiStock.textContent = formatMoney(valorTotalAlmacen);
}

function filtrarInsumos() {
  const query = document.getElementById("filtroInsumos").value.toLowerCase();
  const filtrados = globalData.productos.filter(p => p.nombre.toLowerCase().includes(query));
  renderTablaInsumos(filtrados);
}

async function cargarTrabajadores() {
  const res = await dataFetch("trabajadores", "*", "nombre", true);
  if (!res.success) return;
  globalData.trabajadores = res.data;

  const sel = document.getElementById("jornalTrabajadorId");
  if (sel) {
    sel.innerHTML = "";
    res.data.forEach(t => {
      // Mostrar ÚNICAMENTE el nombre del trabajador a la hora de escogerlo
      sel.innerHTML += `<option value="${t.id}" data-costo="${t.costo_hora_defecto}">${t.nombre}</option>`;
    });
  }
}

function actualizarPrecioHoraTrabajador(trabajadorId) {
  const t = globalData.trabajadores.find(item => item.id == trabajadorId);
  if (t) {
    document.getElementById("jornalPrecioHora").value = t.costo_hora_defecto || 10;
    calcularTotalJornal();
  }
}

async function cargarVentas() {
  const res = await dataFetch("ventas", "*", "fecha", false);
  if (!res.success) return;
  globalData.ventas = res.data;
  renderTablaVentas(globalData.ventas.filter(filtroPorCampana));
}

function renderTablaVentas(ventas) {
  const tbody = document.getElementById("ventasTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const badge = document.getElementById("cantVentasBadge");
  if (badge) badge.textContent = ventas.length;

  ventas.forEach(v => {
    const variedad = globalData.variedades.find(item => item.id == v.variedad_id);
    const varNombre = v.variedad_nombre || variedad?.nombre || "Variedad";

    const estadoBadge = v.cobrado 
      ? `<span class="badge-status badge-paid">Cobrado</span>`
      : `<span class="badge-status badge-pending">Por Cobrar</span>`;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2.5 px-3 text-slate-600 font-mono text-[11px]">${v.fecha}</td>
      <td class="py-2.5 px-3 font-bold text-slate-800">${varNombre}</td>
      <td class="py-2.5 px-3 text-right font-medium text-slate-900">${formatNum(v.kilos, 1)} kg</td>
      <td class="py-2.5 px-3 text-right text-slate-600">${formatMoney(v.precio_kilo)}</td>
      <td class="py-2.5 px-3 text-right font-black text-emerald-700">${formatMoney(v.total)}</td>
      <td class="py-2.5 px-3 text-slate-700">${v.comprador || '-'}</td>
      <td class="py-2.5 px-3 text-slate-500 font-mono text-[11px]">${v.nro_boleta || v.nro_factura || '-'}</td>
      <td class="py-2.5 px-3 text-center">${estadoBadge}</td>
      <td class="py-2.5 px-3 text-center">
        <button onclick="dataDelete('ventas', ${v.id})" class="text-rose-600 hover:text-rose-800 p-1" title="Eliminar">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarVentas() {
  const query = document.getElementById("filtroVentas").value.toLowerCase();
  const base = globalData.ventas.filter(filtroPorCampana);
  const filtradas = base.filter(v => {
    const variedad = globalData.variedades.find(item => item.id == v.variedad_id);
    const varNombre = (v.variedad_nombre || variedad?.nombre || "").toLowerCase();
    return varNombre.includes(query) ||
           (v.comprador && v.comprador.toLowerCase().includes(query)) ||
           (v.nro_boleta && v.nro_boleta.toLowerCase().includes(query)) ||
           (v.nro_factura && v.nro_factura.toLowerCase().includes(query));
  });
  renderTablaVentas(filtradas);
}

async function cargarGastosEspecificos() {
  const res = await dataFetch("gastos_especificos", "*", "fecha", false);
  if (!res.success) return;
  globalData.gastosEspecificos = res.data;
  renderTablaGastosEspecificos(globalData.gastosEspecificos.filter(filtroPorCampana));
}

function renderTablaGastosEspecificos(lista) {
  const tbody = document.getElementById("gastosEspecificosTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  lista.forEach(ge => {
    const variedad = globalData.variedades.find(item => item.id == ge.variedad_id);
    const varNombre = ge.variedad_nombre || variedad?.nombre || "Sin Variedad";

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono text-[11px] text-slate-600">${ge.fecha}</td>
      <td class="py-2.5 px-3 font-bold text-slate-800">${varNombre}</td>
      <td class="py-2.5 px-3 font-medium text-slate-900">${ge.concepto}</td>
      <td class="py-2.5 px-3 text-right font-black text-rose-700">${formatMoney(ge.total)}</td>
      <td class="py-2.5 px-3 text-slate-600">${ge.empresa || '-'}</td>
      <td class="py-2.5 px-3 text-slate-500 font-mono text-[11px]">${ge.nro_factura || '-'}</td>
      <td class="py-2.5 px-3 text-center">
        <button onclick="dataDelete('gastos_especificos', ${ge.id})" class="text-rose-600 hover:text-rose-800 p-1">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function cargarGastosGenerales() {
  const res = await dataFetch("gastos_generales", "*", "fecha", false);
  if (!res.success) return;
  globalData.gastosGenerales = res.data;
  renderTablaGastosGenerales(globalData.gastosGenerales.filter(filtroPorCampana));
}

function renderTablaGastosGenerales(lista) {
  const tbody = document.getElementById("gastosGeneralesTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  lista.forEach(gg => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono text-[11px] text-slate-600">${gg.fecha}</td>
      <td class="py-2.5 px-3 font-bold text-slate-900">${gg.concepto}</td>
      <td class="py-2.5 px-3"><span class="badge-status bg-purple-100 text-purple-800">${gg.categoria || 'General'}</span></td>
      <td class="py-2.5 px-3 text-right font-black text-purple-700">${formatMoney(gg.total)}</td>
      <td class="py-2.5 px-3 text-slate-600">${gg.empresa || '-'}</td>
      <td class="py-2.5 px-3 text-slate-500 font-mono text-[11px]">${gg.nro_factura || '-'}</td>
      <td class="py-2.5 px-3 text-center">
        <button onclick="dataDelete('gastos_generales', ${gg.id})" class="text-rose-600 hover:text-rose-800 p-1">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function cargarJornales() {
  const res = await dataFetch("jornales", "*", "fecha", false);
  if (!res.success) return;
  globalData.jornales = res.data;
  renderTablaJornales(globalData.jornales.filter(filtroPorCampana));
  cargarMatrizMensualJornales();
}

function renderTablaJornales(lista) {
  const tbody = document.getElementById("jornalesTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  lista.forEach(j => {
    const trab = globalData.trabajadores.find(t => t.id == j.trabajador_id);
    const varItem = globalData.variedades.find(v => v.id == j.variedad_id);
    const trabNombre = j.trabajador_nombre || trab?.nombre || "Trabajador";
    const varNombre = j.variedad_nombre || varItem?.nombre || "General / Campo";

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono text-[11px] text-slate-600">${j.fecha}</td>
      <td class="py-2.5 px-3 font-bold text-slate-900">${trabNombre}</td>
      <td class="py-2.5 px-3 text-slate-700">${varNombre}</td>
      <td class="py-2.5 px-3 text-right font-semibold text-slate-900">${j.horas} hrs</td>
      <td class="py-2.5 px-3 text-right text-slate-600">${formatMoney(j.precio_hora)}</td>
      <td class="py-2.5 px-3 text-right font-black text-blue-700">${formatMoney(j.total)}</td>
      <td class="py-2.5 px-3 text-center whitespace-nowrap space-x-1">
        <button onclick="abrirModalEditarJornal(${j.id})" class="text-blue-600 hover:text-blue-800 p-1" title="Editar jornal">✏️</button>
        <button onclick="dataDelete('jornales', ${j.id})" class="text-rose-600 hover:text-rose-800 p-1" title="Eliminar jornal">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function cargarTratamientos() {
  const res = await dataFetch("tratamientos", "*", "fecha", false);
  if (!res.success) return;
  globalData.tratamientos = res.data;
  renderTablaTratamientos(globalData.tratamientos.filter(filtroPorCampana));
}

function renderTablaTratamientos(lista) {
  const tbody = document.getElementById("tratamientosTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  lista.forEach(t => {
    const varItem = globalData.variedades.find(v => v.id == t.variedad_id);
    const prodItem = globalData.productos.find(p => p.id == t.producto_id);
    const varNombre = t.variedad_nombre || varItem?.nombre || "Lote";
    const prodNombre = t.producto_nombre || prodItem?.nombre || "Insumo";
    const unidad = t.producto_unidad || prodItem?.unidad || "Kg/L";

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono text-[11px] text-slate-600">${t.fecha}</td>
      <td class="py-2.5 px-3 font-bold text-slate-900">${varNombre}</td>
      <td class="py-2.5 px-3 font-semibold text-teal-800">${prodNombre}</td>
      <td class="py-2.5 px-3 text-right font-medium">${t.cantidad} ${unidad}</td>
      <td class="py-2.5 px-3 text-right text-slate-600">${formatMoney(t.precio_unitario)}</td>
      <td class="py-2.5 px-3 text-right font-black text-teal-700">${formatMoney(t.total)}</td>
      <td class="py-2.5 px-3 text-slate-500">${t.notas || '-'}</td>
      <td class="py-2.5 px-3 text-center">
        <button onclick="dataDelete('tratamientos', ${t.id})" class="text-rose-600 hover:text-rose-800 p-1">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function cargarCompras() {
  const res = await dataFetch("compras_productos", "*", "fecha", false);
  if (!res.success) return;
  globalData.compras = res.data;
  renderTablaCompras(globalData.compras.filter(filtroPorCampana));
}

function renderTablaCompras(lista) {
  const tbody = document.getElementById("comprasTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  lista.forEach(c => {
    const prod = globalData.productos.find(p => p.id == c.producto_id);
    const prodNombre = c.producto_nombre || prod?.nombre || "Producto";
    const unidad = c.producto_unidad || prod?.unidad || "Kg/L";

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono text-[11px] text-slate-600">${c.fecha}</td>
      <td class="py-2.5 px-3 font-bold text-slate-900">${prodNombre}</td>
      <td class="py-2.5 px-2 text-right font-semibold">${c.cantidad} ${unidad}</td>
      <td class="py-2.5 px-3 text-right text-slate-600">${formatMoney(c.precio_unitario)}</td>
      <td class="py-2.5 px-3 text-right font-black text-cyan-700">${formatMoney(c.total)}</td>
      <td class="py-2.5 px-3 text-slate-700">${c.proveedor || '-'}</td>
      <td class="py-2.5 px-3 text-center">${c.pagado ? '<span class="badge-status badge-paid">Pagado</span>' : '<span class="badge-status badge-pending">Pendiente</span>'}</td>
      <td class="py-2.5 px-2 text-center">
        <button onclick="dataDelete('compras_productos', ${c.id})" class="text-rose-600 hover:text-rose-800 p-1">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ================= MOTOR DE CÁLCULO DE DASHBOARD Y RENTABILIDAD =================
function calcularYRenderizarDashboard() {
  const ventas = globalData.ventas.filter(filtroPorCampana);
  const tratamientos = globalData.tratamientos.filter(filtroPorCampana);
  const especificos = globalData.gastosEspecificos.filter(filtroPorCampana);
  const generales = globalData.gastosGenerales.filter(filtroPorCampana);
  const jornales = globalData.jornales.filter(filtroPorCampana);
  const compras = globalData.compras.filter(filtroPorCampana);
  const variedades = globalData.variedades;

  const totalVentas = ventas.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
  const totalKilos = ventas.reduce((acc, v) => acc + (Number(v.kilos) || 0), 0);
  const totalTratamientos = tratamientos.reduce((acc, t) => acc + (Number(t.total) || 0), 0);
  const totalEspecificos = especificos.reduce((acc, e) => acc + (Number(e.total) || 0), 0);
  const totalGenerales = generales.reduce((acc, g) => acc + (Number(g.total) || 0), 0);
  const totalJornales = jornales.reduce((acc, j) => acc + (Number(j.total) || 0), 0);
  const totalHoras = jornales.reduce((acc, j) => acc + (Number(j.horas) || 0), 0);
  const totalCompras = compras.reduce((acc, c) => acc + (Number(c.total) || 0), 0);

  const totalIngresos = totalVentas;
  // Contabilizar compras de productos de almacén dentro de egresos totales
  const totalGastos = totalCompras + totalTratamientos + totalEspecificos + totalGenerales + totalJornales;
  const resultadoNeto = totalIngresos - totalGastos;

  const totalHa = variedades.reduce((acc, v) => acc + (Number(v.hectareas) || 0), 0) || 1.0;
  const totalArboles = variedades.reduce((acc, v) => acc + (Number(v.num_arboles) || 0), 0);

  // Actualizar KPIs en DOM
  document.getElementById("kpiIngresos").textContent = formatMoney(totalIngresos);
  document.getElementById("kpiKilosTotales").textContent = `${formatNum(totalKilos, 0)} Kg`;
  document.getElementById("kpiGastos").textContent = formatMoney(totalGastos);

  const netoEl = document.getElementById("kpiResultadoNeto");
  netoEl.textContent = formatMoney(resultadoNeto);
  if (resultadoNeto >= 0) {
    netoEl.className = "text-lg sm:text-2xl font-black text-emerald-600 truncate";
    document.getElementById("kpiMargenSub").textContent = "Margen operativo favorable";
  } else {
    netoEl.className = "text-lg sm:text-2xl font-black text-rose-600 truncate";
    document.getElementById("kpiMargenSub").textContent = "Campaña en fase de inversión";
  }

  document.getElementById("kpiJornalesMonto").textContent = formatMoney(totalJornales);
  document.getElementById("kpiTotalHoras").textContent = formatNum(totalHoras, 0);

  // Actualizar Valor Stock
  recalcularStockYValorizacion();

  const haTexto = (totalHa % 1 === 0) ? `${Math.round(totalHa)} hectáreas` : `${formatNum(totalHa, 1)} hectáreas`;
  document.getElementById("sbTotalHectareas").textContent = haTexto;
  const sbArb = document.getElementById("sbTotalArboles");
  if (sbArb) {
    sbArb.textContent = totalArboles > 0 ? `${formatNum(totalArboles, 0)} plantas` : `0 plantas (Sin registrar)`;
  }

  // Actualizar Cultivos en el Menú Lateral dinámicamente
  const sbCultivos = document.getElementById("sbListaCultivos");
  const nombresEspecies = Array.from(new Set(variedades.map(v => v.especie || v.nombre).filter(Boolean)));
  const txtCultivos = nombresEspecies.length > 0 ? nombresEspecies.join(", ") : "Sin registrar";
  if (sbCultivos) {
    sbCultivos.textContent = txtCultivos;
    sbCultivos.title = txtCultivos;
  }

  // Calcular tabla P&L por Variedad
  const resumenVariedades = variedades.map(v => {
    const vid = v.id;
    const arboles = Number(v.num_arboles) || 0;
    const ha = Number(v.hectareas) || 0;

    const vVentas = ventas.filter(item => item.variedad_id == vid);
    const ingV = vVentas.reduce((a, b) => a + (Number(b.total) || 0), 0);
    const kgV = vVentas.reduce((a, b) => a + (Number(b.kilos) || 0), 0);
    const precioProm = kgV > 0 ? ingV / kgV : 0;

    const vTrat = tratamientos.filter(item => item.variedad_id == vid);
    const gastoTrat = vTrat.reduce((a, b) => a + (Number(b.total) || 0), 0);

    const vEsp = especificos.filter(item => item.variedad_id == vid);
    const gastoEsp = vEsp.reduce((a, b) => a + (Number(b.total) || 0), 0);

    const vJor = jornales.filter(item => item.variedad_id == vid);
    const gastoJor = vJor.reduce((a, b) => a + (Number(b.total) || 0), 0);

    const prorrateoGen = totalHa > 0 ? (ha / totalHa) * totalGenerales : 0;
    const prorrateoCompras = totalHa > 0 ? (ha / totalHa) * totalCompras : 0;
    const totalCostosV = gastoTrat + gastoEsp + gastoJor + prorrateoGen + prorrateoCompras;
    const netoV = ingV - totalCostosV;
    const rentArbol = arboles > 0 ? netoV / arboles : null;

    return {
      id: vid,
      nombre: v.nombre,
      num_arboles: arboles,
      hectareas: ha,
      ingresos_ventas: ingV,
      kilos_vendidos: kgV,
      precio_promedio_kg: precioProm,
      gasto_quimicos: gastoTrat,
      gasto_especificos: gastoEsp,
      gasto_jornales: gastoJor,
      gasto_generales_prorrateado: prorrateoGen + prorrateoCompras,
      total_gastos: totalCostosV,
      resultado_neto: netoV,
      resultado_por_arbol: rentArbol
    };
  });

  renderGraficoEspecies(resumenVariedades);
  renderGraficoGastos({
    "Compras de Insumos": totalCompras,
    "Tratamientos / Aplicaciones": totalTratamientos,
    "Jornales / Mano de Obra": totalJornales,
    "Gastos Específicos": totalEspecificos,
    "Gastos Generales / Arriendos": totalGenerales
  });
  renderDashboardVariedadesMini(resumenVariedades);
  renderTablaResumenEspecies(resumenVariedades);
  renderTablaBalanceCampanas();
}

function renderTablaBalanceCampanas() {
  const tbody = document.getElementById("tablaBalanceCampanasBody");
  const tfoot = document.getElementById("tablaBalanceCampanasFoot");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Obtener todos los años únicos de campañas registradas y datos
  const aniosSet = new Set();
  (globalData.campanas || []).forEach(c => { if (c.anio) aniosSet.add(Number(c.anio)); });
  
  [...globalData.ventas, ...globalData.tratamientos, ...globalData.gastosEspecificos, ...globalData.gastosGenerales, ...globalData.jornales, ...globalData.compras].forEach(item => {
    if (item && item.fecha) {
      const y = parseInt(item.fecha.substring(0, 4), 10);
      if (!isNaN(y) && y > 2000 && y < 2100) aniosSet.add(y);
    }
  });

  if (aniosSet.size === 0) {
    aniosSet.add(2026);
    aniosSet.add(2025);
  }

  const aniosOrdenados = Array.from(aniosSet).sort((a, b) => b - a);

  let granTotalIngresos = 0;
  let granTotalInsumos = 0;
  let granTotalJornales = 0;
  let granTotalCampo = 0;
  let granTotalEgresos = 0;
  let granTotalNeto = 0;
  let granTotalKilos = 0;

  aniosOrdenados.forEach(anio => {
    const filtroAnio = item => item && item.fecha && item.fecha.startsWith(String(anio));
    
    const vList = globalData.ventas.filter(filtroAnio);
    const tList = globalData.tratamientos.filter(filtroAnio);
    const jList = globalData.jornales.filter(filtroAnio);
    const geList = globalData.gastosEspecificos.filter(filtroAnio);
    const ggList = globalData.gastosGenerales.filter(filtroAnio);
    const cList = globalData.compras.filter(filtroAnio);

    const ingresos = vList.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
    const kilos = vList.reduce((acc, v) => acc + (Number(v.kilos) || 0), 0);
    const insumos = tList.reduce((acc, t) => acc + (Number(t.total) || 0), 0);
    const compras = cList.reduce((acc, c) => acc + (Number(c.total) || 0), 0);
    const jornales = jList.reduce((acc, j) => acc + (Number(j.total) || 0), 0);
    const especificos = geList.reduce((acc, e) => acc + (Number(e.total) || 0), 0);
    const generales = ggList.reduce((acc, g) => acc + (Number(g.total) || 0), 0);
    const gastosCampo = especificos + generales;
    const totalInsumosYCompras = insumos + compras;
    const egresos = totalInsumosYCompras + jornales + gastosCampo;
    const neto = ingresos - egresos;

    granTotalIngresos += ingresos;
    granTotalInsumos += totalInsumosYCompras;
    granTotalJornales += jornales;
    granTotalCampo += gastosCampo;
    granTotalEgresos += egresos;
    granTotalNeto += neto;
    granTotalKilos += kilos;

    const esActiva = String(campanaActiva) === String(anio);
    const campanaObj = (globalData.campanas || []).find(c => Number(c.anio) === anio);
    const nombreCampana = campanaObj ? campanaObj.nombre : `Campaña ${anio}`;

    const rowClass = esActiva 
      ? "bg-emerald-50/60 font-medium hover:bg-emerald-100/60 border-l-4 border-l-emerald-600 transition" 
      : "hover:bg-slate-50 transition";

    const netoColor = neto >= 0 ? "text-emerald-700 font-bold" : "text-rose-700 font-bold";

    const tr = document.createElement("tr");
    tr.className = rowClass;
    tr.innerHTML = `
      <td class="py-3 px-3 font-bold text-slate-900 flex items-center gap-1.5">
        ${esActiva ? '<span class="text-xs">👉</span>' : ''}
        <span>${nombreCampana}</span>
        ${esActiva ? '<span class="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded ml-1">SELECCIONADA</span>' : ''}
      </td>
      <td class="py-3 px-3 text-right font-black text-emerald-700 bg-emerald-50/30">${formatMoney(ingresos)}</td>
      <td class="py-3 px-3 text-right text-slate-700">${formatMoney(totalInsumosYCompras)}</td>
      <td class="py-3 px-3 text-right text-slate-700">${formatMoney(jornales)}</td>
      <td class="py-3 px-3 text-right text-slate-700">${formatMoney(gastosCampo)}</td>
      <td class="py-3 px-3 text-right font-bold text-rose-700 bg-rose-50/30">${formatMoney(egresos)}</td>
      <td class="py-3 px-3 text-right font-black ${netoColor} text-sm">${formatMoney(neto)}</td>
      <td class="py-3 px-3 text-right font-medium text-slate-800">${formatNum(kilos, 1)} kg</td>
      <td class="py-3 px-2 text-center">
        <div class="flex items-center justify-center gap-1.5">
          <button onclick="document.getElementById('selectCampana').value='${anio}'; cambiarCampana('${anio}');" class="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition">
            Ver panel
          </button>
          <button onclick="eliminarCampana('${campanaObj?.id || ''}', '${nombreCampana}', ${anio})" class="text-[11px] px-1.5 py-1 text-rose-600 hover:bg-rose-50 rounded border border-rose-200 transition" title="Eliminar ${nombreCampana}">
            🗑️
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <td class="py-3 px-3 uppercase text-[10px] tracking-wider text-slate-800 font-black">TOTAL HISTÓRICO CONSOLIDADO</td>
        <td class="py-3 px-3 text-right font-black text-emerald-800">${formatMoney(granTotalIngresos)}</td>
        <td class="py-3 px-3 text-right text-slate-800">${formatMoney(granTotalInsumos)}</td>
        <td class="py-3 px-3 text-right text-slate-800">${formatMoney(granTotalJornales)}</td>
        <td class="py-3 px-3 text-right text-slate-800">${formatMoney(granTotalCampo)}</td>
        <td class="py-3 px-3 text-right font-black text-rose-800">${formatMoney(granTotalEgresos)}</td>
        <td class="py-3 px-3 text-right font-black ${granTotalNeto >= 0 ? 'text-emerald-800' : 'text-rose-800'} text-sm">${formatMoney(granTotalNeto)}</td>
        <td class="py-3 px-3 text-right font-black text-slate-900">${formatNum(granTotalKilos, 1)} kg</td>
        <td class="py-3 px-2 text-center text-[10px] text-slate-500 font-semibold">${aniosOrdenados.length} Campañas</td>
      </tr>
    `;
  }
}

function renderDashboardVariedadesMini(variedades) {
  const tbody = document.getElementById("dashboardVariedadesTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (variedades.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400 italic">No hay cultivos registrados aún. Haz clic en "Gestión de Cultivos" o en "+ Cultivo" para agregar.</td></tr>`;
    return;
  }

  variedades.forEach(v => {
    const netoColor = v.resultado_neto >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold";
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50/80 transition";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-semibold text-slate-800">${v.nombre}</td>
      <td class="py-2.5 px-3">${v.hectareas} Ha</td>
      <td class="py-2.5 px-3">${v.num_arboles ? `${v.num_arboles}` : '-'}</td>
      <td class="py-2.5 px-3 text-right font-medium text-emerald-600">${formatMoney(v.ingresos_ventas)}</td>
      <td class="py-2.5 px-3 text-right text-rose-600">${formatMoney(v.total_gastos)}</td>
      <td class="py-2.5 px-3 text-right ${netoColor}">${formatMoney(v.resultado_neto)}</td>
      <td class="py-2.5 px-3 text-right">${v.resultado_por_arbol !== null ? formatMoney(v.resultado_por_arbol) : '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTablaResumenEspecies(variedades) {
  const tbody = document.getElementById("resumenVariedadesBody");
  const tfoot = document.getElementById("resumenVariedadesFoot");
  if (!tbody || !tfoot) return;

  tbody.innerHTML = "";

  if (variedades.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="py-8 text-center text-slate-400 italic">No hay especies registradas. Agrega tus variedades en el menú "Gestión de Cultivos y Parcelas" para comenzar.</td></tr>`;
    tfoot.innerHTML = "";
    return;
  }

  let sumArboles = 0;
  let sumHa = 0;
  let sumIngresos = 0;
  let sumQuimicos = 0;
  let sumEspecificos = 0;
  let sumGenerales = 0;
  let sumJornales = 0;
  let sumTotalCostos = 0;
  let sumNeto = 0;
  let sumKilos = 0;

  variedades.forEach(v => {
    sumArboles += v.num_arboles || 0;
    sumHa += v.hectareas || 0;
    sumIngresos += v.ingresos_ventas;
    sumQuimicos += v.gasto_quimicos;
    sumEspecificos += v.gasto_especificos;
    sumGenerales += v.gasto_generales_prorrateado;
    sumJornales += v.gasto_jornales;
    sumTotalCostos += v.total_gastos;
    sumNeto += v.resultado_neto;
    sumKilos += v.kilos_vendidos;

    const netoClass = v.resultado_neto >= 0 ? "text-emerald-700 bg-emerald-50/50" : "text-rose-700 bg-rose-50/50";

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-bold text-slate-900">${v.nombre}</td>
      <td class="py-2.5 px-2 text-center text-slate-600">${v.num_arboles || '-'}</td>
      <td class="py-2.5 px-2 text-center text-slate-600">${v.hectareas || '-'}</td>
      <td class="py-2.5 px-3 text-right font-bold text-emerald-700 bg-emerald-50/20">${formatMoney(v.ingresos_ventas)}</td>
      <td class="py-2.5 px-3 text-right text-slate-700">${formatMoney(v.gasto_quimicos)}</td>
      <td class="py-2.5 px-3 text-right text-slate-700">${formatMoney(v.gasto_especificos)}</td>
      <td class="py-2.5 px-3 text-right text-slate-500">${formatMoney(v.gasto_generales_prorrateado)}</td>
      <td class="py-2.5 px-3 text-right text-slate-700">${formatMoney(v.gasto_jornales)}</td>
      <td class="py-2.5 px-3 text-right font-semibold text-rose-700 bg-rose-50/30">${formatMoney(v.total_gastos)}</td>
      <td class="py-2.5 px-3 text-right font-black ${netoClass}">${formatMoney(v.resultado_neto)}</td>
      <td class="py-2.5 px-2 text-right font-medium text-slate-700">${v.resultado_por_arbol !== null ? formatMoney(v.resultado_por_arbol) : '-'}</td>
      <td class="py-2.5 px-2 text-right font-medium text-slate-800">${formatNum(v.kilos_vendidos, 1)} kg</td>
      <td class="py-2.5 px-2 text-right text-slate-600">${v.precio_promedio_kg > 0 ? formatMoney(v.precio_promedio_kg) : '-'}</td>
    `;
    tbody.appendChild(tr);
  });

  tfoot.innerHTML = `
    <tr>
      <td class="py-3 px-3 uppercase tracking-wider">TOTALES FUNDO EL CASTILLO</td>
      <td class="py-3 px-2 text-center">${sumArboles}</td>
      <td class="py-3 px-2 text-center">${formatNum(sumHa, 1)} Ha</td>
      <td class="py-3 px-3 text-right font-black text-emerald-800">${formatMoney(sumIngresos)}</td>
      <td class="py-3 px-3 text-right">${formatMoney(sumQuimicos)}</td>
      <td class="py-3 px-3 text-right">${formatMoney(sumEspecificos)}</td>
      <td class="py-3 px-3 text-right">${formatMoney(sumGenerales)}</td>
      <td class="py-3 px-3 text-right">${formatMoney(sumJornales)}</td>
      <td class="py-3 px-3 text-right font-black text-rose-800">${formatMoney(sumTotalCostos)}</td>
      <td class="py-3 px-3 text-right font-black ${sumNeto >= 0 ? 'text-emerald-800' : 'text-rose-800'}">${formatMoney(sumNeto)}</td>
      <td class="py-3 px-2 text-right">${sumArboles > 0 ? formatMoney(sumNeto / sumArboles) : '-'}</td>
      <td class="py-3 px-2 text-right font-bold">${formatNum(sumKilos, 1)} kg</td>
      <td class="py-3 px-2 text-right">${sumKilos > 0 ? formatMoney(sumIngresos / sumKilos) : '-'}</td>
    </tr>
  `;
}

// Gráficos Chart.js
function renderGraficoEspecies(variedades) {
  const ctx = document.getElementById("chartEspecies")?.getContext("2d");
  if (!ctx) return;

  const labels = variedades.map(v => v.nombre);
  const dataIngresos = variedades.map(v => v.ingresos_ventas);
  const dataGastos = variedades.map(v => v.total_gastos);

  if (chartEspeciesInst) chartEspeciesInst.destroy();

  chartEspeciesInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ingresos Ventas',
          data: dataIngresos,
          backgroundColor: '#10b981',
          borderRadius: 6
        },
        {
          label: 'Costos Totales',
          data: dataGastos,
          backgroundColor: '#f43f5e',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { font: { size: 9 } } },
        x: { ticks: { font: { size: 9 } } }
      }
    }
  });
}

function renderGraficoGastos(distribucion) {
  const ctx = document.getElementById("chartGastos")?.getContext("2d");
  if (!ctx) return;

  const labels = Object.keys(distribucion);
  const data = Object.values(distribucion);
  const total = data.reduce((a, b) => a + b, 0);

  if (chartGastosInst) chartGastosInst.destroy();

  if (total === 0) {
    chartGastosInst = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Sin gastos registrados'],
        datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
    return;
  }

  chartGastosInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#0d9488', '#3b82f6', '#f43f5e', '#a855f7'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } }
      },
      cutout: '65%'
    }
  });
}

// Matriz Mensual por Trabajador (Excel)
function cargarMatrizMensualJornales() {
  const tbody = document.getElementById("matrizJornalesBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const trabajadores = globalData.trabajadores;
  const jornales = globalData.jornales.filter(filtroPorCampana);

  let totalesMesHoras = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let totalesMesCosto = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  trabajadores.forEach(t => {
    let horasMes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let costoMes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    const jornalesT = jornales.filter(j => j.trabajador_id == t.id);
    jornalesT.forEach(j => {
      if (!j.fecha) return;
      const m = parseInt(j.fecha.split("-")[1], 10) - 1;
      if (m >= 0 && m < 12) {
        horasMes[m] += Number(j.horas) || 0;
        costoMes[m] += Number(j.total) || 0;
        totalesMesHoras[m] += Number(j.horas) || 0;
        totalesMesCosto[m] += Number(j.total) || 0;
      }
    });

    const totH = horasMes.reduce((a, b) => a + b, 0);
    const totC = costoMes.reduce((a, b) => a + b, 0);

    // Fila Horas
    const trH = document.createElement("tr");
    trH.className = "bg-white hover:bg-slate-50 border-t border-slate-200";
    let hTd = `<td class="py-2 px-3 font-bold text-slate-800 border-r border-slate-200">${t.nombre} <span class="text-[9px] font-normal text-slate-500 block">Horas/Mes</span></td>`;
    horasMes.forEach(h => {
      hTd += `<td class="py-2 px-1 text-center font-mono text-[10px] ${h > 0 ? 'font-bold text-blue-600 bg-blue-50/30' : 'text-slate-400'}">${h || 0}</td>`;
    });
    hTd += `<td class="py-2 px-2.5 text-right font-bold text-slate-900 bg-slate-100">${totH} hrs</td>`;
    trH.innerHTML = hTd;
    tbody.appendChild(trH);

    // Fila Coste
    const trC = document.createElement("tr");
    trC.className = "bg-slate-50/40 hover:bg-slate-50 border-b border-slate-200 text-slate-600";
    let cTd = `<td class="py-2 px-3 text-slate-500 italic text-[10px] border-r border-slate-200 pl-4">Coste / Mes</td>`;
    costoMes.forEach(c => {
      cTd += `<td class="py-2 px-1 text-center font-mono text-[10px] ${c > 0 ? 'font-bold text-slate-800' : 'text-slate-400'}">${c > 0 ? formatNum(c, 0) : '0'}</td>`;
    });
    cTd += `<td class="py-2 px-2.5 text-right font-bold text-blue-700 bg-blue-50/50">${formatMoney(totC)}</td>`;
    trC.innerHTML = cTd;
    tbody.appendChild(trC);
  });

  // Fila Totales
  const granH = totalesMesHoras.reduce((a, b) => a + b, 0);
  const granC = totalesMesCosto.reduce((a, b) => a + b, 0);

  const trTotH = document.createElement("tr");
  trTotH.className = "bg-slate-900 text-white font-bold border-t-2 border-slate-700";
  let tHTd = `<td class="py-2 px-3 uppercase text-[9px]">TOTAL HORAS CAMPO</td>`;
  totalesMesHoras.forEach(h => {
    tHTd += `<td class="py-2 px-1 text-center font-mono text-[10px]">${h}</td>`;
  });
  tHTd += `<td class="py-2 px-2.5 text-right font-black bg-slate-950">${granH} hrs</td>`;
  trTotH.innerHTML = tHTd;
  tbody.appendChild(trTotH);

  const trTotC = document.createElement("tr");
  trTotC.className = "bg-slate-800 text-emerald-400 font-bold border-b-2 border-slate-700";
  let tCTd = `<td class="py-2 px-3 uppercase text-[9px] text-white">TOTAL COSTE MANO OBRA</td>`;
  totalesMesCosto.forEach(c => {
    tCTd += `<td class="py-2 px-1 text-center font-mono text-[10px]">${c > 0 ? formatNum(c, 0) : '0'}</td>`;
  });
  tCTd += `<td class="py-2 px-2.5 text-right font-black bg-slate-950 text-emerald-400">${formatMoney(granC)}</td>`;
  trTotC.innerHTML = tCTd;
  tbody.appendChild(trTotC);
}

// ================= MODALES Y ACCIONES =================
function abrirModalRegistroRapido() { document.getElementById("modalRegistroRapido")?.showModal(); }
function abrirModalVenta() { document.getElementById("modalVenta")?.showModal(); }

function abrirModalTrabajador() {
  document.getElementById("formTrabajador")?.reset();
  document.getElementById("modalTrabajador")?.showModal();
}

function abrirModalJornal() {
  const modalTitle = document.getElementById("modalJornalTitle");
  if (modalTitle) modalTitle.textContent = "Registrar Jornal de Mano de Obra";
  document.getElementById("formJornal")?.reset();
  const editInput = document.getElementById("jornalEditId");
  if (editInput) editInput.value = "";

  if (campanaActiva && campanaActiva !== "todas") {
    const hoy = new Date();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    const fInput = document.getElementById("jornalFecha");
    if (fInput) fInput.value = `${campanaActiva}-${mm}-${dd}`;
  } else {
    initFechasHoy();
  }

  const trabSel = document.getElementById("jornalTrabajadorId");
  if (trabSel && trabSel.value) {
    actualizarPrecioHoraTrabajador(trabSel.value);
  }
  calcularTotalJornal();
  document.getElementById("modalJornal")?.showModal();
}

function abrirModalEditarJornal(id) {
  const j = globalData.jornales.find(item => item.id == id);
  if (!j) return;

  const modalTitle = document.getElementById("modalJornalTitle");
  if (modalTitle) modalTitle.textContent = "Editar Jornal de Mano de Obra";

  const editInput = document.getElementById("jornalEditId");
  if (editInput) editInput.value = j.id;

  const fInput = document.getElementById("jornalFecha");
  if (fInput) fInput.value = j.fecha || "";

  const trabSel = document.getElementById("jornalTrabajadorId");
  if (trabSel && j.trabajador_id) trabSel.value = j.trabajador_id;

  const varSel = document.getElementById("jornalVariedadId");
  if (varSel) varSel.value = j.variedad_id || "";

  const hInput = document.getElementById("jornalHoras");
  if (hInput) hInput.value = j.horas ?? "";

  const pInput = document.getElementById("jornalPrecioHora");
  if (pInput) pInput.value = j.precio_hora ?? "";

  const labInput = document.getElementById("jornalLabor");
  if (labInput) labInput.value = j.labor || "";

  const notInput = document.getElementById("jornalNotas");
  if (notInput) notInput.value = j.notas || "";

  calcularTotalJornal();
  document.getElementById("modalJornal")?.showModal();
}

function abrirModalTratamiento() {
  const sel = document.getElementById("trataProductoId");
  if (sel && sel.value) {
    actualizarPrecioInsumo(sel.value);
  }
  document.getElementById("modalTratamiento")?.showModal();
}

function abrirModalGastoGeneral() { document.getElementById("modalGastoGeneral")?.showModal(); }
function abrirModalGastoEspecifico() { document.getElementById("modalGastoEspecifico")?.showModal(); }
function abrirModalCompraInsumo() { document.getElementById("modalCompraInsumo")?.showModal(); }
function abrirModalNuevoProducto() { document.getElementById("modalNuevoProducto")?.showModal(); }
function abrirModalVariedad() {
  const modalTitle = document.getElementById("modalVariedadTitle");
  if (modalTitle) modalTitle.textContent = "Nueva Variedad / Cultivo";
  document.getElementById("formVariedad").reset();
  if (document.getElementById("varEditId")) document.getElementById("varEditId").value = "";
  if (document.getElementById("varNumArboles")) document.getElementById("varNumArboles").value = "0";
  document.getElementById("modalVariedad")?.showModal();
}

function abrirModalEditarVariedad(id) {
  const v = globalData.variedades.find(item => item.id == id);
  if (!v) return;

  const modalTitle = document.getElementById("modalVariedadTitle");
  if (modalTitle) modalTitle.textContent = "Editar Variedad / Cultivo";
  
  if (document.getElementById("varEditId")) document.getElementById("varEditId").value = v.id;
  document.getElementById("varNombre").value = v.nombre || "";
  document.getElementById("varEspecie").value = v.especie || "";
  document.getElementById("varNumArboles").value = v.num_arboles || 0;
  document.getElementById("varAnio").value = v.anio_plantacion || "";
  document.getElementById("varHectareas").value = v.hectareas || 1.0;

  document.getElementById("modalVariedad")?.showModal();
}
function cerrarDialog(id) { document.getElementById(id)?.close(); }

function calcularTotalVenta() {
  const k = parseFloat(document.getElementById("ventaKilos").value) || 0;
  const p = parseFloat(document.getElementById("ventaPrecio").value) || 0;
  document.getElementById("ventaTotalCalculado").textContent = formatMoney(k * p);
}

function calcularTotalJornal() {
  const h = parseFloat(document.getElementById("jornalHoras").value) || 0;
  const p = parseFloat(document.getElementById("jornalPrecioHora").value) || 0;
  document.getElementById("jornalTotalCalculado").textContent = formatMoney(h * p);
}

function calcularTotalTratamiento() {
  const c = parseFloat(document.getElementById("trataCantidad").value) || 0;
  const p = parseFloat(document.getElementById("trataPrecioUnitario").value) || 0;
  document.getElementById("trataTotalCalculado").textContent = formatMoney(c * p);
}

function calcularTotalCompra() {
  const c = parseFloat(document.getElementById("compraCantidad").value) || 0;
  const p = parseFloat(document.getElementById("compraPrecioUnitario").value) || 0;
  document.getElementById("compraTotalCalculado").textContent = formatMoney(c * p);
}

function actualizarPrecioInsumo(productoId) {
  const p = globalData.productos.find(item => item.id == productoId);
  if (p) {
    let costoUnitario = Number(p.precio_referencial) || 0;
    // Si hay compras registradas para este producto, tomar el costo unitario registrado
    const comprasProd = (globalData.compras || []).filter(c => c.producto_id == productoId && Number(c.precio_unitario) > 0);
    if (comprasProd.length > 0) {
      const ult = comprasProd[comprasProd.length - 1];
      if (ult && Number(ult.precio_unitario) > 0) {
        costoUnitario = Number(ult.precio_unitario);
      }
    }

    document.getElementById("trataPrecioUnitario").value = costoUnitario;
    const info = document.getElementById("trataStockInfo");
    if (info) {
      info.textContent = `Stock en almacén: ${formatNum(p.stock_actual, 1)} ${p.unidad} (Costo en stock: ${formatMoney(costoUnitario)}/${p.unidad})`;
    }
    calcularTotalTratamiento();
  }
}

// Guardar
async function guardarVenta(e) {
  e.preventDefault();
  const k = parseFloat(document.getElementById("ventaKilos").value);
  const p = parseFloat(document.getElementById("ventaPrecio").value);
  const data = {
    fecha: document.getElementById("ventaFecha").value,
    variedad_id: parseInt(document.getElementById("ventaVariedadId").value),
    kilos: k,
    precio_kilo: p,
    total: Math.round(k * p * 100) / 100,
    comprador: document.getElementById("ventaComprador").value,
    nro_boleta: document.getElementById("ventaComprobante").value,
    cobrado: document.getElementById("ventaCobrado").checked,
    notas: document.getElementById("ventaNotas").value
  };

  const res = await dataInsert("ventas", data);
  if (res.success) {
    cerrarDialog("modalVenta");
    document.getElementById("formVenta").reset();
    initFechasHoy();
    mostrarToast("Venta registrada con éxito", "💰");
    actualizarDatos();
  }
}

async function guardarJornal(e) {
  e.preventDefault();
  const editId = document.getElementById("jornalEditId")?.value;
  const hRaw = document.getElementById("jornalHoras").value || "0";
  const pRaw = document.getElementById("jornalPrecioHora").value || "0";
  const h = parseFloat(String(hRaw).replace(',', '.')) || 0;
  const p = parseFloat(String(pRaw).replace(',', '.')) || 0;
  const trabId = parseInt(document.getElementById("jornalTrabajadorId").value);
  const trab = globalData.trabajadores.find(t => t.id == trabId);
  const varId = document.getElementById("jornalVariedadId").value ? parseInt(document.getElementById("jornalVariedadId").value) : null;
  const varItem = globalData.variedades.find(v => v.id == varId);

  const data = {
    fecha: document.getElementById("jornalFecha").value,
    trabajador_id: trabId,
    trabajador_nombre: trab ? trab.nombre : "",
    variedad_id: varId,
    variedad_nombre: varItem ? varItem.nombre : "General / Campo",
    horas: h,
    precio_hora: p,
    total: Math.round(h * p * 100) / 100,
    labor: document.getElementById("jornalLabor").value.trim(),
    notas: document.getElementById("jornalNotas").value.trim()
  };

  if (editId) {
    const ok = await dataUpdate("jornales", editId, data);
    if (ok) {
      cerrarDialog("modalJornal");
      document.getElementById("formJornal").reset();
      document.getElementById("jornalEditId").value = "";
      initFechasHoy();
      mostrarToast("Jornal actualizado con éxito", "✅");
      actualizarDatos();
    }
  } else {
    const res = await dataInsert("jornales", data);
    if (res.success) {
      cerrarDialog("modalJornal");
      document.getElementById("formJornal").reset();
      document.getElementById("jornalEditId").value = "";
      initFechasHoy();
      mostrarToast("Jornal registrado con éxito", "👨‍🌾");
      actualizarDatos();
    }
  }
}

async function guardarTratamiento(e) {
  e.preventDefault();
  const cRaw = document.getElementById("trataCantidad").value || "0";
  const pRaw = document.getElementById("trataPrecioUnitario").value || "0";
  const c = parseFloat(String(cRaw).replace(',', '.')) || 0;
  const p = parseFloat(String(pRaw).replace(',', '.')) || 0;
  const prodId = parseInt(document.getElementById("trataProductoId").value);
  const prod = globalData.productos.find(pr => pr.id == prodId);
  const varId = parseInt(document.getElementById("trataVariedadId").value);
  const varItem = globalData.variedades.find(v => v.id == varId);

  const data = {
    fecha: document.getElementById("trataFecha").value,
    variedad_id: varId,
    variedad_nombre: varItem ? varItem.nombre : "",
    producto_id: prodId,
    producto_nombre: prod ? prod.nombre : "",
    producto_unidad: prod ? prod.unidad : "Kg/L",
    cantidad: c,
    precio_unitario: p,
    total: Math.round(c * p * 100) / 100,
    notas: document.getElementById("trataNotas").value.trim()
  };

  const res = await dataInsert("tratamientos", data);
  if (res.success) {
    if (prod) {
      const nuevoStock = Math.max(0, (Number(prod.stock_actual) || 0) - c);
      prod.stock_actual = nuevoStock;
      await dataUpdate("productos", prod.id, { stock_actual: nuevoStock });
    }
    cerrarDialog("modalTratamiento");
    document.getElementById("formTratamiento").reset();
    initFechasHoy();
    mostrarToast("Aplicación registrada y stock descontado", "🧪");
    actualizarDatos();
  }
}

async function guardarGastoGeneral(e) {
  e.preventDefault();
  const totalRaw = document.getElementById("ggTotal")?.value || "0";
  const total = parseFloat(String(totalRaw).replace(',', '.')) || 0;
  const data = {
    fecha: document.getElementById("ggFecha").value,
    concepto: document.getElementById("ggConcepto").value,
    total: total,
    categoria: document.getElementById("ggCategoria").value,
    empresa: document.getElementById("ggEmpresa").value,
    nro_factura: document.getElementById("ggFactura").value
  };

  const res = await dataInsert("gastos_generales", data);
  if (res.success) {
    cerrarDialog("modalGastoGeneral");
    document.getElementById("formGastoGeneral").reset();
    initFechasHoy();
    mostrarToast("Gasto general guardado", "🚜");
    actualizarDatos();
  }
}

async function guardarGastoEspecifico(e) {
  e.preventDefault();
  const totalRaw = document.getElementById("geTotal")?.value || "0";
  const total = parseFloat(String(totalRaw).replace(',', '.')) || 0;
  const varId = document.getElementById("geVariedadId")?.value;

  const data = {
    fecha: document.getElementById("geFecha")?.value,
    variedad_id: varId ? parseInt(varId) : null,
    concepto: document.getElementById("geConcepto")?.value || "",
    total: total,
    empresa: document.getElementById("geEmpresa")?.value || "",
    nro_factura: document.getElementById("geFactura")?.value || ""
  };

  const res = await dataInsert("gastos_especificos", data);
  if (res.success) {
    cerrarDialog("modalGastoEspecifico");
    document.getElementById("formGastoEspecifico").reset();
    initFechasHoy();
    mostrarToast("Gasto específico guardado", "📉");
    actualizarDatos();
  }
}

async function guardarCompraInsumo(e) {
  e.preventDefault();
  const cRaw = document.getElementById("compraCantidad").value || "0";
  const pRaw = document.getElementById("compraPrecioUnitario").value || "0";
  const c = parseFloat(String(cRaw).replace(',', '.')) || 0;
  const p = parseFloat(String(pRaw).replace(',', '.')) || 0;
  const prodId = parseInt(document.getElementById("compraProductoId").value);
  const prod = globalData.productos.find(pr => pr.id == prodId);

  const data = {
    fecha: document.getElementById("compraFecha").value,
    producto_id: prodId,
    producto_nombre: prod ? prod.nombre : "",
    producto_unidad: prod ? prod.unidad : "Kg/L",
    cantidad: c,
    precio_unitario: p,
    total: Math.round(c * p * 100) / 100,
    proveedor: document.getElementById("compraProveedor").value.trim(),
    nro_factura: document.getElementById("compraFactura").value.trim(),
    pagado: document.getElementById("compraPagado").checked
  };

  const res = await dataInsert("compras_productos", data);
  if (res.success) {
    if (prod) {
      const nuevoStock = (Number(prod.stock_actual) || 0) + c;
      const nuevoPrecio = p > 0 ? p : (Number(prod.precio_referencial) || 0);
      prod.stock_actual = nuevoStock;
      prod.precio_referencial = nuevoPrecio;
      await dataUpdate("productos", prod.id, {
        stock_actual: nuevoStock,
        precio_referencial: nuevoPrecio
      });
    }
    cerrarDialog("modalCompraInsumo");
    document.getElementById("formCompraInsumo").reset();
    initFechasHoy();
    mostrarToast("Compra registrada y stock aumentado", "📦");
    actualizarDatos();
  }
}

async function guardarNuevoProducto(e) {
  e.preventDefault();
  const stRaw = document.getElementById("prodStockInicial").value || "0";
  const prRaw = document.getElementById("prodPrecioRef").value || "0";
  const st = parseFloat(String(stRaw).replace(',', '.')) || 0;
  const pr = parseFloat(String(prRaw).replace(',', '.')) || 0;
  const data = {
    nombre: document.getElementById("prodNombre").value.trim().toUpperCase(),
    unidad: document.getElementById("prodUnidad").value,
    stock_anterior: st,
    stock_actual: st,
    precio_referencial: pr
  };

  const res = await dataInsert("productos", data);
  if (res.success) {
    cerrarDialog("modalNuevoProducto");
    document.getElementById("formNuevoProducto").reset();
    mostrarToast("Insumo agregado al catálogo", "✅");
    actualizarDatos();
  }
}

async function guardarTrabajador(e) {
  e.preventDefault();
  const nom = document.getElementById("trabNombre").value.trim();
  if (!nom) {
    mostrarToast("Ingresa el nombre del trabajador", "⚠️");
    return;
  }
  const rol = document.getElementById("trabRol").value.trim() || "Jornalero";
  const cRaw = document.getElementById("trabCostoHora").value || "10";
  const c = parseFloat(String(cRaw).replace(',', '.')) || 10;

  const data = {
    nombre: nom,
    rol: rol,
    costo_hora_defecto: c,
    activo: true
  };

  const res = await dataInsert("trabajadores", data);
  if (res.success) {
    cerrarDialog("modalTrabajador");
    document.getElementById("formTrabajador").reset();
    mostrarToast(`Trabajador ${nom} registrado con éxito`, "👨‍🌾");
    await cargarTrabajadores();
    if (res.id) {
      const sel = document.getElementById("jornalTrabajadorId");
      if (sel) {
        sel.value = res.id;
        actualizarPrecioHoraTrabajador(res.id);
      }
    }
    actualizarDatos();
  }
}

async function guardarVariedad(e) {
  e.preventDefault();
  const editId = document.getElementById("varEditId")?.value;
  const nombre = document.getElementById("varNombre").value.trim().toUpperCase();
  const especie = document.getElementById("varEspecie").value.trim() || nombre;
  const num_arboles = parseInt(document.getElementById("varNumArboles").value) || 0;
  const anio_plantacion = parseInt(document.getElementById("varAnio").value) || null;
  const haRaw = document.getElementById("varHectareas")?.value || "0";
  const hectareas = parseFloat(String(haRaw).replace(',', '.')) || 0;

  if (!nombre) {
    mostrarToast("Por favor ingresa el nombre de la variedad o cultivo.", "⚠️");
    return;
  }

  const record = {
    nombre,
    especie,
    num_arboles,
    anio_plantacion,
    hectareas
  };

  try {
    if (supabaseClient) {
      if (editId) {
        const { error } = await supabaseClient.from("variedades").update(record).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from("variedades").upsert(record, { onConflict: "nombre" });
        if (error) throw error;
      }
    } else {
      if (editId) {
        await dataUpdate("variedades", editId, record);
      } else {
        const existente = globalData.variedades.find(v => v.nombre.trim().toUpperCase() === nombre);
        if (existente) {
          await dataUpdate("variedades", existente.id, record);
        } else {
          await dataInsert("variedades", record);
        }
      }
    }

    // Guardar árboles en custom si aplica
    const customArboles = JSON.parse(localStorage.getItem("fundo_arboles_custom") || "{}");
    if (editId) customArboles[editId] = num_arboles;
    localStorage.setItem("fundo_arboles_custom", JSON.stringify(customArboles));
    localStorage.setItem("fundo_arboles_reales_iniciado", "true");

    cerrarDialog("modalVariedad");
    document.getElementById("formVariedad").reset();
    if (document.getElementById("varEditId")) document.getElementById("varEditId").value = "";

    mostrarToast(`¡Cultivo ${nombre} guardado con éxito!`, "🥑");
    await cargarVariedades();
    calcularYRenderizarDashboard();
  } catch (err) {
    console.error("Error al guardar variedad:", err);
    mostrarToast(`Error al guardar: ${err.message || err}`, "❌");
  }
}

// ================= LIMPIEZA COMPLETA DE BASE DE DATOS (EMPEZAR DE 0) =================
async function confirmarLimpiarBaseDeDatos() {
  const confirmacion = confirm(
    "⚠️ ¿DESEAS LIMPIAR LA BASE DE DATOS Y EMPEZAR DE CERO?\n\n" +
    "• Se borrarán todos los cultivos y variedades registradas.\n" +
    "• Se borrarán las ventas, tratamientos, gastos y jornales.\n" +
    "• El menú de cultivos quedará limpio para que agregues tus propias especies desde 0.\n\n" +
    "¿Confirmas que deseas reiniciar la base de datos?"
  );

  if (!confirmacion) return;

  mostrarToast("Limpiando base de datos...", "🧹");

  try {
    // 1. Si Supabase está conectado, borrar datos de tablas transaccionales y variedades
    if (supabaseClient) {
      const tablas = [
        "ventas",
        "tratamientos",
        "gastos_especificos",
        "gastos_generales",
        "jornales",
        "compras_productos",
        "variedades"
      ];
      for (const t of tablas) {
        try {
          await supabaseClient.from(t).delete().neq("id", 0);
        } catch (err) {
          console.warn(`Error limpiando tabla ${t} en Supabase:`, err);
        }
      }
    }

    // 2. Limpiar en backend local SQLite si existe
    try {
      await fetch("/api/variedades/limpiar-todo", { method: "POST" });
    } catch (e) {}

    // 3. Resetear memoria local
    localStorage.removeItem("fundo_arboles_custom");
    localStorage.removeItem("fundo_arboles_reales_iniciado");

    globalData.variedades = [];
    globalData.ventas = [];
    globalData.tratamientos = [];
    globalData.gastosEspecificos = [];
    globalData.gastosGenerales = [];
    globalData.jornales = [];
    globalData.compras = [];

    // 4. Recargar vista limpia
    await cargarTodosLosDatos();
    mostrarToast("¡Base de datos limpia! Lista para agregar tus especies desde cero.", "✨");
  } catch (err) {
    console.error("Error al limpiar base de datos:", err);
    mostrarToast("Error al limpiar: " + err.message, "❌");
  }
}

async function guardarParcela(e) {
  e.preventDefault();
  const editId = document.getElementById("parcEditId")?.value;
  const nombre = document.getElementById("parcNombre").value.trim();
  const haRaw = document.getElementById("parcHectareas").value;
  const hectareas = parseFloat(String(haRaw).replace(',', '.')) || 0;
  const tipo_tenencia = document.getElementById("parcTenencia").value;
  const propietario = document.getElementById("parcPropietario").value.trim();

  if (!nombre) {
    mostrarToast("Por favor ingresa el nombre del lote o arriendo", "⚠️");
    return;
  }

  const record = {
    nombre,
    hectareas,
    tipo_tenencia,
    propietario
  };

  try {
    if (editId) {
      if (supabaseClient) {
        const { error } = await supabaseClient.from("parcelas").update(record).eq("id", editId);
        if (error) throw error;
      } else {
        await dataUpdate("parcelas", editId, record);
      }
      mostrarToast(`Arriendo ${nombre} actualizado correctamente`, "🗺️");
    } else {
      if (supabaseClient) {
        const { error } = await supabaseClient.from("parcelas").insert([record]);
        if (error) throw error;
      } else {
        await dataInsert("parcelas", record);
      }
      mostrarToast(`Arriendo ${nombre} registrado con éxito`, "🗺️");
    }

    cerrarDialog("modalParcela");
    document.getElementById("formParcela").reset();
    if (document.getElementById("parcEditId")) document.getElementById("parcEditId").value = "";
    await cargarParcelas();
    calcularYRenderizarDashboard();
  } catch (err) {
    console.error("Error guardando arriendo/parcela:", err);
    mostrarToast(`Error: ${err.message || err}`, "❌");
  }
}

// Pestañas
function toggleJornalesTab(tab) {
  const dContent = document.getElementById("jornalesDiariosContent");
  const mContent = document.getElementById("jornalesMensualContent");
  const tabD = document.getElementById("tabJornalesDiarios");
  const tabM = document.getElementById("tabJornalesMensual");

  if (tab === "diarios") {
    dContent.classList.remove("hidden");
    mContent.classList.add("hidden");
    tabD.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white shadow-xs whitespace-nowrap";
    tabM.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 whitespace-nowrap";
  } else {
    dContent.classList.add("hidden");
    mContent.classList.remove("hidden");
    tabM.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white shadow-xs whitespace-nowrap";
    tabD.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 whitespace-nowrap";
    cargarMatrizMensualJornales();
  }
}

function toggleInsumosTab(tab) {
  const sContent = document.getElementById("insumosStockContent");
  const cContent = document.getElementById("insumosComprasContent");
  const tabS = document.getElementById("tabInsumosStock");
  const tabC = document.getElementById("tabInsumosCompras");

  if (tab === "stock") {
    sContent.classList.remove("hidden");
    cContent.classList.add("hidden");
    tabS.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white shadow-xs";
    tabC.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200";
  } else {
    sContent.classList.add("hidden");
    cContent.classList.remove("hidden");
    tabC.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white shadow-xs";
    tabS.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200";
  }
}

// Exportar CSV
function exportarTablaCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;

  let csv = [];
  const rows = table.querySelectorAll("tr");

  for (let i = 0; i < rows.length; i++) {
    let row = [];
    const cols = rows[i].querySelectorAll("td, th");
    for (let j = 0; j < cols.length; j++) {
      let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, " ").trim();
      data = data.replace(/"/g, '""');
      row.push(`"${data}"`);
    }
    csv.push(row.join(";"));
  }

  const csvFile = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
  const downloadLink = document.createElement("a");
  downloadLink.download = filename;
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  mostrarToast(`Archivo ${filename} descargado`, "📥");
}

// Backup & Restore
async function descargarBackup() {
  let backupData = {};
  const tables = ["parcelas", "variedades", "productos", "compras_productos",
                  "tratamientos", "ventas", "ingresos_financieros", "gastos_especificos",
                  "gastos_generales", "trabajadores", "jornales"];

  if (supabaseClient) {
    for (const t of tables) {
      const { data } = await supabaseClient.from(t).select("*");
      backupData[t] = data || [];
    }
  } else {
    const res = await fetch("/api/backup");
    const json = await res.json();
    backupData = json.data || {};
  }

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const dl = document.createElement("a");
  const fecha = new Date().toISOString().split("T")[0];
  dl.setAttribute("href", dataStr);
  dl.setAttribute("download", `Fundo_El_Castillo_Backup_${fecha}.json`);
  dl.click();

  mostrarToast("Copia de seguridad descargada", "💾");
}

function restaurarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!confirm("⚠️ ¿Deseas restaurar esta copia de seguridad?")) return;

      if (!supabaseClient) {
        const res = await fetch("/api/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success) {
          mostrarToast("Restauración completada", "✅");
          actualizarDatos();
        }
      } else {
        alert("Para restaurar en Supabase, usa el panel de Supabase o desconéctate temporalmente para restaurar en SQLite.");
      }
    } catch (err) {
      alert("Archivo JSON no válido.");
    }
  };
  reader.readAsText(file);
}

// Toast
function mostrarToast(mensaje, icon = "✅") {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toastMessage");
  const iconEl = document.getElementById("toastIcon");

  if (!toast || !msgEl) return;

  msgEl.textContent = mensaje;
  iconEl.textContent = icon;

  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}
