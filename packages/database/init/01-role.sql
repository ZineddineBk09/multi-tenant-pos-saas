-- Create application role without superuser privileges (RLS enforcement)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pos_app') THEN
    CREATE ROLE pos_app LOGIN PASSWORD 'pos_secret';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE pos_saas TO pos_app;
GRANT USAGE ON SCHEMA public TO pos_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pos_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pos_app;
