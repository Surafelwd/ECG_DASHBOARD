-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS ecg_ml;

-- 2. Upload Packets Table
CREATE TABLE IF NOT EXISTS ecg_ml.upload_packets (
  upload_id text PRIMARY KEY,
  device_id text NOT NULL,
  start_ms bigint NOT NULL,
  end_ms bigint NOT NULL,
  csv_text text NOT NULL,
  body_sha256 char(64) NOT NULL,
  received_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT upload_packets_window_unique UNIQUE (device_id, start_ms, end_ms),
  CHECK (end_ms > start_ms)
);

-- 3. Analysis Jobs Table
CREATE TABLE IF NOT EXISTS ecg_ml.analysis_jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  first_upload_id text NOT NULL REFERENCES ecg_ml.upload_packets(upload_id),
  second_upload_id text NOT NULL REFERENCES ecg_ml.upload_packets(upload_id),
  third_upload_id text NOT NULL REFERENCES ecg_ml.upload_packets(upload_id),
  model_sha256 char(64) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Explicit constraint name to avoid Postgres 63-byte identifier truncation notice
  CONSTRAINT analysis_jobs_window_unique UNIQUE (device_id, first_upload_id, second_upload_id, third_upload_id, model_sha256)
);

-- 4. Queue Claim Index
CREATE INDEX IF NOT EXISTS analysis_jobs_claim_idx 
  ON ecg_ml.analysis_jobs (status, next_attempt_at, lease_expires_at);

-- 5. Analysis Results Table
CREATE TABLE IF NOT EXISTS ecg_ml.analysis_results (
  job_id uuid PRIMARY KEY REFERENCES ecg_ml.analysis_jobs(job_id),
  schema_version integer NOT NULL,
  model_version integer NOT NULL,
  model_sha256 char(64) NOT NULL,
  development_only boolean NOT NULL,
  device_id text NOT NULL,
  input_start_ms bigint NOT NULL,
  input_end_ms bigint NOT NULL,
  label text NOT NULL CHECK (label IN ('af_suspected', 'normal', 'other_rhythm', 'uncertain_review')),
  quality text NOT NULL CHECK (quality IN ('usable', 'poor_signal')),
  confidence double precision NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  requires_review boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
