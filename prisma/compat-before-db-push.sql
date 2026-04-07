-- UNIQUE antigo em login: no PostgreSQL costuma existir como CONSTRAINT "login_login_key".
-- O Prisma db push emite DROP INDEX "login_login_key", o que falha (o índice pertence à constraint).
-- Este passo remove só a constraint se existir, para o push poder alinhar ao schema.prisma.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'login'
  )
  AND EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'login_login_key'
  ) THEN
    ALTER TABLE "login" DROP CONSTRAINT "login_login_key";
  END IF;
END $$;
