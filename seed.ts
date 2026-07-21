import { db } from './src/db/index.js';
import { devices } from './src/db/schema.js';

async function seed() {
  await db.insert(devices).values({
    id: 'divzgcqituwgwdnjkmls',
    api_key: 'divzgcqituwgwdnjkmls', // In case they send it as api_key
    serial_number: 'SN-0001',
    owner_name: 'Admin',
    connectivity_status: 'offline',
  }).onConflictDoNothing();
  console.log('Seeded device divzgcqituwgwdnjkmls');
  process.exit(0);
}

seed();
