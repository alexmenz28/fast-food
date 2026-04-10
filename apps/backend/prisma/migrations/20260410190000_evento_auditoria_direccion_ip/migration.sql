-- Nombre de columna en español (antes `ip`); idempotente si ya se llama `direccion_ip`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'evento_auditoria' AND column_name = 'ip'
  ) THEN
    ALTER TABLE "evento_auditoria" RENAME COLUMN "ip" TO "direccion_ip";
  END IF;
END $$;
