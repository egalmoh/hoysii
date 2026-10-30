export function db(env) {
  if (!env.DB) throw new Error('The D1 DB binding is not configured.');
  return env.DB;
}

export async function all(database, query, ...values) {
  const result = await database.prepare(query).bind(...values).all();
  return result.results || [];
}

export async function first(database, query, ...values) {
  return database.prepare(query).bind(...values).first();
}

export async function run(database, query, ...values) {
  return database.prepare(query).bind(...values).run();
}
