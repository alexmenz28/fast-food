import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_V1_URL } from "../../shared/api/config";
import { etiquetaEstadoAbastecimiento, etiquetaEstadoJornada } from "../../shared/labels/operaciones";
import { puedeCrearEditar } from "../../shared/permissions";
import { parseSesion, SESSION_KEY, type Sesion } from "../../shared/session";
import type {
  AbastecimientoDetalle,
  AbastecimientoResumen,
  JornadaResumen,
  ZonaOpcion,
} from "../../shared/types/operaciones";
import type { Paginacion } from "../../shared/types/inventario";
import { FeedbackMessage, type FeedbackState } from "../../shared/ui/FeedbackMessage";
import { TEXTO_HORARIO_NOCTURNO, validarHorarioJornadaCliente } from "../../shared/validation/jornadaHorario";

const LIMITE = 8;

type Props = { sesion: Sesion };

type RespuestaApi = { ok: boolean; error?: string; data?: unknown; paginacion?: Paginacion };

type OpcionUnidad = { id: string; codigo: string };
type OpcionVendedor = { id: string; nombreCompleto: string };
type OpcionProducto = { id: string; codigo: string; nombre: string };

function fechaLocalHoy(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AbastecimientoDiarioPage({ sesion }: Props) {
  const navigate = useNavigate();
  const puedeEditar = puedeCrearEditar(sesion.rol);

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [feedbackEntrega, setFeedbackEntrega] = useState<FeedbackState | null>(null);
  const [cargando, setCargando] = useState(false);
  const [zonas, setZonas] = useState<ZonaOpcion[]>([]);
  const [unidades, setUnidades] = useState<OpcionUnidad[]>([]);
  const [vendedores, setVendedores] = useState<OpcionVendedor[]>([]);
  const [productos, setProductos] = useState<OpcionProducto[]>([]);

  const [jornadas, setJornadas] = useState<JornadaResumen[]>([]);
  const [pagJornadas, setPagJornadas] = useState<Paginacion>({
    pagina: 1,
    limite: LIMITE,
    total: 0,
    totalPaginas: 1,
  });
  const [soloPendientes, setSoloPendientes] = useState(false);

  const [abastecimientos, setAbastecimientos] = useState<AbastecimientoResumen[]>([]);
  const [pagAbs, setPagAbs] = useState<Paginacion>({
    pagina: 1,
    limite: LIMITE,
    total: 0,
    totalPaginas: 1,
  });

  const [formJornadaKey, setFormJornadaKey] = useState(0);
  const [modalJornadaId, setModalJornadaId] = useState<string | null>(null);
  const [cantidadesEntrega, setCantidadesEntrega] = useState<Record<string, string>>({});
  const [detalleAbs, setDetalleAbs] = useState<AbastecimientoDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

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
          return { ok: false, error: "Sesión expirada." };
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

  const cargarCatalogos = useCallback(async () => {
    const q = "?pagina=1&limite=50";
    const [rZ, rU, rV, rP] = await Promise.all([
      pedir("/zonas", "GET"),
      pedir(`/unidades-moviles${q}`, "GET"),
      pedir(`/vendedores${q}`, "GET"),
      pedir(`/productos${q}`, "GET"),
    ]);
    const fallos: string[] = [];
    if (rZ.ok && Array.isArray(rZ.data)) {
      setZonas(rZ.data as ZonaOpcion[]);
    } else if (!rZ.ok) {
      fallos.push(`Zonas: ${rZ.error ?? "error"}`);
    }
    if (rU.ok && Array.isArray(rU.data)) {
      const rows = rU.data as { id: string; codigo: string }[];
      setUnidades(rows.map((u) => ({ id: u.id, codigo: u.codigo })));
    } else if (!rU.ok) {
      fallos.push(`Unidades: ${rU.error ?? "error"}`);
    }
    if (rV.ok && Array.isArray(rV.data)) {
      const rows = rV.data as { id: string; nombreCompleto: string }[];
      setVendedores(rows.map((v) => ({ id: v.id, nombreCompleto: v.nombreCompleto })));
    } else if (!rV.ok) {
      fallos.push(`Vendedores: ${rV.error ?? "error"}`);
    }
    if (rP.ok && Array.isArray(rP.data)) {
      const rows = rP.data as { id: string; codigo: string; nombre: string }[];
      setProductos(rows.map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre })));
    } else if (!rP.ok) {
      fallos.push(`Productos: ${rP.error ?? "error"}`);
    }
    if (fallos.length > 0) {
      setFeedback({
        tipo: "error",
        text: `No se pudieron cargar algunos catálogos. ${fallos.join(" · ")}`,
      });
    }
  }, [pedir]);

  const cargarJornadas = useCallback(
    async (forzarPagina?: number) => {
      const pagina = forzarPagina ?? pagJornadas.pagina;
      const qPend = soloPendientes ? "&pendienteAbastecimiento=true" : "";
      const path = `/jornadas?pagina=${pagina}&limite=${pagJornadas.limite}${qPend}`;
      const r = await pedir(path, "GET");
      if (!r.ok) {
        setFeedback({ tipo: "error", text: r.error ?? "No se pudieron cargar las jornadas." });
        return;
      }
      setJornadas((r.data as JornadaResumen[]) ?? []);
      if (r.paginacion) setPagJornadas(r.paginacion);
    },
    [pedir, pagJornadas.pagina, pagJornadas.limite, soloPendientes],
  );

  const cargarAbastecimientos = useCallback(async () => {
    const path = `/abastecimientos?pagina=${pagAbs.pagina}&limite=${pagAbs.limite}`;
    const r = await pedir(path, "GET");
    if (!r.ok) {
      setFeedback({ tipo: "error", text: r.error ?? "No se pudieron cargar los abastecimientos." });
      return;
    }
    setAbastecimientos((r.data as AbastecimientoResumen[]) ?? []);
    if (r.paginacion) setPagAbs(r.paginacion);
  }, [pedir, pagAbs.pagina, pagAbs.limite]);

  useEffect(() => {
    void cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    setCargando(true);
    void (async () => {
      await cargarJornadas();
      await cargarAbastecimientos();
    })().finally(() => setCargando(false));
  }, [cargarJornadas, cargarAbastecimientos]);

  async function crearJornada(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const horaInicio = String(fd.get("horaInicio") ?? "");
    const horaFin = String(fd.get("horaFin") ?? "").trim();
    const payload = {
      idUnidad: String(fd.get("idUnidad") ?? ""),
      idVendedor: String(fd.get("idVendedor") ?? ""),
      idZona: String(fd.get("idZona") ?? ""),
      fechaOperacion: String(fd.get("fechaOperacion") ?? ""),
      horaInicio,
      horaFin,
    };
    if (!payload.idUnidad || !payload.idVendedor || !payload.idZona) {
      setFeedback({ tipo: "warning", text: "Completa unidad, vendedor y zona." });
      return;
    }
    if (!horaFin) {
      setFeedback({ tipo: "warning", text: "La hora de fin estimada es obligatoria." });
      return;
    }
    const errHorario = validarHorarioJornadaCliente(horaInicio, horaFin);
    if (errHorario) {
      setFeedback({ tipo: "warning", text: errHorario });
      return;
    }
    const json = await pedir("/jornadas", "POST", payload);
    setFeedback(
      json.ok
        ? {
            tipo: "success",
            text: "Jornada registrada. Puedes registrar la entrega de insumos cuando corresponda.",
          }
        : { tipo: "error", text: json.error ?? "No se pudo registrar la jornada." },
    );
    if (json.ok) {
      setFormJornadaKey((k) => k + 1);
      await cargarJornadas(1);
      await cargarAbastecimientos();
    }
  }

  function abrirModalEntrega(j: JornadaResumen) {
    if (j.estado !== "PLANNED" || j.tieneAbastecimiento) return;
    const inicial: Record<string, string> = {};
    for (const p of productos) {
      inicial[p.id] = "";
    }
    setCantidadesEntrega(inicial);
    setFeedbackEntrega(null);
    setModalJornadaId(j.id);
  }

  async function confirmarEntrega(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modalJornadaId) return;
    const lineas = productos
      .map((p) => {
        const raw = cantidadesEntrega[p.id]?.trim() ?? "";
        const n = raw === "" ? NaN : Number(raw);
        return { idProducto: p.id, cantidad: n };
      })
      .filter((l) => Number.isFinite(l.cantidad) && l.cantidad > 0)
      .map((l) => ({ idProducto: l.idProducto, cantidad: l.cantidad }));

    if (lineas.length === 0) {
      setFeedbackEntrega({
        tipo: "warning",
        text: "Indica al menos un producto con cantidad mayor a cero.",
      });
      return;
    }

    const json = await pedir("/abastecimientos", "POST", {
      idJornada: modalJornadaId,
      lineas,
    });
    if (json.ok) {
      setFeedbackEntrega(null);
      setFeedback({
        tipo: "success",
        text: "Abastecimiento registrado: stock del almacén central actualizado y jornada en curso.",
      });
      setModalJornadaId(null);
      await cargarJornadas();
      await cargarAbastecimientos();
    } else {
      setFeedbackEntrega({
        tipo: "error",
        text: json.error ?? "No se pudo registrar el abastecimiento.",
      });
    }
  }

  async function verDetalleAbastecimiento(id: string) {
    setCargandoDetalle(true);
    setDetalleAbs(null);
    const r = await pedir(`/abastecimientos/${id}`, "GET");
    setCargandoDetalle(false);
    if (r.ok && r.data) {
      setDetalleAbs(r.data as AbastecimientoDetalle);
    } else {
      setFeedback({ tipo: "error", text: r.error ?? "No se pudo cargar el detalle." });
    }
  }

  const cambiarPagJornadas = (dir: "prev" | "next") => {
    setPagJornadas((p) => ({
      ...p,
      pagina:
        dir === "next"
          ? Math.min(p.totalPaginas, p.pagina + 1)
          : Math.max(1, p.pagina - 1),
    }));
  };

  const cambiarPagAbs = (dir: "prev" | "next") => {
    setPagAbs((p) => ({
      ...p,
      pagina:
        dir === "next"
          ? Math.min(p.totalPaginas, p.pagina + 1)
          : Math.max(1, p.pagina - 1),
    }));
  };

  const defaultHoraInicio = useMemo(() => "20:00", []);
  const defaultHoraFin = useMemo(() => "03:00", []);

  const modalOperativo = Boolean(modalJornadaId || detalleAbs || cargandoDetalle);

  return (
    <article className="card">
      <h2>Abastecimiento diario</h2>
      <p className="subtle">
        Planificación de jornadas por unidad y vendedor, y registro de entrega de insumos desde el almacén central.
        El sistema valida stock disponible y descuenta en una sola operación; las salidas quedan vinculadas al
        abastecimiento en el historial de movimientos.
      </p>

      {!modalOperativo ? <FeedbackMessage feedback={feedback} /> : null}
      {cargando ? <p className="subtle">Cargando…</p> : null}

      {puedeEditar ? (
        <form key={formJornadaKey} className="form-grid form-jornada-nueva" onSubmit={crearJornada} style={{ marginBottom: "2rem" }}>
          <h3 className="form-section-title">Nueva jornada</h3>
          <p className="subtle" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
            Los campos con <span className="req-mark">*</span> son obligatorios. Deben coincidir unidad y vendedor con la
            asignación vigente en catálogos.
          </p>

          <div className="form-field-block">
            <label htmlFor="jn-unidad">
              Unidad móvil <span className="req-mark">*</span>
            </label>
            <p className="form-field-hint">Food truck que operará en la jornada.</p>
            <select id="jn-unidad" name="idUnidad" required defaultValue="">
              <option value="">Seleccione…</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.codigo}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field-block">
            <label htmlFor="jn-vendedor">
              Vendedor responsable <span className="req-mark">*</span>
            </label>
            <p className="form-field-hint">Persona asignada a esa unidad (debe tener asignación vigente).</p>
            <select id="jn-vendedor" name="idVendedor" required defaultValue="">
              <option value="">Seleccione…</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombreCompleto}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field-block">
            <label htmlFor="jn-zona">
              Zona de operación <span className="req-mark">*</span>
            </label>
            <p className="form-field-hint">Barrio o área donde se prevé vender (catálogo de zonas).</p>
            <select id="jn-zona" name="idZona" required defaultValue="">
              <option value="">Seleccione…</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field-block">
            <label htmlFor="jn-fecha">
              Fecha de operación <span className="req-mark">*</span>
            </label>
            <p className="form-field-hint">Día calendario de la jornada nocturna.</p>
            <input id="jn-fecha" name="fechaOperacion" type="date" required defaultValue={fechaLocalHoy()} />
          </div>

          <fieldset className="form-fieldset-horario" style={{ gridColumn: "1 / -1" }}>
            <legend>
              Horario del turno nocturno <span className="req-mark">*</span>
            </legend>
            <p className="subtle" style={{ marginTop: 0 }}>
              {TEXTO_HORARIO_NOCTURNO}
            </p>
            <div className="form-grid--horario-par">
              <div className="form-field-block">
                <label htmlFor="jn-hora-inicio">
                  Inicio de operaciones <span className="req-mark">*</span>
                </label>
                <p className="form-field-hint">Cuándo comienza la venta en calle (ej. 20:00).</p>
                <input
                  id="jn-hora-inicio"
                  name="horaInicio"
                  type="time"
                  required
                  defaultValue={defaultHoraInicio}
                  step={60}
                />
              </div>
              <div className="form-field-block">
                <label htmlFor="jn-hora-fin">
                  Fin estimado de operaciones <span className="req-mark">*</span>
                </label>
                <p className="form-field-hint">
                  Hora prevista de cierre del turno; suele ser madrugada (ej. 03:00). No es la hora del abastecimiento en
                  almacén.
                </p>
                <input
                  id="jn-hora-fin"
                  name="horaFin"
                  type="time"
                  required
                  defaultValue={defaultHoraFin}
                  step={60}
                />
              </div>
            </div>
          </fieldset>

          <button type="submit" style={{ gridColumn: "1 / -1" }}>
            Registrar jornada
          </button>
        </form>
      ) : (
        <p className="subtle">Tu rol solo permite consultar esta sección.</p>
      )}

      <div className="form-grid" style={{ marginBottom: "1rem", alignItems: "end" }}>
        <label className="check check--estado-catalogo">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(ev) => {
              setSoloPendientes(ev.target.checked);
              setPagJornadas((p) => ({ ...p, pagina: 1 }));
            }}
          />
          <span>Solo jornadas pendientes de abastecimiento</span>
        </label>
      </div>

      <h3 className="form-section-title">Jornadas</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Unidad</th>
              <th>Vendedor</th>
              <th>Zona</th>
              <th>Estado</th>
              <th>Abastecimiento</th>
              {puedeEditar ? <th>Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {jornadas.map((j) => (
              <tr key={j.id}>
                <td>
                  {j.fechaOperacion} · {j.horaInicio}
                  {j.horaFin ? `–${j.horaFin}` : ""}
                </td>
                <td>{j.codigoUnidad}</td>
                <td>{j.nombreVendedor}</td>
                <td>{j.nombreZona}</td>
                <td>{etiquetaEstadoJornada(j.estado)}</td>
                <td>{j.tieneAbastecimiento ? "Registrado" : "Pendiente"}</td>
                {puedeEditar ? (
                  <td>
                    {j.estado === "PLANNED" && !j.tieneAbastecimiento ? (
                      <button type="button" onClick={() => abrirModalEntrega(j)}>
                        Registrar entrega
                      </button>
                    ) : (
                      <span className="subtle">—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="paginacion">
        <span>
          Página {pagJornadas.pagina} de {pagJornadas.totalPaginas} · Total {pagJornadas.total}
        </span>
        <div className="paginacion-acciones">
          <button
            type="button"
            className="btn-paginacion"
            disabled={pagJornadas.pagina <= 1}
            onClick={() => cambiarPagJornadas("prev")}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn-paginacion"
            disabled={pagJornadas.pagina >= pagJornadas.totalPaginas}
            onClick={() => cambiarPagJornadas("next")}
          >
            Siguiente
          </button>
        </div>
      </div>

      <h3 className="form-section-title" style={{ marginTop: "2rem" }}>
        Últimos abastecimientos
      </h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Entregado</th>
              <th>Unidad</th>
              <th>Vendedor</th>
              <th>Zona</th>
              <th>Estado</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {abastecimientos.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.entregadoEn).toLocaleString("es-BO")}</td>
                <td>{a.codigoUnidad}</td>
                <td>{a.nombreVendedor}</td>
                <td>{a.nombreZona}</td>
                <td>{etiquetaEstadoAbastecimiento(a.estado)}</td>
                <td>
                  <button type="button" className="btn-small" onClick={() => void verDetalleAbastecimiento(a.id)}>
                    Ver líneas
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="paginacion">
        <span>
          Página {pagAbs.pagina} de {pagAbs.totalPaginas} · Total {pagAbs.total}
        </span>
        <div className="paginacion-acciones">
          <button
            type="button"
            className="btn-paginacion"
            disabled={pagAbs.pagina <= 1}
            onClick={() => cambiarPagAbs("prev")}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn-paginacion"
            disabled={pagAbs.pagina >= pagAbs.totalPaginas}
            onClick={() => cambiarPagAbs("next")}
          >
            Siguiente
          </button>
        </div>
      </div>

      {modalJornadaId ? (
        <section className="modal-overlay" onClick={() => setModalJornadaId(null)}>
          <article className="modal-card modal-card--wide" onClick={(ev) => ev.stopPropagation()}>
            <header className="modal-header">
              <h3>Registrar entrega desde almacén central</h3>
              <p className="modal-subtitle">
                Indica las cantidades a retirar por producto. Solo se envían líneas con cantidad mayor a cero.
              </p>
            </header>
            <form className="modal-form" onSubmit={confirmarEntrega}>
              <FeedbackMessage feedback={feedbackEntrega} className="modal-inline-feedback" />
              <div className="modal-body modal-body--scroll">
                <table className="table-compact">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Producto</th>
                      <th>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((p) => (
                      <tr key={p.id}>
                        <td>{p.codigo}</td>
                        <td>{p.nombre}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input-cantidad-entrega"
                            value={cantidadesEntrega[p.id] ?? ""}
                            onChange={(ev) =>
                              setCantidadesEntrega((prev) => ({ ...prev, [p.id]: ev.target.value }))
                            }
                            aria-label={`Cantidad ${p.nombre}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secundario-modal" onClick={() => setModalJornadaId(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primario-modal">
                  Confirmar entrega
                </button>
              </div>
            </form>
          </article>
        </section>
      ) : null}

      {detalleAbs || cargandoDetalle ? (
        <section className="modal-overlay" onClick={() => setDetalleAbs(null)}>
          <article className="modal-card" onClick={(ev) => ev.stopPropagation()}>
            <header className="modal-header">
              <h3>Detalle del abastecimiento</h3>
              {cargandoDetalle ? <p className="subtle">Cargando…</p> : null}
            </header>
            {detalleAbs ? (
              <>
                <div className="modal-body">
                  <p className="subtle">
                    {new Date(detalleAbs.entregadoEn).toLocaleString("es-BO")} · {detalleAbs.jornada.codigoUnidad} ·{" "}
                    {detalleAbs.jornada.nombreVendedor}
                  </p>
                  <ul className="lista-detalle-abs">
                    {detalleAbs.lineas.map((ln) => (
                      <li key={ln.idProducto}>
                        <strong>{ln.codigo}</strong> {ln.nombre}: {ln.cantidadEntregada}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-primario-modal" onClick={() => setDetalleAbs(null)}>
                    Cerrar
                  </button>
                </div>
              </>
            ) : null}
          </article>
        </section>
      ) : null}
    </article>
  );
}
