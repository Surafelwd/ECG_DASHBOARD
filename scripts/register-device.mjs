import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

function validateId(deviceId) {
  if (typeof deviceId !== 'string' || !/^STM32-[0-9A-F]{24}$/.test(deviceId)) {
    throw new Error('Expected STM32- followed by the 24 uppercase hexadecimal UID characters.');
  }
}

export async function registerDevice(client, deviceId) {
  validateId(deviceId);
  const { rows } = await client.query(
    `SELECT id, api_key, serial_number, is_retired FROM devices
     WHERE id = $1 OR api_key = $1 OR serial_number = $1`,
    [deviceId],
  );
  if (rows.length > 1) {
    throw new Error('Multiple devices match this UID; resolve the conflict manually. No records changed.');
  }
  if (rows.length === 1) {
    const existing = rows[0];
    if (existing.is_retired) {
      throw new Error('This device is retired. Registration will not reactivate it.');
    }
    if (existing.id !== deviceId && existing.api_key !== deviceId) {
      throw new Error('UID matches only a serial number, which ingest does not accept. Resolve the existing registration manually.');
    }
    return { status: 'already_registered', id: existing.id };
  }

  // The existing ingest handler accepts devices.id. Do not use the public UID as a secret.
  const result = await client.query(
    `INSERT INTO devices (id, api_key, serial_number)
     VALUES ($1, $2, $1)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [deviceId, randomBytes(32).toString('hex')],
  );
  if (result.rows.length !== 1) {
    throw new Error('Registration conflict; no existing records were overwritten. Re-run to check the current registration.');
  }
  return { status: 'created', id: result.rows[0].id };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    throw new Error('Usage: npm run register:device -- STM32-<24 uppercase hexadecimal UID characters>');
  }
  validateId(args[0]);
  await import('dotenv/config');
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Use the intended database connection in your environment or a private .env file.');
  }
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  });
  try {
    await client.connect();
    const result = await registerDevice(client, args[0]);
    console.log(`${result.status}: ${result.id}`);
  } catch (error) {
    // Do not print driver errors, which may contain credentials or connection details.
    if (error?.code || error?.syscall) {
      throw new Error('Database operation failed. Check connectivity, credentials, and schema; no existing records were overwritten.');
    }
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
