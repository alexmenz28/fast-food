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

type Product = {
  id: string;
  code: string;
  name: string;
  type: "FOOD" | "DRINK" | "SUPPLY";
  unitMeasure: string;
  isActive: boolean;
};

type Seller = {
  id: string;
  fullName: string;
  documentId: string;
  phone: string;
  isActive: boolean;
};

type MobileUnit = {
  id: string;
  code: string;
  zone: string;
  status: "ACTIVE" | "MAINTENANCE" | "OUT_OF_SERVICE";
  sellerId: string | null;
  isActive: boolean;
};

const API_URL = "http://localhost:3000";
const SESSION_KEY = "fastfood_mock_session";
const SIDEBAR_KEY = "fastfood_sidebar_collapsed";

type MockSession = {
  name: string;
  role: "ADMINISTRADOR" | "ALMACEN" | "SUPERVISOR";
};

function roleLabel(role: MockSession["role"]) {
  if (role === "ADMINISTRADOR") return "Administrador";
  if (role === "ALMACEN") return "Encargado de almacen";
  return "Supervisor de operaciones";
}

type EditModalState =
  | { kind: "product"; item: Product }
  | { kind: "seller"; item: Seller }
  | { kind: "unit"; item: MobileUnit }
  | null;

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      navigate("/resumen", { replace: true });
    }
  }, [navigate]);

  function handleMockLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const role = String(form.get("role") ?? "ALMACEN") as MockSession["role"];
    if (!name) {
      setMessage("Ingresa un nombre para continuar.");
      return;
    }
    const mockSession: MockSession = { name, role };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
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
        <form onSubmit={handleMockLogin}>
          <input name="name" placeholder="Usuario (mock)" required />
          <input name="password" type="password" placeholder="Contrasena (mock)" required />
          <select name="role" defaultValue="ALMACEN">
            <option value="ADMINISTRADOR">Administrador</option>
            <option value="ALMACEN">Encargado de almacen</option>
            <option value="SUPERVISOR">Supervisor</option>
          </select>
          <button type="submit">Ingresar (mock)</button>
        </form>
        <small>Demo academica: login visual sin autenticacion real.</small>
        {message ? <p className="message">{message}</p> : null}
      </section>
    </main>
  );
}

function ProtectedApp() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [mobileUnits, setMobileUnits] = useState<MobileUnit[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<MockSession | null>(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    return saved ? (JSON.parse(saved) as MockSession) : null;
  });
  const [now, setNow] = useState(new Date());
  const [editModal, setEditModal] = useState<EditModalState>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  });

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  }

  useEffect(() => {
    if (!session) {
      navigate("/login", { replace: true });
    }
  }, [navigate, session]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [productsRes, sellersRes, unitsRes] = await Promise.all([
        fetch(`${API_URL}/products`),
        fetch(`${API_URL}/sellers`),
        fetch(`${API_URL}/mobile-units`),
      ]);
      const productsJson = await productsRes.json();
      const sellersJson = await sellersRes.json();
      const unitsJson = await unitsRes.json();
      setProducts(productsJson.data ?? []);
      setSellers(sellersJson.data ?? []);
      setMobileUnits(unitsJson.data ?? []);
    } catch {
      setMessage("No se pudo cargar datos. Verifica que backend este activo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  async function apiRequest(path: string, method: string, payload?: unknown) {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return res.json();
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      code: String(form.get("code") ?? ""),
      name: String(form.get("name") ?? ""),
      type: String(form.get("type") ?? "FOOD"),
      unitMeasure: String(form.get("unitMeasure") ?? ""),
      isActive: true,
    };
    const json = await apiRequest("/products", "POST", payload);
    setMessage(json.ok ? "Producto creado." : `Error: ${json.error}`);
    if (json.ok) {
      event.currentTarget.reset();
      loadData();
    }
  }

  async function createSeller(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      fullName: String(form.get("fullName") ?? ""),
      documentId: String(form.get("documentId") ?? ""),
      phone: String(form.get("phone") ?? ""),
      isActive: true,
    };
    const json = await apiRequest("/sellers", "POST", payload);
    setMessage(json.ok ? "Vendedor creado." : `Error: ${json.error}`);
    if (json.ok) {
      event.currentTarget.reset();
      loadData();
    }
  }

  async function createMobileUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sellerId = String(form.get("sellerId") ?? "");
    const payload = {
      code: String(form.get("code") ?? ""),
      zone: String(form.get("zone") ?? ""),
      status: String(form.get("status") ?? "ACTIVE"),
      sellerId: sellerId ? sellerId : null,
      isActive: true,
    };
    const json = await apiRequest("/mobile-units", "POST", payload);
    setMessage(json.ok ? "Unidad movil creada." : `Error: ${json.error}`);
    if (json.ok) {
      event.currentTarget.reset();
      loadData();
    }
  }

  async function deleteProduct(id: string) {
    if (!window.confirm("¿Eliminar producto?")) return;
    const json = await apiRequest(`/products/${id}`, "DELETE");
    setMessage(json.ok ? "Producto eliminado." : `Error: ${json.error}`);
    if (json.ok) loadData();
  }

  async function deleteSeller(id: string) {
    if (!window.confirm("¿Eliminar vendedor?")) return;
    const json = await apiRequest(`/sellers/${id}`, "DELETE");
    setMessage(json.ok ? "Vendedor eliminado." : `Error: ${json.error}`);
    if (json.ok) loadData();
  }

  async function deleteMobileUnit(id: string) {
    if (!window.confirm("¿Eliminar unidad movil?")) return;
    const json = await apiRequest(`/mobile-units/${id}`, "DELETE");
    setMessage(json.ok ? "Unidad movil eliminada." : `Error: ${json.error}`);
    if (json.ok) loadData();
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    navigate("/login", { replace: true });
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const shiftLabel = useMemo(() => {
    const h = now.getHours();
    if (h >= 18 || h < 3) return "Turno nocturno activo";
    return "Fuera de turno operativo";
  }, [now]);

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editModal) return;
    const form = new FormData(event.currentTarget);
    let json: { ok: boolean; error?: string };

    if (editModal.kind === "product") {
      json = await apiRequest(`/products/${editModal.item.id}`, "PUT", {
        code: String(form.get("code") ?? ""),
        name: String(form.get("name") ?? ""),
        type: String(form.get("type") ?? "FOOD"),
        unitMeasure: String(form.get("unitMeasure") ?? ""),
        isActive: form.get("isActive") === "on",
      });
    } else if (editModal.kind === "seller") {
      json = await apiRequest(`/sellers/${editModal.item.id}`, "PUT", {
        fullName: String(form.get("fullName") ?? ""),
        documentId: String(form.get("documentId") ?? ""),
        phone: String(form.get("phone") ?? ""),
        isActive: form.get("isActive") === "on",
      });
    } else {
      const sellerId = String(form.get("sellerId") ?? "");
      json = await apiRequest(`/mobile-units/${editModal.item.id}`, "PUT", {
        code: String(form.get("code") ?? ""),
        zone: String(form.get("zone") ?? ""),
        status: String(form.get("status") ?? "ACTIVE"),
        sellerId: sellerId ? sellerId : null,
        isActive: form.get("isActive") === "on",
      });
    }

    setMessage(json.ok ? "Registro actualizado." : `Error: ${json.error}`);
    if (json.ok) {
      setEditModal(null);
      loadData();
    }
  }

  return (
    <main className={`layout ${sidebarCollapsed ? "layout--sidebar-collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Navegacion principal">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <span className="brand-mark" title="FAST FOOD S.A.">
              FF
            </span>
            {!sidebarCollapsed ? (
              <div className="sidebar-brand-text">
                <strong>FAST FOOD</strong>
                <span>Abastecimiento</span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={`sidebar-toggle ${sidebarCollapsed ? "sidebar-toggle--collapsed" : ""}`}
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expandir menu" : "Contraer menu"}
            aria-expanded={!sidebarCollapsed}
          >
            <IconPanelLeft />
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/resumen"
            className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`}
            title="Resumen operativo"
          >
            <IconLayoutDashboard className="sidebar-link-icon" />
            <span className="sidebar-label">Resumen</span>
          </NavLink>
          <NavLink
            to="/productos"
            className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`}
            title="Productos"
          >
            <IconPackage className="sidebar-link-icon" />
            <span className="sidebar-label">Productos</span>
          </NavLink>
          <NavLink
            to="/vendedores"
            className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`}
            title="Vendedores"
          >
            <IconUsers className="sidebar-link-icon" />
            <span className="sidebar-label">Vendedores</span>
          </NavLink>
          <NavLink
            to="/unidades"
            className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`}
            title="Unidades moviles"
          >
            <IconTruck className="sidebar-link-icon" />
            <span className="sidebar-label">Unidades</span>
          </NavLink>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h2>Panel operativo</h2>
            <p className="topbar-meta">
              {session.name} · {roleLabel(session.role)}
            </p>
            <p className="topbar-time">
              {now.toLocaleString("es-BO")} · {shiftLabel}
            </p>
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
            <button className="btn-secondary" onClick={loadData} disabled={loading} type="button">
              {loading ? "Cargando..." : "Sincronizar"}
            </button>
            <button type="button" className="danger" onClick={logout}>
              Salir
            </button>
          </div>
        </header>

        <section className="kpis">
          <article>
            <h3>{products.length}</h3>
            <p>Productos</p>
          </article>
          <article>
            <h3>{sellers.length}</h3>
            <p>Vendedores</p>
          </article>
          <article>
            <h3>{mobileUnits.length}</h3>
            <p>Unidades moviles</p>
          </article>
        </section>

        {message ? <p className="message">{message}</p> : null}

        <Routes>
          <Route
            path="/resumen"
            element={
              <article className="card">
                <h2>Resumen operativo</h2>
                <p className="subtle">
                  Estado actual de catalogos base para HU1, HU2 y HU3.
                </p>
                <div className="summary-grid">
                  <div>
                    <h3>{products.filter((p) => p.isActive).length}</h3>
                    <p>Productos activos</p>
                  </div>
                  <div>
                    <h3>{sellers.filter((s) => s.isActive).length}</h3>
                    <p>Vendedores activos</p>
                  </div>
                  <div>
                    <h3>{mobileUnits.filter((u) => u.status === "ACTIVE").length}</h3>
                    <p>Unidades activas</p>
                  </div>
                </div>
              </article>
            }
          />
          <Route
            path="/productos"
            element={
              <article className="card">
                <h2>HU1 - Productos</h2>
                <form onSubmit={createProduct}>
                  <input name="code" placeholder="Codigo (P010)" required />
                  <input name="name" placeholder="Nombre" required />
                  <select name="type" defaultValue="FOOD">
                    <option value="FOOD">FOOD</option>
                    <option value="DRINK">DRINK</option>
                    <option value="SUPPLY">SUPPLY</option>
                  </select>
                  <input name="unitMeasure" placeholder="Unidad (kg, unidad)" required />
                  <button type="submit">Crear producto</button>
                </form>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Codigo</th>
                        <th>Nombre</th>
                        <th>Tipo</th>
                        <th>Unidad</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td>{p.code}</td>
                          <td>{p.name}</td>
                          <td>{p.type}</td>
                          <td>{p.unitMeasure}</td>
                          <td>{p.isActive ? "Activo" : "Inactivo"}</td>
                          <td className="row-actions">
                            <button type="button" onClick={() => setEditModal({ kind: "product", item: p })}>
                              Editar
                            </button>
                            <button type="button" className="danger" onClick={() => deleteProduct(p.id)}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            }
          />
          <Route
            path="/vendedores"
            element={
              <article className="card">
                <h2>HU2 - Vendedores</h2>
                <form onSubmit={createSeller}>
                  <input name="fullName" placeholder="Nombre completo" required />
                  <input name="documentId" placeholder="Documento" required />
                  <input name="phone" placeholder="Telefono" required />
                  <button type="submit">Crear vendedor</button>
                </form>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Documento</th>
                        <th>Telefono</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellers.map((s) => (
                        <tr key={s.id}>
                          <td>{s.fullName}</td>
                          <td>{s.documentId}</td>
                          <td>{s.phone}</td>
                          <td>{s.isActive ? "Activo" : "Inactivo"}</td>
                          <td className="row-actions">
                            <button type="button" onClick={() => setEditModal({ kind: "seller", item: s })}>
                              Editar
                            </button>
                            <button type="button" className="danger" onClick={() => deleteSeller(s.id)}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            }
          />
          <Route
            path="/unidades"
            element={
              <article className="card">
                <h2>HU3 - Unidades moviles</h2>
                <form onSubmit={createMobileUnit}>
                  <input name="code" placeholder="Codigo (UM-03)" required />
                  <input name="zone" placeholder="Zona" required />
                  <select name="status" defaultValue="ACTIVE">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                  </select>
                  <select name="sellerId" defaultValue="">
                    <option value="">Sin vendedor</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Crear unidad</button>
                </form>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Codigo</th>
                        <th>Zona</th>
                        <th>Estado</th>
                        <th>Vendedor</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mobileUnits.map((u) => (
                        <tr key={u.id}>
                          <td>{u.code}</td>
                          <td>{u.zone}</td>
                          <td>{u.status}</td>
                          <td>
                            {u.sellerId
                              ? sellers.find((s) => s.id === u.sellerId)?.fullName ?? "Asignado"
                              : "Sin vendedor"}
                          </td>
                          <td className="row-actions">
                            <button type="button" onClick={() => setEditModal({ kind: "unit", item: u })}>
                              Editar
                            </button>
                            <button type="button" className="danger" onClick={() => deleteMobileUnit(u.id)}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            }
          />
          <Route path="*" element={<Navigate to="/resumen" replace />} />
        </Routes>
      </section>

      {editModal ? (
        <section className="modal-overlay" onClick={() => setEditModal(null)}>
          <article className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Editar registro</h3>
            <form onSubmit={submitEdit}>
              {editModal.kind === "product" ? (
                <>
                  <input name="code" defaultValue={editModal.item.code} required />
                  <input name="name" defaultValue={editModal.item.name} required />
                  <select name="type" defaultValue={editModal.item.type}>
                    <option value="FOOD">FOOD</option>
                    <option value="DRINK">DRINK</option>
                    <option value="SUPPLY">SUPPLY</option>
                  </select>
                  <input name="unitMeasure" defaultValue={editModal.item.unitMeasure} required />
                  <label className="check">
                    <input type="checkbox" name="isActive" defaultChecked={editModal.item.isActive} />
                    Activo
                  </label>
                </>
              ) : null}

              {editModal.kind === "seller" ? (
                <>
                  <input name="fullName" defaultValue={editModal.item.fullName} required />
                  <input name="documentId" defaultValue={editModal.item.documentId} required />
                  <input name="phone" defaultValue={editModal.item.phone} required />
                  <label className="check">
                    <input type="checkbox" name="isActive" defaultChecked={editModal.item.isActive} />
                    Activo
                  </label>
                </>
              ) : null}

              {editModal.kind === "unit" ? (
                <>
                  <input name="code" defaultValue={editModal.item.code} required />
                  <input name="zone" defaultValue={editModal.item.zone} required />
                  <select name="status" defaultValue={editModal.item.status}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                  </select>
                  <select name="sellerId" defaultValue={editModal.item.sellerId ?? ""}>
                    <option value="">Sin vendedor</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                  <label className="check">
                    <input type="checkbox" name="isActive" defaultChecked={editModal.item.isActive} />
                    Activo
                  </label>
                </>
              ) : null}

              <div className="row-actions">
                <button type="submit">Guardar</button>
                <button type="button" className="danger" onClick={() => setEditModal(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </article>
        </section>
      ) : null}
    </main>
  );
}

export default App;
