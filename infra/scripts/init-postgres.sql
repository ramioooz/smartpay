CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS payments_schema;
CREATE SCHEMA IF NOT EXISTS merchants_schema;
CREATE SCHEMA IF NOT EXISTS routing_schema;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'payment_srv_user') THEN
    CREATE USER payment_srv_user WITH PASSWORD 'payment_srv_password';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'merchant_srv_user') THEN
    CREATE USER merchant_srv_user WITH PASSWORD 'merchant_srv_password';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'routing_srv_user') THEN
    CREATE USER routing_srv_user WITH PASSWORD 'routing_srv_password';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA payments_schema TO payment_srv_user;
GRANT CREATE ON SCHEMA payments_schema TO payment_srv_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA payments_schema TO payment_srv_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA payments_schema TO payment_srv_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA payments_schema GRANT ALL ON TABLES TO payment_srv_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA payments_schema GRANT ALL ON SEQUENCES TO payment_srv_user;

GRANT USAGE ON SCHEMA merchants_schema TO merchant_srv_user;
GRANT CREATE ON SCHEMA merchants_schema TO merchant_srv_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA merchants_schema TO merchant_srv_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA merchants_schema TO merchant_srv_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA merchants_schema GRANT ALL ON TABLES TO merchant_srv_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA merchants_schema GRANT ALL ON SEQUENCES TO merchant_srv_user;

GRANT USAGE ON SCHEMA routing_schema TO routing_srv_user;
GRANT CREATE ON SCHEMA routing_schema TO routing_srv_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA routing_schema TO routing_srv_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA routing_schema TO routing_srv_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA routing_schema GRANT ALL ON TABLES TO routing_srv_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA routing_schema GRANT ALL ON SEQUENCES TO routing_srv_user;
