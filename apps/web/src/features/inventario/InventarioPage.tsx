import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_V1_URL } from "../../shared/api/config";
import { puedeCrearEditar } from "../../shared/permissions";
import { parseSesion, SESSION_KEY, type Sesion } from "../../shared/session";
import { FeedbackMessage, type FeedbackState } from "../../shared/ui/FeedbackMessage";
import type { CategoriaProductoOpt } from "../../shared/types/catalogos";
import type { FilaStock, Paginacion } from "../../shared/types/inventario";

const LIMITE = 8;

type Props = {
  sesion: Sesion;
};

type RespuestaApi = { ok: boolean; error?: string; data?: unknown; paginacion?: Paginacion };

export default function InventarioPage({ sesion }: Props) {
  const navigate = useNavigate();
  const [almacen, setAlmacen] = useState<{ codigo: string; nombre: string } | null>(null);
  const [filas, setFilas] = useState<FilaStock[]>([]);
  const [paginacion, setPaginacion] = useState<Paginacion>({
    pagina: 1,
    limite: LIMITE,
    total: 0,
    totalPaginas: 1,
  });
  const [categorias, setCategorias] = useState<CategoriaProductoOpt[]>([]);
  const [productosSelect, setProductosSelect] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<number | "">("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [cargando, setCargando] = useState(false);
  const [formIngresoKey, setFormIngresoKey] = useState(0);
  const puedeEditar = puedeCrearEditar(sesion.rol);

  const pedir = useCallback(
    async (path: string, method: string, payload?: unknown): Promise<RespuestaApi> => {
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
          navigate("/login", { replace: true });
          return { ok: false, error: "Sesion expirada." };
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
        const extra =
          body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
            ? (body as { message: string }).message
            : undefined;
        const msg = body.error ?? extra ?? `HTTP ${res.status}`;
        return { ok: false, error: String(msg) };
      }
        return body;
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Error de red.",
        };
      }
    },
    [navigate],
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setFeedback(null);
    try {
      const qCat = filtroCategoria === "" ? "" : `&idCategoria=${filtroCategoria}`;
      const qStock = `?pagina=${paginacion.pagina}&limite=${paginacion.limite}${qCat}`;
      const [rAlm, rStock, rCat, rProd] = await Promise.all([
        pedir("/inventario/almacen", "GET"),
        pedir(`/inventario/stock${qStock}`, "GET"),
        pedir("/productos/categorias", "GET"),
        puedeEditar ? pedir("/productos?pagina=1&limite=50", "GET") : Promise.resolve({ ok: true, data: [] }),
      ]);
      if (!rAlm.ok) {
        setFeedback({ tipo: "error", text: rAlm.error ?? "No se pudo cargar almacén." });
        return;
      }
      if (!rStock.ok) {
        setFeedback({ tipo: "error", text: rStock.error ?? "No se pudo cargar stock." });
        return;
      }
      const dAlm = rAlm.data as { code?: string; name?: string } | undefined;
      if (dAlm) {
        setAlmacen({
          codigo: String(dAlm.code ?? ""),
          nombre: String(dAlm.name ?? "Almacén"),
        });
      }
      setFilas((rStock.data as FilaStock[]) ?? []);
      if (rStock.paginacion) setPaginacion(rStock.paginacion);
      if (rCat.ok && Array.isArray(rCat.data)) {
        setCategorias(rCat.data as CategoriaProductoOpt[]);
      }
      if (puedeEditar && rProd.ok && Array.isArray(rProd.data)) {
        const rows = rProd.data as { id: string; codigo: string; nombre: string }[];
        setProductosSelect(rows.map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre })));
      }
    } finally {
      setCargando(false);
    }
  }, [pedir, paginacion.pagina, paginacion.limite, filtroCategoria, puedeEditar]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function registrarIngreso(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const idProducto = String(form.get("idProducto") ?? "");
    const cantidad = Number(form.get("cantidad"));
    const fechaHora = String(form.get("fechaHora") ?? "").trim();
    if (!idProducto) {
      setFeedback({ tipo: "warning", text: "Selecciona un producto." });
      return;
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setFeedback({ tipo: "warning", text: "La cantidad debe ser mayor a cero." });
      return;
    }
    const payload: Record<string, unknown> = { idProducto, cantidad };
    if (fechaHora) {
      const d = new Date(fechaHora);
      if (!Number.isNaN(d.getTime())) payload.fechaHora = d.toISOString();
    }
    const json = await pedir("/inventario/ingresos", "POST", payload);
    setFeedback(
      json.ok
        ? { tipo: "success", text: "Ingreso registrado; stock actualizado." }
        : { tipo: "error", text: json.error ?? "No se pudo registrar el ingreso." },
    );
    if (json.ok) {
      setFormIngresoKey((k) => k + 1);
      await cargar();
    }
  }

  async function guardarMinimo(idProducto: string, cantidadMinima: number) {
    const json = await pedir(`/inventario/stock/${idProducto}/minimo`, "PATCH", {
      cantidadMinima,
    });
    setFeedback(
      json.ok
        ? { tipo: "success", text: "Stock mínimo actualizado." }
        : { tipo: "error", text: json.error ?? "No se pudo actualizar el mínimo." },
    );
    if (json.ok) await cargar();
  }

  function cambiarPagina(dir: "prev" | "next") {
    setPaginacion((p) => {
      const next =
        dir === "next"
          ? Math.min(p.totalPaginas, p.pagina + 1)
          : Math.max(1, p.pagina - 1);
      return { ...p, pagina: next };
    });
  }

  const bajos = filas.filter((f) => f.bajoMinimo).length;

  return (
    <article className="card">
      <h2>Inventario del almacén central</h2>
      <p className="subtle">
        Consulta de existencias por producto, registro de ingresos al almacén central y configuración del stock mínimo
        para alertas. Los datos corresponden al almacén{" "}
        <strong>{almacen ? `${almacen.codigo} — ${almacen.nombre}` : "…"}</strong>.
      </p>

      <FeedbackMessage feedback={feedback} />
      {cargando ? <p className="subtle">Cargando…</p> : null}

      <div className="form-grid" style={{ marginBottom: "1rem", alignItems: "end" }}>
        <div className="form-field-block">
          <label htmlFor="inv-filtro-cat">Filtrar por categoría</label>
          <p className="form-field-hint">Solo afecta la tabla y la paginación; no es un dato de ingreso.</p>
          <select
            id="inv-filtro-cat"
            value={filtroCategoria === "" ? "" : String(filtroCategoria)}
            onChange={(ev) => {
              const v = ev.target.value;
              setFiltroCategoria(v === "" ? "" : Number(v));
              setPaginacion((p) => ({ ...p, pagina: 1 }));
            }}
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        {bajos > 0 ? (
          <span className="badge-alerta-stock" role="status">
            {bajos} producto{bajos > 1 ? "s" : ""} bajo mínimo en esta página
          </span>
        ) : (
          <span className="subtle">Sin alertas de mínimo en esta página</span>
        )}
      </div>

      {puedeEditar ? (
        <form
          key={formIngresoKey}
          className="form-grid form-jornada-nueva"
          onSubmit={registrarIngreso}
          style={{ marginBottom: "1.5rem" }}
        >
          <h3 className="form-section-title" style={{ gridColumn: "1 / -1" }}>
            Registrar ingreso
          </h3>
          <p className="subtle" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
            Campos con <span className="req-mark">*</span> obligatorios. La fecha y hora del movimiento es opcional; si la
            omites, el servidor registra el momento actual.
          </p>
          <div className="form-field-block">
            <label htmlFor="inv-prod">
              Producto <span className="req-mark">*</span>
            </label>
            <p className="form-field-hint">Insumo o artículo que ingresa al almacén central.</p>
            <select id="inv-prod" name="idProducto" required defaultValue="">
              <option value="">Seleccione…</option>
              {productosSelect.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} — {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field-block">
            <label htmlFor="inv-cant">
              Cantidad <span className="req-mark">*</span>
            </label>
            <p className="form-field-hint">Unidades según la medida del producto (mayor a cero).</p>
            <input id="inv-cant" name="cantidad" type="number" step="0.01" min="0.01" required />
          </div>
          <div className="form-field-block">
            <label htmlFor="inv-fh">Fecha y hora del ingreso</label>
            <p className="form-field-hint">Opcional. Útil para registrar movimientos atrasados.</p>
            <input id="inv-fh" name="fechaHora" type="datetime-local" />
          </div>
          <button type="submit" style={{ gridColumn: "1 / -1" }}>
            Registrar ingreso
          </button>
        </form>
      ) : (
        <p className="subtle">Tu rol solo permite consultar el inventario.</p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Stock actual</th>
              <th>Mínimo</th>
              <th>Estado</th>
              {puedeEditar ? <th>Mínimo (editar)</th> : null}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.idProducto} className={f.bajoMinimo ? "fila-stock-bajo" : undefined}>
                <td>{f.codigo}</td>
                <td>
                  {f.nombre} <span className="subtle">({f.unidadMedida})</span>
                </td>
                <td>{f.categoriaNombre}</td>
                <td>{f.cantidadActual}</td>
                <td>{f.cantidadMinima}</td>
                <td>
                  {f.bajoMinimo ? (
                    <span className="badge-alerta-stock">Bajo mínimo</span>
                  ) : (
                    <span className="subtle">OK</span>
                  )}
                </td>
                {puedeEditar ? (
                  <td>
                    <form
                      className="form-inline-min"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        const fd = new FormData(ev.currentTarget);
                        const v = Number(fd.get("min"));
                        if (Number.isFinite(v) && v >= 0) void guardarMinimo(f.idProducto, v);
                      }}
                    >
                      <input name="min" type="number" step="0.01" min="0" defaultValue={f.cantidadMinima} />
                      <button type="submit" className="btn-small">
                        Guardar
                      </button>
                    </form>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="paginacion">
        <span>
          Página {paginacion.pagina} de {paginacion.totalPaginas} · Total {paginacion.total}
        </span>
        <div className="paginacion-acciones">
          <button
            type="button"
            className="btn-paginacion"
            disabled={paginacion.pagina <= 1}
            onClick={() => cambiarPagina("prev")}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn-paginacion"
            disabled={paginacion.pagina >= paginacion.totalPaginas}
            onClick={() => cambiarPagina("next")}
          >
            Siguiente
          </button>
        </div>
      </div>
    </article>
  );
}
