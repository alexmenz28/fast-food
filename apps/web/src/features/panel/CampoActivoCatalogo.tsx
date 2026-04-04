type CampoActivoCatalogoProps = {
  /** Valor actual del registro (para default del check o texto solo lectura). */
  activo: boolean;
  /** Si el usuario puede cambiar el checkbox (administrador). */
  puedeEditarEstado: boolean;
};

/**
 * Un solo lugar para el estado «activo en catálogo»: checkbox editable (admin)
 * o resumen de solo lectura (almacén).
 */
export function CampoActivoCatalogo({ activo, puedeEditarEstado }: CampoActivoCatalogoProps) {
  if (puedeEditarEstado) {
    return (
      <div className="campo-estado-catalogo">
        <label className="check check--estado-catalogo">
          <input type="checkbox" name="activo" defaultChecked={activo} />
          <span>Activo en catálogo</span>
        </label>
        <p className="subtle campo-estado-catalogo__ayuda">
          Si lo desmarcas y guardas, el registro queda inactivo (no se borra). Vuelve a marcarlo para reactivarlo.
        </p>
      </div>
    );
  }
  return (
    <div className="campo-estado-catalogo campo-estado-catalogo--solo-lectura">
      <p className="subtle">
        Estado en catálogo: <strong>{activo ? "Activo" : "Inactivo"}</strong>
      </p>
      <p className="subtle">Solo el administrador puede cambiar activo / inactivo desde esta pantalla.</p>
    </div>
  );
}
