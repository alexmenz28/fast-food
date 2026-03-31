import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import {
  IconLayoutDashboard,
  IconMoon,
  IconPackage,
  IconPanelLeft,
  IconSun,
  IconTruck,
  IconUsers,
} from "./icons";
import { useTheme } from "./theme";
import "./App.css";

type Producto = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "ALIMENTO" | "BEBIDA" | "INSUMO";
  unidadMedida: string;
  activo: boolean;
};

type Vendedor = {
  id: string;
  nombreCompleto: string;
  documento: string;
  telefono: string;
  activo: boolean;
};

type UnidadMovil = {
  id: string;
  codigo: string;
  zona: string;
  estado: "ACTIVA" | "MANTENIMIENTO" | "FUERA_DE_SERVICIO";
  idVendedor: string | null;
  activo: boolean;
};

type SesionMock = {
  nombre: string;
  rol: "ADMINISTRADOR" | "ALMACEN" | "SUPERVISOR";
};

type Paginacion = {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
};

type ModalEdicion =
  | { kind: "producto"; item: Producto }
  | { kind: "vendedor"; item: Vendedor }
  | { kind: "unidad"; item: UnidadMovil }
  | null;

type ModalEliminacion =
  | { kind: "producto"; id: string; etiqueta: string }
  | { kind: "vendedor"; id: string; etiqueta: string }
  | { kind: "unidad"; id: string; etiqueta: string }
  | null;

const API_URL = "http://localhost:3000";
const SESSION_KEY = "fastfood_mock_session";
const SIDEBAR_KEY = "fastfood_sidebar_collapsed";
const LIMITE_PAGINA = 8;

function etiquetaRol(rol: SesionMock["rol"]) {
  if (rol === "ADMINISTRADOR") return "Administrador";
  if (rol === "ALMACEN") return "Encargado de almacen";
  return "Supervisor de operaciones";
}

function etiquetaTipoProducto(tipo: Producto["tipo"]) {
  if (tipo === "ALIMENTO") return "Alimento";
  if (tipo === "BEBIDA") return "Bebida";
  return "Insumo";
}

function etiquetaEstadoUnidad(estado: UnidadMovil["estado"]) {
  if (estado === "ACTIVA") return "Activa";
  if (estado === "MANTENIMIENTO") return "Mantenimiento";
  return "Fuera de servicio";
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<PanelProtegido />} />
    </Routes>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) navigate("/resumen", { replace: true });
  }, [navigate]);

  function iniciarSesionMock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nombre = String(form.get("nombre") ?? "").trim();
    const rol = String(form.get("rol") ?? "ALMACEN") as SesionMock["rol"];
    if (!nombre) {
      setMensaje("Ingresa un nombre para continuar.");
      return;
    }
    const sesion: SesionMock = { nombre, rol };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
    navigate("/resumen", { replace: true });
  }

  return (
    <main className="auth-screen">
      <button
        type="button"
        className="theme-toggle theme-toggle--floating"
        onClick={toggleTheme}
        title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        aria-label="Alternar tema"
      >
        {theme === "dark" ? <IconSun /> : <IconMoon />}
      </button>
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">FF</span>
          <div>
            <h1>FAST FOOD S.A.</h1>
            <p className="auth-tagline">Abastecimiento · Unidades moviles</p>
          </div>
        </div>
        <p className="auth-lead">Sistema de gestion de abastecimiento</p>
        <form onSubmit={iniciarSesionMock}>
          <input name="nombre" placeholder="Usuario" required />
          <input name="password" type="password" placeholder="Contrasena" required />
          <select name="rol" defaultValue="ALMACEN">
            <option value="ADMINISTRADOR">Administrador</option>
            <option value="ALMACEN">Encargado de almacen</option>
            <option value="SUPERVISOR">Supervisor</option>
          </select>
          <button type="submit">Ingresar</button>
        </form>
        <small>Entorno de demostracion para validacion funcional.</small>
        {mensaje ? <p className="message">{mensaje}</p> : null}
      </section>
    </main>
  );
}

function PanelProtegido() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [unidades, setUnidades] = useState<UnidadMovil[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [sesion, setSesion] = useState<SesionMock | null>(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    return saved ? (JSON.parse(saved) as SesionMock) : null;
  });
  const [ahora, setAhora] = useState(new Date());
  const [modalEdicion, setModalEdicion] = useState<ModalEdicion>(null);
  const [modalEliminacion, setModalEliminacion] = useState<ModalEliminacion>(null);
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

  useEffect(() => {
    if (!sesion) navigate("/login", { replace: true });
  }, [navigate, sesion]);

  useEffect(() => {
    const timer = window.setInterval(() => setAhora(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function cargarDatos() {
    setCargando(true);
    try {
      const qProd = `?pagina=${paginacionProductos.pagina}&limite=${paginacionProductos.limite}`;
      const qVend = `?pagina=${paginacionVendedores.pagina}&limite=${paginacionVendedores.limite}`;
      const qUni = `?pagina=${paginacionUnidades.pagina}&limite=${paginacionUnidades.limite}`;
      const [rProd, rVend, rUni] = await Promise.all([
        fetch(`${API_URL}/productos${qProd}`),
        fetch(`${API_URL}/vendedores${qVend}`),
        fetch(`${API_URL}/unidades-moviles${qUni}`),
      ]);
      const jProd = await rProd.json();
      const jVend = await rVend.json();
      const jUni = await rUni.json();
      setProductos(jProd.data ?? []);
      setVendedores(jVend.data ?? []);
      setUnidades(jUni.data ?? []);
      if (jProd.paginacion) setPaginacionProductos(jProd.paginacion);
      if (jVend.paginacion) setPaginacionVendedores(jVend.paginacion);
      if (jUni.paginacion) setPaginacionUnidades(jUni.paginacion);
    } catch {
      setMensaje("No se pudo cargar datos. Verifica que backend este activo.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (sesion) cargarDatos();
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

  async function pedir(path: string, method: string, payload?: unknown) {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return res.json();
  }

  async function crearProducto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      codigo: String(form.get("codigo") ?? ""),
      nombre: String(form.get("nombre") ?? ""),
      tipo: String(form.get("tipo") ?? "ALIMENTO"),
      unidadMedida: String(form.get("unidadMedida") ?? ""),
      activo: true,
    };
    const json = await pedir("/productos", "POST", payload);
    setMensaje(json.ok ? "Producto creado." : `Error: ${json.error}`);
    if (json.ok) {
      e.currentTarget.reset();
      cargarDatos();
    }
  }

  async function crearVendedor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      nombreCompleto: String(form.get("nombreCompleto") ?? ""),
      documento: String(form.get("documento") ?? ""),
      telefono: String(form.get("telefono") ?? ""),
      activo: true,
    };
    const json = await pedir("/vendedores", "POST", payload);
    setMensaje(json.ok ? "Vendedor creado." : `Error: ${json.error}`);
    if (json.ok) {
      e.currentTarget.reset();
      cargarDatos();
    }
  }

  async function crearUnidad(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const idVendedor = String(form.get("idVendedor") ?? "");
    const payload = {
      codigo: String(form.get("codigo") ?? ""),
      zona: String(form.get("zona") ?? ""),
      estado: String(form.get("estado") ?? "ACTIVA"),
      idVendedor: idVendedor ? idVendedor : null,
      activo: true,
    };
    const json = await pedir("/unidades-moviles", "POST", payload);
    setMensaje(json.ok ? "Unidad movil creada." : `Error: ${json.error}`);
    if (json.ok) {
      e.currentTarget.reset();
      cargarDatos();
    }
  }

  async function eliminarProducto(id: string) {
    const json = await pedir(`/productos/${id}`, "DELETE");
    setMensaje(json.ok ? "Producto eliminado." : `Error: ${json.error}`);
    if (json.ok) cargarDatos();
  }

  async function eliminarVendedor(id: string) {
    const json = await pedir(`/vendedores/${id}`, "DELETE");
    setMensaje(json.ok ? "Vendedor eliminado." : `Error: ${json.error}`);
    if (json.ok) cargarDatos();
  }

  async function eliminarUnidad(id: string) {
    const json = await pedir(`/unidades-moviles/${id}`, "DELETE");
    setMensaje(json.ok ? "Unidad movil eliminada." : `Error: ${json.error}`);
    if (json.ok) cargarDatos();
  }

  async function guardarEdicion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modalEdicion) return;
    const form = new FormData(e.currentTarget);
    let json: { ok: boolean; error?: string };

    if (modalEdicion.kind === "producto") {
      json = await pedir(`/productos/${modalEdicion.item.id}`, "PUT", {
        codigo: String(form.get("codigo") ?? ""),
        nombre: String(form.get("nombre") ?? ""),
        tipo: String(form.get("tipo") ?? "ALIMENTO"),
        unidadMedida: String(form.get("unidadMedida") ?? ""),
        activo: form.get("activo") === "on",
      });
    } else if (modalEdicion.kind === "vendedor") {
      json = await pedir(`/vendedores/${modalEdicion.item.id}`, "PUT", {
        nombreCompleto: String(form.get("nombreCompleto") ?? ""),
        documento: String(form.get("documento") ?? ""),
        telefono: String(form.get("telefono") ?? ""),
        activo: form.get("activo") === "on",
      });
    } else {
      const idVendedor = String(form.get("idVendedor") ?? "");
      json = await pedir(`/unidades-moviles/${modalEdicion.item.id}`, "PUT", {
        codigo: String(form.get("codigo") ?? ""),
        zona: String(form.get("zona") ?? ""),
        estado: String(form.get("estado") ?? "ACTIVA"),
        idVendedor: idVendedor ? idVendedor : null,
        activo: form.get("activo") === "on",
      });
    }

    setMensaje(json.ok ? "Registro actualizado." : `Error: ${json.error}`);
    if (json.ok) {
      setModalEdicion(null);
      cargarDatos();
    }
  }

  async function confirmarEliminacion() {
    if (!modalEliminacion) return;
    if (modalEliminacion.kind === "producto") await eliminarProducto(modalEliminacion.id);
    if (modalEliminacion.kind === "vendedor") await eliminarVendedor(modalEliminacion.id);
    if (modalEliminacion.kind === "unidad") await eliminarUnidad(modalEliminacion.id);
    setModalEliminacion(null);
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

  return (
    <main className={`layout ${menuColapsado ? "layout--sidebar-collapsed" : ""}`}>
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
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h2>Centro de operaciones de abastecimiento</h2>
            <p className="topbar-meta">{sesion.nombre} · {etiquetaRol(sesion.rol)}</p>
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
            <button className="btn-secondary" onClick={cargarDatos} disabled={cargando} type="button">
              {cargando ? "Cargando..." : "Sincronizar"}
            </button>
            <button type="button" className="danger" onClick={cerrarSesion}>
              Salir
            </button>
          </div>
        </header>

        {mensaje ? <p className="message">{mensaje}</p> : null}

        <Routes>
          <Route
            path="/resumen"
            element={
              <article className="card">
                <h2>Resumen ejecutivo</h2>
                <p className="subtle">Vista consolidada del estado de productos, personal de venta y unidades moviles.</p>
                <section className="kpis">
                  <article><h3>{productos.length}</h3><p>Productos registrados</p></article>
                  <article><h3>{vendedores.length}</h3><p>Vendedores habilitados</p></article>
                  <article><h3>{unidades.length}</h3><p>Unidades moviles operativas</p></article>
                </section>
              </article>
            }
          />
          <Route
            path="/productos"
            element={
              <article className="card">
                <h2>Gestion de productos</h2>
                <p className="subtle">Administra el catalogo comercial para abastecimiento y despacho.</p>
                <form className="form-grid" onSubmit={crearProducto}>
                  <input name="codigo" placeholder="Codigo (P010)" required />
                  <input name="nombre" placeholder="Nombre" required />
                  <select name="tipo" defaultValue="ALIMENTO">
                    <option value="ALIMENTO">Alimento</option>
                    <option value="BEBIDA">Bebida</option>
                    <option value="INSUMO">Insumo</option>
                  </select>
                  <input name="unidadMedida" placeholder="Unidad (kg, unidad)" required />
                  <button type="submit">Crear producto</button>
                </form>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Codigo</th><th>Nombre</th><th>Tipo</th><th>Unidad</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>
                      {productos.map((p) => (
                        <tr key={p.id}>
                          <td>{p.codigo}</td><td>{p.nombre}</td><td>{etiquetaTipoProducto(p.tipo)}</td><td>{p.unidadMedida}</td><td>{p.activo ? "Activo" : "Inactivo"}</td>
                          <td className="row-actions">
                            <button type="button" onClick={() => setModalEdicion({ kind: "producto", item: p })}>Editar</button>
                            <button type="button" className="danger" onClick={() => setModalEliminacion({ kind: "producto", id: p.id, etiqueta: p.nombre })}>Eliminar</button>
                          </td>
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
          <Route
            path="/vendedores"
            element={
              <article className="card">
                <h2>Gestion de vendedores</h2>
                <p className="subtle">Mantiene el personal habilitado para operar unidades moviles.</p>
                <form className="form-grid" onSubmit={crearVendedor}>
                  <input name="nombreCompleto" placeholder="Nombre completo" required />
                  <input name="documento" placeholder="Documento" required />
                  <input name="telefono" placeholder="Telefono" required />
                  <button type="submit">Crear vendedor</button>
                </form>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Nombre</th><th>Documento</th><th>Telefono</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>
                      {vendedores.map((v) => (
                        <tr key={v.id}>
                          <td>{v.nombreCompleto}</td><td>{v.documento}</td><td>{v.telefono}</td><td>{v.activo ? "Activo" : "Inactivo"}</td>
                          <td className="row-actions">
                            <button type="button" onClick={() => setModalEdicion({ kind: "vendedor", item: v })}>Editar</button>
                            <button type="button" className="danger" onClick={() => setModalEliminacion({ kind: "vendedor", id: v.id, etiqueta: v.nombreCompleto })}>Eliminar</button>
                          </td>
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
                <h2>Gestion de unidades moviles</h2>
                <p className="subtle">Controla unidades activas, zonas de cobertura y asignaciones de vendedor.</p>
                <form className="form-grid" onSubmit={crearUnidad}>
                  <input name="codigo" placeholder="Codigo (UM-03)" required />
                  <input name="zona" placeholder="Zona" required />
                  <select name="estado" defaultValue="ACTIVA">
                    <option value="ACTIVA">Activa</option>
                    <option value="MANTENIMIENTO">Mantenimiento</option>
                    <option value="FUERA_DE_SERVICIO">Fuera de servicio</option>
                  </select>
                  <select name="idVendedor" defaultValue="">
                    <option value="">Sin vendedor</option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>{v.nombreCompleto}</option>
                    ))}
                  </select>
                  <button type="submit">Crear unidad</button>
                </form>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Codigo</th><th>Zona</th><th>Estado</th><th>Vendedor</th><th>Acciones</th></tr></thead>
                    <tbody>
                      {unidades.map((u) => (
                        <tr key={u.id}>
                          <td>{u.codigo}</td><td>{u.zona}</td><td>{etiquetaEstadoUnidad(u.estado)}</td>
                          <td>{u.idVendedor ? vendedores.find((v) => v.id === u.idVendedor)?.nombreCompleto ?? "Asignado" : "Sin vendedor"}</td>
                          <td className="row-actions">
                            <button type="button" onClick={() => setModalEdicion({ kind: "unidad", item: u })}>Editar</button>
                            <button type="button" className="danger" onClick={() => setModalEliminacion({ kind: "unidad", id: u.id, etiqueta: u.codigo })}>Eliminar</button>
                          </td>
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
        <section className="modal-overlay" onClick={() => setModalEdicion(null)}>
          <article className="modal-card" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>
                {modalEdicion.kind === "producto" && "Editar producto"}
                {modalEdicion.kind === "vendedor" && "Editar vendedor"}
                {modalEdicion.kind === "unidad" && "Editar unidad movil"}
              </h3>
              <p className="modal-subtitle">Actualiza la informacion y guarda los cambios.</p>
            </header>
            <form onSubmit={guardarEdicion}>
              <div className="modal-body">
                {modalEdicion.kind === "producto" ? (
                  <>
                  <input name="codigo" defaultValue={modalEdicion.item.codigo} required />
                  <input name="nombre" defaultValue={modalEdicion.item.nombre} required />
                  <select name="tipo" defaultValue={modalEdicion.item.tipo}>
                    <option value="ALIMENTO">Alimento</option>
                    <option value="BEBIDA">Bebida</option>
                    <option value="INSUMO">Insumo</option>
                  </select>
                  <input name="unidadMedida" defaultValue={modalEdicion.item.unidadMedida} required />
                  <label className="check"><input type="checkbox" name="activo" defaultChecked={modalEdicion.item.activo} />Activo</label>
                  </>
                ) : null}
                {modalEdicion.kind === "vendedor" ? (
                  <>
                  <input name="nombreCompleto" defaultValue={modalEdicion.item.nombreCompleto} required />
                  <input name="documento" defaultValue={modalEdicion.item.documento} required />
                  <input name="telefono" defaultValue={modalEdicion.item.telefono} required />
                  <label className="check"><input type="checkbox" name="activo" defaultChecked={modalEdicion.item.activo} />Activo</label>
                  </>
                ) : null}
                {modalEdicion.kind === "unidad" ? (
                  <>
                  <input name="codigo" defaultValue={modalEdicion.item.codigo} required />
                  <input name="zona" defaultValue={modalEdicion.item.zona} required />
                  <select name="estado" defaultValue={modalEdicion.item.estado}>
                    <option value="ACTIVA">Activa</option>
                    <option value="MANTENIMIENTO">Mantenimiento</option>
                    <option value="FUERA_DE_SERVICIO">Fuera de servicio</option>
                  </select>
                  <select name="idVendedor" defaultValue={modalEdicion.item.idVendedor ?? ""}>
                    <option value="">Sin vendedor</option>
                    {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombreCompleto}</option>)}
                  </select>
                  <label className="check"><input type="checkbox" name="activo" defaultChecked={modalEdicion.item.activo} />Activo</label>
                  </>
                ) : null}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secundario-modal" onClick={() => setModalEdicion(null)}>
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

      {modalEliminacion ? (
        <section className="modal-overlay" onClick={() => setModalEliminacion(null)}>
          <article className="modal-card" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Confirmar eliminacion</h3>
              <p className="modal-subtitle">
                Esta accion eliminara el registro seleccionado.
              </p>
            </header>
            <div className="modal-body">
              <p className="subtle">
                ¿Deseas eliminar <strong>{modalEliminacion.etiqueta}</strong>?
              </p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secundario-modal" onClick={() => setModalEliminacion(null)}>
                Cancelar
              </button>
              <button type="button" className="danger btn-primario-modal" onClick={confirmarEliminacion}>
                Eliminar
              </button>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}

export default App;


