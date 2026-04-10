-- Zona operativa de la unidad enlazada al catálogo `zona` (misma entidad que en jornadas).
ALTER TABLE "unidad_movil" ADD COLUMN "id_zona" UUID;

UPDATE "unidad_movil" um
SET "id_zona" = z."id"
FROM "zona" z
WHERE um."descripcion" = 'Zona: Equipetrol' AND z."nombre" = 'Equipetrol';

UPDATE "unidad_movil" um
SET "id_zona" = z."id"
FROM "zona" z
WHERE um."descripcion" = 'Zona: Zona Universitaria' AND z."nombre" = 'Zona Universitaria';

UPDATE "unidad_movil" um
SET "id_zona" = z."id"
FROM "zona" z
WHERE um."descripcion" = 'Zona: Centro' AND z."nombre" = 'Centro';

UPDATE "unidad_movil"
SET "descripcion" = NULL
WHERE "descripcion" LIKE 'Zona: %';

ALTER TABLE "unidad_movil"
  ADD CONSTRAINT "unidad_movil_id_zona_fkey"
  FOREIGN KEY ("id_zona") REFERENCES "zona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "unidad_movil_id_zona_idx" ON "unidad_movil"("id_zona");
