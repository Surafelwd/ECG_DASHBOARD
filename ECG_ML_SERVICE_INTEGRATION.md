# ECG ML Service Integration

The ML service analyzes three consecutive 10-second ECG uploads as one 30-second window. It runs the model locally on the ML server and stores jobs and results in Neon.

## Required setup

1. Apply `migrations/001_ecg_ml.sql` to the Neon database.
2. Deploy the FastAPI web service and background worker from `render.yaml`.
3. Give both services the same environment variables:
   - `DATABASE_URL`
   - `ML_SERVICE_API_KEY`
   - `ECG_MODEL_PATH=models/ecg_v5_development_xz.joblib`
4. Add `ML_SERVICE_URL` and the same `ML_SERVICE_API_KEY` to the dashboard backend.

## Forward each upload

After the dashboard has validated and stored a board upload, send:

```http
POST {ML_SERVICE_URL}/v1/ecg/uploads
Authorization: Bearer {ML_SERVICE_API_KEY}
Content-Type: application/json
```

```json
{
  "upload_id": "permanent-dashboard-upload-id",
  "device_id": "STM32-0049002D5033500A20353741",
  "received_at": "2026-09-13T12:00:00Z",
  "csv_text": "original uploaded CSV content"
}
```

Return the board's successful HTTP response after its upload is safely stored. Do not make the board wait for ML inference, and do not turn a successful board upload into an error when the ML service is unavailable.

An HTTP 202 response means the ML service accepted the packet. `analysis_job_id` remains `null` until three timestamp-contiguous packets are available. Retry HTTP 503 and network failures from the backend. Reusing the same `upload_id` with identical content is safe.

## Read results

All result requests use the same bearer token:

- `GET /v1/ecg/jobs/{job_id}`
- `GET /v1/ecg/analyses/{device_id}/latest`
- `GET /v1/ecg/analyses/{device_id}?limit=20`

Keep `ML_SERVICE_API_KEY` on the backend. Never include it in browser code.

The current Revision 5 model is for research and development. Display its output as requiring review rather than as a clinical diagnosis.
