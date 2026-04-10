import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { flushSync } from "react-dom";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import {
  IconClipboardList,
  IconLayoutDashboard,
  IconMoon,
  IconPackage,
  IconPanelLeft,
  IconSun,
  IconTruck,
  IconUsers,
  IconWarehouse,
} from "../../icons";
import { API_V1_URL } from "../../shared/api/config";
import { etiquetaRol, puedeCambiarActivoCatalogo, puedeCrearEditar } from "../../shared/permissions";
import { parseSesion, SESSION_KEY, type Sesion } from "../../shared/session";
import type {
  CategoriaProductoOpt,
  EstadoUnidadMovilOpt,
  ModalEdicion,
  Paginacion,
  Producto,
  UnidadMedidaOpt,
  UnidadMovil,
  Vendedor,
} from "../../shared/types/catalogos";
import { FeedbackMessage, type FeedbackState } from "../../shared/ui/FeedbackMessage";
import { useTheme } from "../../theme";
import InventarioPage from "../inventario/InventarioPage";
import AbastecimientoDiarioPage from "../operaciones/AbastecimientoDiarioPage";
import { CampoActivoCatalogo } from "./CampoActivoCatalogo";

const SIDEBAR_KEY = "fastfood_sidebar_collapsed";
const LIMITE_PAGINA = 8;

function telefonoSoloDigitos(el: HTMLInputElement) {
  el.value = el.value.replace(/\D/g, "");
}

function fechaLocalYYYYMMDD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Alineado con validación Zod en `unidades-moviles.schemas.ts`. */
function validarFechasAsignacion(fechaIni: string, fechaFin: string): string | null {
  if (fechaFin && !fechaIni) {
    return "Si indicas fecha de fin de asignación, indica también la de inicio.";
  }
  if (fechaIni && fechaFin && fechaFin < fechaIni) {
    return "La fecha fin de asignación no puede ser anterior a la de inicio.";
  }
  return null;
}

export function PanelProtegido() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [unidades, setUnidades] = useState<UnidadMovil[]>([]);
  const [unidadesMedida, setUnidadesMedida] = useState<UnidadMedidaOpt[]>([]);
  const [categoriasProducto, setCategoriasProducto] = useState<CategoriaProductoOpt[]>([]);
  const [estadosUnidadMovil, setEstadosUnidadMovil] = useState<EstadoUnidadMovilOpt[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  /** Mensajes de validación / error solo del modal de edición (misma posición que el formulario). */
  const [feedbackModal, setFeedbackModal] = useState<FeedbackState | null>(null);
  const [cargando, setCargando] = useState(false);
  const [sesion, setSesion] = useState<Sesion | null>(() => parseSesion(sessionStorage.getItem(SESSION_KEY)));
  const [ahora, setAhora] = useState(new Date());
  const [modalEdicion, setModalEdicion] = useState<ModalEdicion>(null);
  const [menuColapsado, setMenuColapsado] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  });
  const [paginacionProductos, setPaginacionProductos] = useState<Paginacion>({
    pagina: 1,
    limite: LIMITE_PAGINA,
    total: 0,
    totalPaginas: 1,
  });
  const [paginacionVendedores, setPaginacionVendedores] = useState<Paginacion>({
    pagina: 1,
    limite: LIMITE_PAGINA,
    total: 0,
    totalPaginas: 1,
  });
  const [paginacionUnidades, setPaginacionUnidades] = useState<Paginacion>({
    pagina: 1,
    limite: LIMITE_PAGINA,
    total: 0,
    totalPaginas: 1,
  });

  const [formKeyProducto, setFormKeyProducto] = useState(0);
  const [formKeyVendedor, setFormKeyVendedor] = useState(0);
  const [formKeyUnidad, setFormKeyUnidad] = useState(0);

  function abrirModalEdicion(next: NonNullable<ModalEdicion>) {
    setFeedbackModal(null);
    setModalEdicion(next);
  }

  function cerrarModalEdicion() {
    setFeedbackModal(null);
    setModalEdicion(null);
  }

  const pagProdRef = useRef(paginacionProductos);
  const pagVendRef = useRef(paginacionVendedores);
  const pagUniRef = useRef(paginacionUnidades);

  useEffect(() => {
    pagProdRef.current = paginacionProductos;
  }, [paginacionProductos]);
  useEffect(() => {
    pagVendRef.current = paginacionVendedores;
  }, [paginacionVendedores]);
  useEffect(() => {
    pagUniRef.current = paginacionUnidades;
  }, [paginacionUnidades]);

  useEffect(() => {
    if (!sesion) navigate("/login", { replace: true });
  }, [navigate, sesion]);

  useEffect(() => {
    const timer = window.setInterval(() => setAhora(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  type CargarOpts = {
    productosPagina?: number;
    vendedoresPagina?: number;
    unidadesPagina?: number;
  };

  async function cargarDatos(opts?: CargarOpts) {
    setCargando(true);
    const pp = opts?.productosPagina ?? pagProdRef.current.pagina;
    const pv = opts?.vendedoresPagina ?? pagVendRef.current.pagina;
    const pu = opts?.unidadesPagina ?? pagUniRef.current.pagina;
    const limP = pagProdRef.current.limite;
    const limV = pagVendRef.current.limite;
    const limU = pagUniRef.current.limite;
    try {
      const qProd = `?pagina=${pp}&limite=${limP}`;
      const qVend = `?pagina=${pv}&limite=${limV}`;
      const qUni = `?pagina=${pu}&limite=${limU}`;
      const authH: Record<string, string> = {};
      const ses = parseSesion(sessionStorage.getItem(SESSION_KEY));
      if (ses?.token) authH.Authorization = `Bearer ${ses.token}`;
      const [rProd, rVend, rUni, rUm, rCat, rEst] = await Promise.all([
        fetch(`${API_V1_URL}/productos${qProd}`, { headers: authH }),
        fetch(`${API_V1_URL}/vendedores${qVend}`, { headers: authH }),
        fetch(`${API_V1_URL}/unidades-moviles${qUni}`, { headers: authH }),
        fetch(`${API_V1_URL}/unidades-medida`, { headers: authH }),
        fetch(`${API_V1_URL}/productos/categorias`, { headers: authH }),
        fetch(`${API_V1_URL}/unidades-moviles/estados`, { headers: authH }),
      ]);
      if (
        rProd.status === 401 ||
        rVend.status === 401 ||
        rUni.status === 401 ||
        rUm.status === 401 ||
        rCat.status === 401 ||
        rEst.status === 401
      ) {
        sessionStorage.removeItem(SESSION_KEY);
        setSesion(null);
        navigate("/login", { replace: true });
        return;
      }
      const jProd = await rProd.json();
      const jVend = await rVend.json();
      const jUni = await rUni.json();
      const jUm = await rUm.json();
      const jCat = await rCat.json();
      const jEst = await rEst.json();
      if (!rProd.ok) {
        setFeedback({
          tipo: "error",
          text: `Productos: ${String(jProd.error ?? jProd.message ?? rProd.status)}`,
        });
        return;
      }
      if (!rVend.ok) {
        setFeedback({
          tipo: "error",
          text: `Vendedores: ${String(jVend.error ?? jVend.message ?? rVend.status)}`,
        });
        return;
      }
      if (!rUni.ok) {
        setFeedback({
          tipo: "error",
          text: `Unidades: ${String(jUni.error ?? jUni.message ?? rUni.status)}`,
        });
        return;
      }
      if (!rCat.ok) {
        setFeedback({
          tipo: "error",
          text: `Categorías de producto: ${String(jCat.error ?? jCat.message ?? rCat.status)}`,
        });
        return;
      }
      if (!rEst.ok) {
        setFeedback({
          tipo: "error",
          text: `Estados de unidad móvil: ${String(jEst.error ?? jEst.message ?? rEst.status)}`,
        });
        return;
      }
      setProductos(jProd.data ?? []);
      setVendedores(jVend.data ?? []);
      setUnidades(jUni.data ?? []);
      if (jUm.ok && Array.isArray(jUm.data)) setUnidadesMedida(jUm.data);
      if (jCat.ok && Array.isArray(jCat.data)) setCategoriasProducto(jCat.data as CategoriaProductoOpt[]);
      if (jEst.ok && Array.isArray(jEst.data)) setEstadosUnidadMovil(jEst.data as EstadoUnidadMovilOpt[]);
      if (jProd.paginacion) setPaginacionProductos(jProd.paginacion);
      if (jVend.paginacion) setPaginacionVendedores(jVend.paginacion);
      if (jUni.paginacion) setPaginacionUnidades(jUni.paginacion);
    } catch {
      setFeedback({ tipo: "error", text: "No se pudo cargar datos. Verifica que el backend esté activo." });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (sesion) void cargarDatos();
  }, [sesion, paginacionProductos.pagina, paginacionVendedores.pagina, paginacionUnidades.pagina]);

  function alternarMenu() {
    setMenuColapsado((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  }

  function cerrarSesion() {
    sessionStorage.removeItem(SESSION_KEY);
    setSesion(null);
    navigate("/login", { replace: true });
  }

  type RespuestaApi = { ok: boolean; error?: string; data?: unknown; [key: string]: unknown };

  async function pedir(path: string, method: string, payload?: unknown): Promise<RespuestaApi> {
    try {
      const enviaJson = payload !== undefined;
      const headers: Record<string, string> = {};
      const s = parseSesion(sessionStorage.getItem(SESSION_KEY));
      if (s?.token) headers.Authorization = `Bearer ${s.token}`;
      if (enviaJson) headers["Content-Type"] = "application/json";
      const res = await fetch(`${API_V1_URL}${path}`, {
        method,
        headers,
        body: enviaJson ? JSON.stringify(payload) : undefined,
      });
      if (res.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        setSesion(null);
        navigate("/login", { replace: true });
        return { ok: false, error: "Sesion expirada. Vuelve a iniciar sesion." };
      }
      const text = await res.text();
      let body: RespuestaApi = { ok: false };
      if (text) {
        try {
          body = JSON.parse(text) as RespuestaApi;
        } catch {
          body = { ok: false, error: text.slice(0, 200) };
        }
      }
      if (!res.ok) {
        const msg =
          body.error ??
          (typeof body.message === "string" ? body.message : undefined) ??
          `HTTP ${res.status}`;
        return { ok: false, error: String(msg) };
      }
      if (!text.trim()) {
        return { ok: true };
      }
      return body;
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Error de red (¿backend en marcha?)",
      };
    }
  }

  async function crearProducto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const idUm = Number(form.get("idUnidadMedida"));
    const idCat = Number(form.get("idCategoria"));
    if (!Number.isFinite(idUm) || idUm < 1) {
      setFeedback({ tipo: "warning", text: "Selecciona una unidad de medida del catálogo." });
      return;
    }
    if (!Number.isFinite(idCat) || idCat < 1) {
      setFeedback({ tipo: "warning", text: "Selecciona una categoría de producto." });
      return;
    }
    const payload = {
      nombre: String(form.get("nombre") ?? "").trim(),
      idCategoria: idCat,
      idUnidadMedida: idUm,
      activo: true,
    };
    const json = await pedir("/productos", "POST", payload);
    const creado = json.data as { codigo?: string } | undefined;
    setFeedback(
      json.ok
        ? { tipo: "success", text: `Producto creado con código ${creado?.codigo ?? ""}.` }
        : { tipo: "error", text: json.error ?? "No se pudo crear el producto." },
    );
    if (json.ok) {
      flushSync(() => {
        setFormKeyProducto((k) => k + 1);
      });
      await cargarDatos({ productosPagina: 1 });
    }
  }

  async function crearVendedor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      nombreCompleto: String(form.get("nombreCompleto") ?? ""),
      documento: String(form.get("documento") ?? ""),
      telefono: String(form.get("telefono") ?? "").replace(/\D/g, ""),
      activo: true,
    };
    const json = await pedir("/vendedores", "POST", payload);
    setFeedback(
      json.ok
        ? { tipo: "success", text: "Vendedor creado." }
        : { tipo: "error", text: json.error ?? "No se pudo crear el vendedor." },
    );
    if (json.ok) {
      flushSync(() => {
        setFormKeyVendedor((k) => k + 1);
      });
      await cargarDatos({ vendedoresPagina: 1 });
    }
  }

  async function crearUnidad(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const placa = String(form.get("placa") ?? "").trim();
    const descripcion = String(form.get("descripcion") ?? "").trim();
    const idVendedor = String(form.get("idVendedor") ?? "").trim();
    const fechaIni = String(form.get("fechaInicioAsignacion") ?? "").trim();
    const fechaFin = String(form.get("fechaFinAsignacion") ?? "").trim();
    const idEst = Number(form.get("idEstadoOperativo"));
    if (!placa) {
      setFeedback({ tipo: "warning", text: "La placa del vehículo es obligatoria." });
      return;
    }
    if (!Number.isFinite(idEst) || idEst < 1) {
      setFeedback({ tipo: "warning", text: "Selecciona un estado operativo del catálogo." });
      return;
    }
    if (idVendedor && !fechaIni) {
      setFeedback({
        tipo: "warning",
        text: "Si asignas vendedor, indica la fecha de inicio de la asignación.",
      });
      return;
    }
    const msgFechas = validarFechasAsignacion(fechaIni, fechaFin);
    if (msgFechas) {
      setFeedback({ tipo: "warning", text: msgFechas });
      return;
    }
    const payload: Record<string, unknown> = {
      placa,
      descripcion: descripcion || null,
      idEstadoOperativo: idEst,
      idVendedor: idVendedor || null,
      activo: true,
    };
    if (idVendedor) {
      payload.fechaInicioAsignacion = fechaIni;
      if (fechaFin) payload.fechaFinAsignacion = fechaFin;
    }
    const json = await pedir("/unidades-moviles", "POST", payload);
    const unidadCreada = json.data as { codigo?: string } | undefined;
    setFeedback(
      json.ok
        ? { tipo: "success", text: `Unidad móvil creada con código ${unidadCreada?.codigo ?? ""}.` }
        : { tipo: "error", text: json.error ?? "No se pudo crear la unidad." },
    );
    if (json.ok) {
      flushSync(() => {
        setFormKeyUnidad((k) => k + 1);
      });
      await cargarDatos({ unidadesPagina: 1 });
    }
  }

  async function guardarEdicion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modalEdicion || !sesion) return;
    const form = new FormData(e.currentTarget);
    const adminPuedeActivo = puedeCambiarActivoCatalogo(sesion.rol);
    let json: { ok: boolean; error?: string };

    if (modalEdicion.kind === "producto") {
      const idUm = Number(form.get("idUnidadMedida"));
      const idCat = Number(form.get("idCategoria"));
      if (!Number.isFinite(idUm) || idUm < 1) {
        setFeedbackModal({ tipo: "warning", text: "Selecciona una unidad de medida del catálogo." });
        return;
      }
      if (!Number.isFinite(idCat) || idCat < 1) {
        setFeedbackModal({ tipo: "warning", text: "Selecciona una categoría de producto." });
        return;
      }
      const activo = adminPuedeActivo ? form.get("activo") === "on" : modalEdicion.item.activo;
      json = await pedir(`/productos/${modalEdicion.item.id}`, "PUT", {
        nombre: String(form.get("nombre") ?? "").trim(),
        idCategoria: idCat,
        idUnidadMedida: idUm,
        activo,
      });
    } else if (modalEdicion.kind === "vendedor") {
      const activo = adminPuedeActivo ? form.get("activo") === "on" : modalEdicion.item.activo;
      json = await pedir(`/vendedores/${modalEdicion.item.id}`, "PUT", {
        nombreCompleto: String(form.get("nombreCompleto") ?? ""),
        documento: String(form.get("documento") ?? ""),
        telefono: String(form.get("telefono") ?? "").replace(/\D/g, ""),
        activo,
      });
    } else {
      const placa = String(form.get("placa") ?? "").trim();
      const descripcion = String(form.get("descripcion") ?? "").trim();
      const idVendedor = String(form.get("idVendedor") ?? "").trim();
      const fechaIni = String(form.get("fechaInicioAsignacion") ?? "").trim();
      const fechaFin = String(form.get("fechaFinAsignacion") ?? "").trim();
      const idEst = Number(form.get("idEstadoOperativo"));
      if (!placa) {
        setFeedbackModal({ tipo: "warning", text: "La placa del vehículo es obligatoria." });
        return;
      }
      if (!Number.isFinite(idEst) || idEst < 1) {
        setFeedbackModal({ tipo: "warning", text: "Selecciona un estado operativo del catálogo." });
        return;
      }
      if (idVendedor && !fechaIni) {
        setFeedbackModal({
          tipo: "warning",
          text: "Si asignas vendedor, indica la fecha de inicio de la asignación.",
        });
        return;
      }
      const msgFechas = validarFechasAsignacion(fechaIni, fechaFin);
      if (msgFechas) {
        setFeedbackModal({ tipo: "warning", text: msgFechas });
        return;
      }
      const activo = adminPuedeActivo ? form.get("activo") === "on" : modalEdicion.item.activo;
      const body: Record<string, unknown> = {
        placa,
        descripcion: descripcion || null,
        idEstadoOperativo: idEst,
        idVendedor: idVendedor || null,
        activo,
      };
      if (idVendedor) {
        body.fechaInicioAsignacion = fechaIni;
        if (fechaFin) body.fechaFinAsignacion = fechaFin;
      }
      json = await pedir(`/unidades-moviles/${modalEdicion.item.id}`, "PUT", body);
    }

    if (json.ok) {
      setFeedback({ tipo: "success", text: "Registro actualizado." });
      cerrarModalEdicion();
      await cargarDatos();
    } else {
      setFeedbackModal({ tipo: "error", text: json.error ?? "No se pudo guardar." });
    }
  }

  const textoTurno = useMemo(() => {
    const h = ahora.getHours();
    return h >= 18 || h < 3 ? "Turno nocturno activo" : "Fuera de turno operativo";
  }, [ahora]);

  function cambiarPagina(
    modulo: "productos" | "vendedores" | "unidades",
    direccion: "anterior" | "siguiente",
  ) {
    const delta = direccion === "siguiente" ? 1 : -1;
    if (modulo === "productos") {
      setPaginacionProductos((prev) => ({
        ...prev,
        pagina: Math.max(1, Math.min(prev.totalPaginas, prev.pagina + delta)),
      }));
      return;
    }
    if (modulo === "vendedores") {
      setPaginacionVendedores((prev) => ({
        ...prev,
        pagina: Math.max(1, Math.min(prev.totalPaginas, prev.pagina + delta)),
      }));
      return;
    }
    setPaginacionUnidades((prev) => ({
      ...prev,
      pagina: Math.max(1, Math.min(prev.totalPaginas, prev.pagina + delta)),
    }));
  }

  if (!sesion) return <Navigate to="/login" replace />;

  const crearEditar = puedeCrearEditar(sesion.rol);
  const puedeEditarEstadoCatalogo = puedeCambiarActivoCatalogo(sesion.rol);

  return (
    <main
      className={`layout ${menuColapsado ? "layout--sidebar-collapsed" : ""}`}
      aria-busy={cargando}
    >
      <aside className="sidebar" aria-label="Navegacion principal">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <span className="brand-mark" title="FAST FOOD S.A.">
              FF
            </span>
            {!menuColapsado ? (
              <div className="sidebar-brand-text">
                <strong>FAST FOOD</strong>
                <span>Abastecimiento</span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={`sidebar-toggle ${menuColapsado ? "sidebar-toggle--collapsed" : ""}`}
            onClick={alternarMenu}
            title={menuColapsado ? "Expandir menu" : "Contraer menu"}
            aria-expanded={!menuColapsado}
          >
            <IconPanelLeft />
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/resumen" className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`}>
            <IconLayoutDashboard className="sidebar-link-icon" />
            <span className="sidebar-label">Resumen</span>
          </NavLink>
          <NavLink to="/productos" className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`}>
            <IconPackage className="sidebar-link-icon" />
            <span className="sidebar-label">Productos</span>
          </NavLink>
          <NavLink to="/vendedores" className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`}>
            <IconUsers className="sidebar-link-icon" />
            <span className="sidebar-label">Vendedores</span>
          </NavLink>
          <NavLink to="/unidades" className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`}>
            <IconTruck className="sidebar-link-icon" />
            <span className="sidebar-label">Unidades</span>
          </NavLink>
          <NavLink to="/inventario" className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`}>
            <IconWarehouse className="sidebar-link-icon" />
            <span className="sidebar-label">Inventario</span>
          </NavLink>
          <NavLink
            to="/abastecimiento"
            className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`}
          >
            <IconClipboardList className="sidebar-link-icon" />
            <span className="sidebar-label">Abastecimiento</span>
          </NavLink>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h2>Centro de operaciones</h2>
            <p className="topbar-meta">
              {sesion.nombreCompleto} ({sesion.nombreUsuario}) · {etiquetaRol(sesion.rol)}
            </p>
            <p className="topbar-time">{ahora.toLocaleString("es-BO")} · {textoTurno}</p>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={toggleTheme}
              title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
            >
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
            <button type="button" className="danger" onClick={cerrarSesion}>
              Salir
            </button>
          </div>
        </header>

        {!modalEdicion ? <FeedbackMessage feedback={feedback} /> : null}

        <Routes>
          <Route
            path="/resumen"
            element={
              <article className="card">
                <h2>Resumen ejecutivo</h2>
                <p className="subtle">
                  Vista consolidada de productos, personal, unidades móviles e inventario del almacén central. Los
                  indicadores reflejan la página actual de cada listado; use el menú lateral para administrar el detalle.
                </p>
                <section className="kpis">
                  <article><h3>{productos.length}</h3><p>Productos registrados</p></article>
                  <article><h3>{vendedores.length}</h3><p>Vendedores habilitados</p></article>
                  <article><h3>{unidades.length}</h3><p>Unidades móviles en la página actual</p></article>
                </section>
              </article>
            }
          />
          <Route
            path="/productos"
            element={
              <article className="card">
                <h2>Gestión de productos</h2>
                <p className="subtle">
                  Administra el catalogo comercial para abastecimiento y despacho. El codigo se genera en el servidor
                  (secuencia P001, P002, …). Categoria y unidad de medida salen de catalogos en base de datos (nuevas
                  categorias no requieren cambiar el codigo de la aplicacion).
                </p>
                {crearEditar ? (
                  <form key={formKeyProducto} className="form-grid form-jornada-nueva" onSubmit={crearProducto}>
                    <h3 className="form-section-title" style={{ gridColumn: "1 / -1" }}>
                      Nuevo producto
                    </h3>
                    <p className="subtle" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
                      Campos con <span className="req-mark">*</span> obligatorios. El código comercial lo asigna el sistema
                      (P001, P002, …).
                    </p>
                    <div className="form-field-block">
                      <label htmlFor="cat-prod-nombre">
                        Nombre <span className="req-mark">*</span>
                      </label>
                      <p className="form-field-hint">Denominación en catálogo, inventario y abastecimiento.</p>
                      <input id="cat-prod-nombre" name="nombre" required />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="cat-prod-categoria">
                        Categoría <span className="req-mark">*</span>
                      </label>
                      <p className="form-field-hint">Clasificación comercial (catálogo en base de datos).</p>
                      <select
                        id="cat-prod-categoria"
                        name="idCategoria"
                        required
                        defaultValue={categoriasProducto[0]?.id ?? ""}
                      >
                        {categoriasProducto.length === 0 ? (
                          <option value="">Cargando categorías…</option>
                        ) : (
                          categoriasProducto.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="cat-prod-um">
                        Unidad de medida <span className="req-mark">*</span>
                      </label>
                      <p className="form-field-hint">Cómo se cuantifica el producto (kg, unidad, etc.).</p>
                      <select
                        id="cat-prod-um"
                        name="idUnidadMedida"
                        required
                        defaultValue={unidadesMedida[0]?.id ?? ""}
                      >
                        {unidadesMedida.length === 0 ? (
                          <option value="">Cargando unidades…</option>
                        ) : (
                          unidadesMedida.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nombre} ({u.codigo})
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <button
                      type="submit"
                      style={{ gridColumn: "1 / -1" }}
                      disabled={unidadesMedida.length === 0 || categoriasProducto.length === 0}
                    >
                      Crear producto
                    </button>
                  </form>
                ) : (
                  <p className="subtle">Tu rol solo permite consultar este catalogo.</p>
                )}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Codigo</th>
                        <th>Nombre</th>
                        <th>Categoria</th>
                        <th>Unidad</th>
                        <th>Estado</th>
                        {crearEditar ? <th>Acciones</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((p) => (
                        <tr key={p.id} className={!p.activo ? "fila-catalogo-inactiva" : undefined}>
                          <td>{p.codigo}</td><td>{p.nombre}</td><td>{p.categoriaNombre}</td><td>{p.unidadMedida}</td><td>{p.activo ? "Activo" : "Inactivo"}</td>
                          {crearEditar ? (
                            <td className="row-actions">
                              <button type="button" onClick={() => abrirModalEdicion({ kind: "producto", item: p })}>Editar</button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="paginacion">
                  <span>
                    Pagina {paginacionProductos.pagina} de {paginacionProductos.totalPaginas} · Total {paginacionProductos.total}
                  </span>
                  <div className="paginacion-acciones">
                    <button
                      type="button"
                      className="btn-paginacion"
                      disabled={paginacionProductos.pagina <= 1}
                      onClick={() => cambiarPagina("productos", "anterior")}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      className="btn-paginacion"
                      disabled={paginacionProductos.pagina >= paginacionProductos.totalPaginas}
                      onClick={() => cambiarPagina("productos", "siguiente")}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </article>
            }
          />
          <Route path="/inventario" element={<InventarioPage sesion={sesion} />} />
          <Route path="/abastecimiento" element={<AbastecimientoDiarioPage sesion={sesion} />} />
          <Route
            path="/vendedores"
            element={
              <article className="card">
                <h2>Gestión de vendedores</h2>
                <p className="subtle">Mantiene el personal habilitado para operar unidades móviles.</p>
                {crearEditar ? (
                  <form key={formKeyVendedor} className="form-grid form-jornada-nueva" onSubmit={crearVendedor}>
                    <h3 className="form-section-title" style={{ gridColumn: "1 / -1" }}>
                      Nuevo vendedor
                    </h3>
                    <p className="subtle" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
                      Campos con <span className="req-mark">*</span> obligatorios. El teléfono solo admite dígitos (7–15).
                    </p>
                    <div className="form-field-block">
                      <label htmlFor="cat-vend-nombre">
                        Nombre completo <span className="req-mark">*</span>
                      </label>
                      <p className="form-field-hint">Identificación en listados y asignación a unidades.</p>
                      <input id="cat-vend-nombre" name="nombreCompleto" required />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="cat-vend-doc">
                        Documento de identidad <span className="req-mark">*</span>
                      </label>
                      <p className="form-field-hint">CI u otro documento; debe ser único en el sistema.</p>
                      <input id="cat-vend-doc" name="documento" required />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="cat-vend-tel">
                        Teléfono <span className="req-mark">*</span>
                      </label>
                      <p className="form-field-hint">Solo números, sin espacios ni guiones.</p>
                      <input
                        id="cat-vend-tel"
                        name="telefono"
                        required
                        inputMode="numeric"
                        autoComplete="tel"
                        pattern="[0-9]*"
                        minLength={7}
                        maxLength={15}
                        title="Solo números, entre 7 y 15 dígitos"
                        onInput={(ev) => telefonoSoloDigitos(ev.currentTarget)}
                      />
                    </div>
                    <button type="submit" style={{ gridColumn: "1 / -1" }}>
                      Crear vendedor
                    </button>
                  </form>
                ) : (
                  <p className="subtle">Tu rol solo permite consultar este catalogo.</p>
                )}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Documento</th>
                        <th>Telefono</th>
                        <th>Estado</th>
                        {crearEditar ? <th>Acciones</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {vendedores.map((v) => (
                        <tr key={v.id} className={!v.activo ? "fila-catalogo-inactiva" : undefined}>
                          <td>{v.nombreCompleto}</td><td>{v.documento}</td><td>{v.telefono}</td><td>{v.activo ? "Activo" : "Inactivo"}</td>
                          {crearEditar ? (
                            <td className="row-actions">
                              <button type="button" onClick={() => abrirModalEdicion({ kind: "vendedor", item: v })}>Editar</button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="paginacion">
                  <span>
                    Pagina {paginacionVendedores.pagina} de {paginacionVendedores.totalPaginas} · Total {paginacionVendedores.total}
                  </span>
                  <div className="paginacion-acciones">
                    <button
                      type="button"
                      className="btn-paginacion"
                      disabled={paginacionVendedores.pagina <= 1}
                      onClick={() => cambiarPagina("vendedores", "anterior")}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      className="btn-paginacion"
                      disabled={paginacionVendedores.pagina >= paginacionVendedores.totalPaginas}
                      onClick={() => cambiarPagina("vendedores", "siguiente")}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </article>
            }
          />
          <Route
            path="/unidades"
            element={
              <article className="card">
                <h2>Gestión de unidades móviles</h2>
                <p className="subtle">
                  La <strong>zona de operación</strong> de cada salida se elige al <strong>planificar la jornada</strong> en
                  Abastecimiento (tabla <code>jornada</code>, <code>id_zona</code>). Aquí registras <strong>placa</strong>{" "}
                  (obligatoria), descripción opcional, estado y vendedor. El código UM-01… lo asigna el sistema.
                </p>
                {crearEditar ? (
                  <form key={formKeyUnidad} className="form-grid form-jornada-nueva" onSubmit={crearUnidad}>
                    <h3 className="form-section-title" style={{ gridColumn: "1 / -1" }}>
                      Nueva unidad móvil
                    </h3>
                    <p className="subtle" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
                      <span className="req-mark">*</span> obligatorio. Con vendedor: fecha de inicio obligatoria; fin
                      opcional y no puede ser anterior al inicio.
                    </p>
                    <div className="form-field-block">
                      <label htmlFor="cat-uni-placa">
                        Placa <span className="req-mark">*</span>
                      </label>
                      <p className="form-field-hint">Identificación vehicular del móvil (máx. 20 caracteres).</p>
                      <input id="cat-uni-placa" name="placa" maxLength={20} required />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="cat-uni-desc">Descripción</label>
                      <p className="form-field-hint">Notas internas opcionales.</p>
                      <input id="cat-uni-desc" name="descripcion" maxLength={255} />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="cat-uni-estado">
                        Estado operativo <span className="req-mark">*</span>
                      </label>
                      <p className="form-field-hint">Situación en calle (catálogo: disponible, mantenimiento, etc.).</p>
                      <select
                        id="cat-uni-estado"
                        name="idEstadoOperativo"
                        required
                        defaultValue={estadosUnidadMovil[0]?.id ?? ""}
                      >
                        {estadosUnidadMovil.length === 0 ? (
                          <option value="">Cargando estados…</option>
                        ) : (
                          estadosUnidadMovil.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nombre}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="cat-uni-vend">Vendedor asignado</label>
                      <p className="form-field-hint">Opcional. Si eliges vendedor, completa al menos la fecha de inicio.</p>
                      <select id="cat-uni-vend" name="idVendedor" defaultValue="">
                        <option value="">Sin vendedor</option>
                        {vendedores.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.nombreCompleto}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="cat-uni-a-ini">Inicio asignación vendedor</label>
                      <p className="form-field-hint">Obligatoria si hay vendedor.</p>
                      <input
                        id="cat-uni-a-ini"
                        name="fechaInicioAsignacion"
                        type="date"
                        defaultValue={fechaLocalYYYYMMDD()}
                      />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="cat-uni-a-fin">Fin asignación vendedor</label>
                      <p className="form-field-hint">Opcional; vacío = vigente. No puede ser anterior al inicio.</p>
                      <input id="cat-uni-a-fin" name="fechaFinAsignacion" type="date" />
                    </div>
                    <button
                      type="submit"
                      style={{ gridColumn: "1 / -1" }}
                      disabled={estadosUnidadMovil.length === 0}
                    >
                      Crear unidad
                    </button>
                  </form>
                ) : (
                  <p className="subtle">Tu rol solo permite consultar este catalogo.</p>
                )}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Codigo</th>
                        <th>Placa</th>
                        <th>Descripción</th>
                        <th>Estado</th>
                        <th>Vendedor</th>
                        <th>Catálogo</th>
                        {crearEditar ? <th>Acciones</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {unidades.map((u) => (
                        <tr key={u.id} className={!u.activo ? "fila-catalogo-inactiva" : undefined}>
                          <td>{u.codigo}</td>
                          <td>{u.placa}</td>
                          <td className="subtle">{u.descripcion ?? "—"}</td>
                          <td>{u.estadoNombre}</td>
                          <td>{u.idVendedor ? vendedores.find((v) => v.id === u.idVendedor)?.nombreCompleto ?? "Asignado" : "Sin vendedor"}</td>
                          <td>{u.activo ? "Activa" : "Inactiva"}</td>
                          {crearEditar ? (
                            <td className="row-actions">
                              <button type="button" onClick={() => abrirModalEdicion({ kind: "unidad", item: u })}>Editar</button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="paginacion">
                  <span>
                    Pagina {paginacionUnidades.pagina} de {paginacionUnidades.totalPaginas} · Total {paginacionUnidades.total}
                  </span>
                  <div className="paginacion-acciones">
                    <button
                      type="button"
                      className="btn-paginacion"
                      disabled={paginacionUnidades.pagina <= 1}
                      onClick={() => cambiarPagina("unidades", "anterior")}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      className="btn-paginacion"
                      disabled={paginacionUnidades.pagina >= paginacionUnidades.totalPaginas}
                      onClick={() => cambiarPagina("unidades", "siguiente")}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </article>
            }
          />
          <Route path="*" element={<Navigate to="/resumen" replace />} />
        </Routes>
      </section>

      {modalEdicion ? (
        <section className="modal-overlay" onClick={cerrarModalEdicion}>
          <article className="modal-card" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>
                {modalEdicion.kind === "producto" && "Editar producto"}
                {modalEdicion.kind === "vendedor" && "Editar vendedor"}
                {modalEdicion.kind === "unidad" && "Editar unidad móvil"}
              </h3>
              <p className="modal-subtitle">Actualiza la informacion y guarda los cambios.</p>
            </header>
            <form
              className="modal-form"
              key={
                modalEdicion
                  ? `${modalEdicion.kind}-${modalEdicion.kind === "producto" ? modalEdicion.item.id : modalEdicion.kind === "vendedor" ? modalEdicion.item.id : modalEdicion.item.id}`
                  : "cerrado"
              }
              onSubmit={guardarEdicion}
            >
              <FeedbackMessage feedback={feedbackModal} className="modal-inline-feedback" />
              <div className="modal-body modal-body--form-fields">
                <p className="subtle" style={{ margin: 0, fontSize: "0.82rem" }}>
                  <span className="req-mark">*</span> obligatorio. Los cambios se reflejan al guardar.
                </p>
                {modalEdicion.kind === "producto" ? (
                  <>
                    <div className="form-field-block">
                      <label htmlFor="mod-prod-cod">Código</label>
                      <p className="form-field-hint">Generado por el sistema; no editable.</p>
                      <input
                        id="mod-prod-cod"
                        readOnly
                        value={modalEdicion.item.codigo}
                        className="input-readonly"
                        aria-readonly="true"
                      />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="mod-prod-nombre">
                        Nombre <span className="req-mark">*</span>
                      </label>
                      <input id="mod-prod-nombre" name="nombre" defaultValue={modalEdicion.item.nombre} required />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="mod-prod-cat">
                        Categoría <span className="req-mark">*</span>
                      </label>
                      <select
                        id="mod-prod-cat"
                        name="idCategoria"
                        required
                        defaultValue={String(modalEdicion.item.idCategoria)}
                      >
                        {categoriasProducto.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="mod-prod-um">
                        Unidad de medida <span className="req-mark">*</span>
                      </label>
                      <select
                        id="mod-prod-um"
                        name="idUnidadMedida"
                        required
                        defaultValue={String(modalEdicion.item.idUnidadMedida)}
                      >
                        {unidadesMedida.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre} ({u.codigo})
                          </option>
                        ))}
                      </select>
                    </div>
                    <CampoActivoCatalogo
                      activo={modalEdicion.item.activo}
                      puedeEditarEstado={puedeEditarEstadoCatalogo}
                    />
                  </>
                ) : null}
                {modalEdicion.kind === "vendedor" ? (
                  <>
                    <div className="form-field-block">
                      <label htmlFor="mod-vend-nombre">
                        Nombre completo <span className="req-mark">*</span>
                      </label>
                      <input
                        id="mod-vend-nombre"
                        name="nombreCompleto"
                        defaultValue={modalEdicion.item.nombreCompleto}
                        required
                      />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="mod-vend-doc">
                        Documento <span className="req-mark">*</span>
                      </label>
                      <input id="mod-vend-doc" name="documento" defaultValue={modalEdicion.item.documento} required />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="mod-vend-tel">
                        Teléfono <span className="req-mark">*</span>
                      </label>
                      <input
                        id="mod-vend-tel"
                        name="telefono"
                        defaultValue={modalEdicion.item.telefono.replace(/\D/g, "")}
                        required
                        inputMode="numeric"
                        autoComplete="tel"
                        pattern="[0-9]*"
                        minLength={7}
                        maxLength={15}
                        title="Solo números, entre 7 y 15 dígitos"
                        onInput={(ev) => telefonoSoloDigitos(ev.currentTarget)}
                      />
                    </div>
                    <CampoActivoCatalogo
                      activo={modalEdicion.item.activo}
                      puedeEditarEstado={puedeEditarEstadoCatalogo}
                    />
                  </>
                ) : null}
                {modalEdicion.kind === "unidad" ? (
                  <>
                    <div className="form-field-block">
                      <label>Código asignado</label>
                      <p className="form-field-hint">
                        <strong>{modalEdicion.item.codigo}</strong> — no se puede cambiar.
                      </p>
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="mod-uni-placa">
                        Placa <span className="req-mark">*</span>
                      </label>
                      <input
                        id="mod-uni-placa"
                        name="placa"
                        defaultValue={modalEdicion.item.placa}
                        maxLength={20}
                        required
                      />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="mod-uni-desc">Descripción</label>
                      <input
                        id="mod-uni-desc"
                        name="descripcion"
                        defaultValue={modalEdicion.item.descripcion ?? ""}
                        maxLength={255}
                      />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="mod-uni-estado">
                        Estado operativo <span className="req-mark">*</span>
                      </label>
                      <select
                        id="mod-uni-estado"
                        name="idEstadoOperativo"
                        required
                        defaultValue={String(modalEdicion.item.idEstadoOperativo)}
                      >
                        {estadosUnidadMovil.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="mod-uni-vend">Vendedor</label>
                      <p className="form-field-hint">Opcional. Con vendedor, fecha inicio obligatoria.</p>
                      <select id="mod-uni-vend" name="idVendedor" defaultValue={modalEdicion.item.idVendedor ?? ""}>
                        <option value="">Sin vendedor</option>
                        {vendedores.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.nombreCompleto}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="mod-uni-a-ini">Inicio asignación</label>
                      <input
                        id="mod-uni-a-ini"
                        name="fechaInicioAsignacion"
                        type="date"
                        defaultValue={modalEdicion.item.asignacionFechaInicio ?? fechaLocalYYYYMMDD()}
                      />
                    </div>
                    <div className="form-field-block">
                      <label htmlFor="mod-uni-a-fin">Fin asignación</label>
                      <p className="form-field-hint">Opcional; si la completas, no puede ser anterior a la fecha de inicio.</p>
                      <input
                        id="mod-uni-a-fin"
                        name="fechaFinAsignacion"
                        type="date"
                        defaultValue={modalEdicion.item.asignacionFechaFin ?? ""}
                      />
                    </div>
                    <CampoActivoCatalogo
                      activo={modalEdicion.item.activo}
                      puedeEditarEstado={puedeEditarEstadoCatalogo}
                    />
                  </>
                ) : null}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secundario-modal" onClick={cerrarModalEdicion}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primario-modal">
                  Guardar cambios
                </button>
              </div>
            </form>
          </article>
        </section>
      ) : null}
    </main>
  );
}
