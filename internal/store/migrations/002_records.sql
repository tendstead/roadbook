CREATE TABLE profiles (id uuid PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120));
INSERT INTO profiles VALUES(gen_random_uuid(),'Me');
CREATE TABLE vehicles (id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles, body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE vehicle_members (vehicle_id uuid NOT NULL REFERENCES vehicles ON DELETE CASCADE, profile_id uuid NOT NULL REFERENCES profiles, PRIMARY KEY(vehicle_id,profile_id));
CREATE TABLE schedules (id uuid PRIMARY KEY, vehicle_id uuid NOT NULL REFERENCES vehicles, body jsonb NOT NULL);
CREATE TABLE entries (id uuid PRIMARY KEY, vehicle_id uuid NOT NULL REFERENCES vehicles, payer_id uuid NOT NULL REFERENCES profiles, kind text NOT NULL CHECK(kind IN ('fuel','expense')), on_date date NOT NULL, body jsonb NOT NULL, sequence bigint GENERATED ALWAYS AS IDENTITY, schedule_id uuid REFERENCES schedules, UNIQUE(schedule_id,on_date));
CREATE INDEX entries_vehicle_date ON entries(vehicle_id,on_date,sequence);
CREATE TABLE attachments (id uuid PRIMARY KEY, entry_id uuid NOT NULL REFERENCES entries ON DELETE CASCADE, body jsonb NOT NULL);
CREATE TABLE import_batches (fingerprint text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), record_count integer NOT NULL);
