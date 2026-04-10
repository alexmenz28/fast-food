-- La zona operativa de cada salida es atributo de `jornada` (id_zona), no de `unidad_movil`.
ALTER TABLE "unidad_movil" DROP CONSTRAINT IF EXISTS "unidad_movil_id_zona_fkey";
DROP INDEX IF EXISTS "unidad_movil_id_zona_idx";
ALTER TABLE "unidad_movil" DROP COLUMN IF EXISTS "id_zona";
