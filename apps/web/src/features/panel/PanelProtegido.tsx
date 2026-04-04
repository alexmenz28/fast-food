import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { flushSync } from "react-dom";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import {
  IconLayoutDashboard,
  IconMoon,
  IconPackage,
  IconPanelLeft,
  IconSun,
  IconTruck,
  IconUsers,
} from "../../icons";
import { API_V1_URL } from "../../shared/api/config";
import { etiquetaRol, puedeCambiarActivoCatalogo, puedeCrearEditar } from "../../shared/permissions";
import { parseSesion, SESSION_KEY, type Sesion } from "../../shared/session";
import type { ModalEdicion, Paginacion, Producto, UnidadMedidaOpt, UnidadMovil, Vendedor } from "../../shared/types/catalogos";
import { useTheme } from "../../theme";
import { CampoActivoCatalogo } from "./CampoActivoCatalogo";

const SIDEBAR_KEY = "fastfood_sidebar_collapsed";
const LIMITE_PAGINA = 8;

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

function telefonoSoloDigitos(el: HTMLInputElement) {
  el.value = el.value.replace(/\D/g, "");
}

export function PanelProtegido() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [unidades, setUnidades] = useState<UnidadMovil[]>([]);
  const [unidadesMedida, setUnidadesMedida] = useState<UnidadMedidaOpt[]>([]);
  const [mensaje, setMensaje] = useState("");
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
      const [rProd, rVend, rUni, rUm] = await Promise.all([
        fetch(`${API_V1_URL}/productos${qProd}`, { headers: authH }),
        fetch(`${API_V1_URL}/vendedores${qVend}`, { headers: authH }),
        fetch(`${API_V1_URL}/unidades-moviles${qUni}`, { headers: authH }),
        fetch(`${API_V1_URL}/unidades-medida`, { headers: authH }),
      ]);
      if (rProd.status === 401 || rVend.status === 401 || rUni.status === 401 || rUm.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        setSesion(null);
        navigate("/login", { replace: true });
        return;
      }
      const jProd = await rProd.json();
      const jVend = await rVend.json();
      const jUni = await rUni.json();
      const jUm = await rUm.json();
      if (!rProd.ok) {
        setMensaje(`Productos: ${String(jProd.error ?? jProd.message ?? rProd.status)}`);
        return;
      }
      if (!rVend.ok) {
        setMensaje(`Vendedores: ${String(jVend.error ?? jVend.message ?? rVend.status)}`);
        return;
      }
      if (!rUni.ok) {
        setMensaje(`Unidades: ${String(jUni.error ?? jUni.message ?? rUni.status)}`);
        return;
      }
      setProductos(jProd.data ?? []);
      setVendedores(jVend.data ?? []);
      setUnidades(jUni.data ?? []);
      if (jUm.ok && Array.isArray(jUm.data)) setUnidadesMedida(jUm.data);
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
    if (!Number.isFinite(idUm) || idUm < 1) {
      setMensaje("Selecciona una unidad de medida del catalogo.");
      return;
    }
    const payload = {
      nombre: String(form.get("nombre") ?? "").trim(),
      tipo: String(form.get("tipo") ?? "ALIMENTO"),
      idUnidadMedida: idUm,
      activo: true,
    };
    const json = await pedir("/productos", "POST", payload);
    const creado = json.data as { codigo?: string } | undefined;
    setMensaje(
      json.ok
        ? `Producto creado con codigo ${creado?.codigo ?? ""}.`
        : `Error: ${json.error}`,
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
    setMensaje(json.ok ? "Vendedor creado." : `Error: ${json.error}`);
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
    const idVendedor = String(form.get("idVendedor") ?? "");
    const payload = {
      zona: String(form.get("zona") ?? "").trim(),
      estado: String(form.get("estado") ?? "ACTIVA"),
      idVendedor: idVendedor ? idVendedor : null,
      activo: true,
    };
    const json = await pedir("/unidades-moviles", "POST", payload);
    const unidadCreada = json.data as { codigo?: string } | undefined;
    setMensaje(
      json.ok
        ? `Unidad movil creada con codigo ${unidadCreada?.codigo ?? ""}.`
        : `Error: ${json.error}`,
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
      if (!Number.isFinite(idUm) || idUm < 1) {
        setMensaje("Selecciona una unidad de medida del catalogo.");
        return;
      }
      const activo = adminPuedeActivo ? form.get("activo") === "on" : modalEdicion.item.activo;
      json = await pedir(`/productos/${modalEdicion.item.id}`, "PUT", {
        nombre: String(form.get("nombre") ?? "").trim(),
        tipo: String(form.get("tipo") ?? "ALIMENTO"),
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
      const idVendedor = String(form.get("idVendedor") ?? "");
      const activo = adminPuedeActivo ? form.get("activo") === "on" : modalEdicion.item.activo;
      json = await pedir(`/unidades-moviles/${modalEdicion.item.id}`, "PUT", {
        zona: String(form.get("zona") ?? "").trim(),
        estado: String(form.get("estado") ?? "ACTIVA"),
        idVendedor: idVendedor ? idVendedor : null,
        activo,
      });
    }

    setMensaje(json.ok ? "Registro actualizado." : `Error: ${json.error}`);
    if (json.ok) {
      setModalEdicion(null);
      await cargarDatos();
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
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h2>Centro de operaciones de abastecimiento</h2>
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
                <p className="subtle">
                  Administra el catalogo comercial para abastecimiento y despacho. El codigo se genera en el servidor
                  (secuencia P001, P002, …). La unidad de medida se elige del catalogo normalizado en base de datos.
                </p>
                {crearEditar ? (
                  <form key={formKeyProducto} className="form-grid" onSubmit={crearProducto}>
                    <input name="nombre" placeholder="Nombre" required />
                    <select name="tipo" defaultValue="ALIMENTO">
                      <option value="ALIMENTO">Alimento</option>
                      <option value="BEBIDA">Bebida</option>
                      <option value="INSUMO">Insumo</option>
                    </select>
                    <select
                      name="idUnidadMedida"
                      required
                      defaultValue={unidadesMedida[0]?.id ?? ""}
                      aria-label="Unidad de medida"
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
                    <button type="submit" disabled={unidadesMedida.length === 0}>
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
                        <th>Tipo</th>
                        <th>Unidad</th>
                        <th>Estado</th>
                        {crearEditar ? <th>Acciones</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((p) => (
                        <tr key={p.id} className={!p.activo ? "fila-catalogo-inactiva" : undefined}>
                          <td>{p.codigo}</td><td>{p.nombre}</td><td>{etiquetaTipoProducto(p.tipo)}</td><td>{p.unidadMedida}</td><td>{p.activo ? "Activo" : "Inactivo"}</td>
                          {crearEditar ? (
                            <td className="row-actions">
                              <button type="button" onClick={() => setModalEdicion({ kind: "producto", item: p })}>Editar</button>
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
          <Route
            path="/vendedores"
            element={
              <article className="card">
                <h2>Gestion de vendedores</h2>
                <p className="subtle">Mantiene el personal habilitado para operar unidades moviles.</p>
                {crearEditar ? (
                  <form key={formKeyVendedor} className="form-grid" onSubmit={crearVendedor}>
                    <input name="nombreCompleto" placeholder="Nombre completo" required />
                    <input name="documento" placeholder="Documento" required />
                    <input
                      name="telefono"
                      placeholder="Telefono (solo numeros)"
                      required
                      inputMode="numeric"
                      autoComplete="tel"
                      pattern="[0-9]*"
                      minLength={7}
                      maxLength={15}
                      title="Solo numeros, entre 7 y 15 digitos"
                      onInput={(ev) => telefonoSoloDigitos(ev.currentTarget)}
                    />
                    <button type="submit">Crear vendedor</button>
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
                              <button type="button" onClick={() => setModalEdicion({ kind: "vendedor", item: v })}>Editar</button>
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
                <h2>Gestion de unidades moviles</h2>
                <p className="subtle">
                  Controla unidades activas, zonas de cobertura y asignaciones de vendedor. El codigo se asigna solo
                  (secuencia UM-01, UM-02, …).
                </p>
                {crearEditar ? (
                  <form key={formKeyUnidad} className="form-grid" onSubmit={crearUnidad}>
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
                ) : (
                  <p className="subtle">Tu rol solo permite consultar este catalogo.</p>
                )}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Codigo</th>
                        <th>Zona</th>
                        <th>Estado</th>
                        <th>Vendedor</th>
                        <th>Catálogo</th>
                        {crearEditar ? <th>Acciones</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {unidades.map((u) => (
                        <tr key={u.id} className={!u.activo ? "fila-catalogo-inactiva" : undefined}>
                          <td>{u.codigo}</td><td>{u.zona}</td><td>{etiquetaEstadoUnidad(u.estado)}</td>
                          <td>{u.idVendedor ? vendedores.find((v) => v.id === u.idVendedor)?.nombreCompleto ?? "Asignado" : "Sin vendedor"}</td>
                          <td>{u.activo ? "Activa" : "Inactiva"}</td>
                          {crearEditar ? (
                            <td className="row-actions">
                              <button type="button" onClick={() => setModalEdicion({ kind: "unidad", item: u })}>Editar</button>
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
            <form
              key={
                modalEdicion
                  ? `${modalEdicion.kind}-${modalEdicion.kind === "producto" ? modalEdicion.item.id : modalEdicion.kind === "vendedor" ? modalEdicion.item.id : modalEdicion.item.id}`
                  : "cerrado"
              }
              onSubmit={guardarEdicion}
            >
              <div className="modal-body">
                {modalEdicion.kind === "producto" ? (
                  <>
                  <label className="subtle">Codigo</label>
                  <input readOnly value={modalEdicion.item.codigo} className="input-readonly" aria-readonly="true" />
                  <input name="nombre" defaultValue={modalEdicion.item.nombre} required />
                  <select name="tipo" defaultValue={modalEdicion.item.tipo}>
                    <option value="ALIMENTO">Alimento</option>
                    <option value="BEBIDA">Bebida</option>
                    <option value="INSUMO">Insumo</option>
                  </select>
                  <select
                    name="idUnidadMedida"
                    required
                    defaultValue={String(modalEdicion.item.idUnidadMedida)}
                    aria-label="Unidad de medida"
                  >
                    {unidadesMedida.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} ({u.codigo})
                      </option>
                    ))}
                  </select>
                  <CampoActivoCatalogo
                    activo={modalEdicion.item.activo}
                    puedeEditarEstado={puedeEditarEstadoCatalogo}
                  />
                  </>
                ) : null}
                {modalEdicion.kind === "vendedor" ? (
                  <>
                  <input name="nombreCompleto" defaultValue={modalEdicion.item.nombreCompleto} required />
                  <input name="documento" defaultValue={modalEdicion.item.documento} required />
                  <input
                    name="telefono"
                    defaultValue={modalEdicion.item.telefono.replace(/\D/g, "")}
                    required
                    inputMode="numeric"
                    autoComplete="tel"
                    pattern="[0-9]*"
                    minLength={7}
                    maxLength={15}
                    title="Solo numeros, entre 7 y 15 digitos"
                    onInput={(ev) => telefonoSoloDigitos(ev.currentTarget)}
                  />
                  <CampoActivoCatalogo
                    activo={modalEdicion.item.activo}
                    puedeEditarEstado={puedeEditarEstadoCatalogo}
                  />
                  </>
                ) : null}
                {modalEdicion.kind === "unidad" ? (
                  <>
                  <p className="subtle">
                    Codigo asignado: <strong>{modalEdicion.item.codigo}</strong> (no se puede cambiar)
                  </p>
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
                  <CampoActivoCatalogo
                    activo={modalEdicion.item.activo}
                    puedeEditarEstado={puedeEditarEstadoCatalogo}
                  />
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
    </main>
  );
}
