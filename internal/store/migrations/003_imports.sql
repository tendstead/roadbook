CREATE TABLE import_rows (fingerprint text NOT NULL REFERENCES import_batches, source_row integer NOT NULL, PRIMARY KEY(fingerprint,source_row));
