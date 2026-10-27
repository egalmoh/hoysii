import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { authSchema } from './schema.js';

let cached;

export function db(env) {
  const connectionString = env.HYPERDRIVE?.connectionString;

  if (!connectionString) {
    throw new Error('The HYPERDRIVE binding is not configured.');
  }

  if (!cached || cached.connectionString !== connectionString) {
    const client = postgres(connectionString, {
      max: 1,
      prepare: false,
    });
    cached = { connectionString, client, database: drizzle(client, { schema: authSchema }) };
  }

  return cached.database;
}
