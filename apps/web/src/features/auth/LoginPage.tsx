import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { IconMoon, IconSun } from "../../icons";
import { API_V1_URL } from "../../shared/api/config";
import { parseSesion, SESSION_KEY, type Sesion } from "../../shared/session";
import { FeedbackMessage, type FeedbackState } from "../../shared/ui/FeedbackMessage";
import { useTheme } from "../../theme";

export function LoginPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (parseSesion(sessionStorage.getItem(SESSION_KEY))) {
      navigate("/resumen", { replace: true });
    }
  }, [navigate]);

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const usuario = String(form.get("usuario") ?? "").trim();
    const contrasena = String(form.get("contrasena") ?? "");
    if (!usuario || !contrasena) {
      setFeedback({ tipo: "warning", text: "Completa usuario y contraseña." });
      return;
    }
    setFeedback(null);
    setEnviando(true);
    try {
      const res = await fetch(`${API_V1_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, contrasena }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        data?: {
          token: string;
          usuario: { nombreUsuario: string; nombreCompleto: string; rol: string };
        };
      };
      if (!res.ok || !body.ok || !body.data?.token || !body.data.usuario) {
        setFeedback({ tipo: "error", text: String(body.error ?? "No se pudo iniciar sesión.") });
        return;
      }
      const u = body.data.usuario;
      const rol = u.rol;
      if (rol !== "ADMINISTRADOR" && rol !== "ALMACEN" && rol !== "SUPERVISOR") {
        setFeedback({ tipo: "error", text: "Rol no reconocido." });
        return;
      }
      const sesion: Sesion = {
        token: body.data.token,
        nombreUsuario: u.nombreUsuario,
        nombreCompleto: u.nombreCompleto,
        rol,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
      navigate("/resumen", { replace: true });
    } catch {
      setFeedback({ tipo: "error", text: "Error de red. Verifica que el backend esté activo." });
    } finally {
      setEnviando(false);
    }
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
            <p className="auth-tagline">Abastecimiento · Unidades móviles</p>
          </div>
        </div>
        <p className="auth-lead">Sistema de gestión de abastecimiento</p>
        <form onSubmit={iniciarSesion}>
          <p className="subtle" style={{ margin: 0, fontSize: "0.82rem" }}>
            Los campos con <span className="req-mark">*</span> son obligatorios.
          </p>
          <div className="form-field-block">
            <label htmlFor="login-usuario">
              Usuario <span className="req-mark">*</span>
            </label>
            <p className="form-field-hint">Nombre de usuario del rol (ADMINISTRADOR, ALMACEN o SUPERVISOR).</p>
            <input
              id="login-usuario"
              name="usuario"
              autoComplete="username"
              required
            />
          </div>
          <div className="form-field-block">
            <label htmlFor="login-clave">
              Contraseña <span className="req-mark">*</span>
            </label>
            <p className="form-field-hint">Credencial asociada a la cuenta (ver README / seed).</p>
            <input
              id="login-clave"
              name="contrasena"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" disabled={enviando}>
            {enviando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
  {/**      <small>
          Tras <code>npm run db:seed</code>, la contrasena por defecto es la indicada en README (variable{" "}
          <code>SEED_DEMO_PASSWORD</code>).
        </small> */}
        <FeedbackMessage feedback={feedback} />
      </section>
    </main>
  );
}
