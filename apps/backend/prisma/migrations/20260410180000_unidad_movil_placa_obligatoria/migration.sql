-- Placa obligatoria en unidad móvil (identificación del vehículo).
UPDATE "unidad_movil" SET "placa" = 'SIN-ASIGNAR' WHERE "placa" IS NULL OR TRIM(BOTH FROM "placa") = '';
ALTER TABLE "unidad_movil" ALTER COLUMN "placa" SET NOT NULL;
