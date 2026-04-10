-- Catálogo de estados operativos (sustituye el enum PostgreSQL estado_unidad_movil).
CREATE TABLE "catalogo_estado_unidad_movil" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "catalogo_estado_unidad_movil_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalogo_estado_unidad_movil_codigo_key" ON "catalogo_estado_unidad_movil"("codigo");

INSERT INTO "catalogo_estado_unidad_movil" ("codigo", "nombre", "orden", "activo") VALUES
('ACTIVA', 'Activa', 1, true),
('MANTENIMIENTO', 'Mantenimiento', 2, true),
('FUERA_DE_SERVICIO', 'Fuera de servicio', 3, true);

ALTER TABLE "unidad_movil" ADD COLUMN "id_estado_operativo" INTEGER;

-- Migra desde enum (etiquetas en español o nombres Prisma en inglés).
UPDATE "unidad_movil" u
SET "id_estado_operativo" = c.id
FROM "catalogo_estado_unidad_movil" c
WHERE u.estado_operativo::text = c.codigo
   OR (u.estado_operativo::text = 'ACTIVE' AND c.codigo = 'ACTIVA')
   OR (u.estado_operativo::text = 'MAINTENANCE' AND c.codigo = 'MANTENIMIENTO')
   OR (u.estado_operativo::text = 'OUT_OF_SERVICE' AND c.codigo = 'FUERA_DE_SERVICIO');

UPDATE "unidad_movil"
SET "id_estado_operativo" = (SELECT id FROM "catalogo_estado_unidad_movil" WHERE "codigo" = 'ACTIVA' LIMIT 1)
WHERE "id_estado_operativo" IS NULL;

ALTER TABLE "unidad_movil" ALTER COLUMN "id_estado_operativo" SET NOT NULL;

ALTER TABLE "unidad_movil" DROP COLUMN "estado_operativo";

DROP TYPE IF EXISTS "estado_unidad_movil";

ALTER TABLE "unidad_movil" ADD CONSTRAINT "unidad_movil_id_estado_operativo_fkey"
  FOREIGN KEY ("id_estado_operativo") REFERENCES "catalogo_estado_unidad_movil"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
