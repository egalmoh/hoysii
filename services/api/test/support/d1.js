import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function localD1({ beforeOperations } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  const folder = new URL('../../migrations/', import.meta.url);
  for (const migration of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
    if (migration === '0005_booking_operations.sql') beforeOperations?.(sqlite);
    sqlite.exec(readFileSync(new URL(migration, folder), 'utf8'));
  }
  return {
    close: () => sqlite.close(),
    async exec(sql) { sqlite.exec(sql); return { count: 1, duration: 0 }; },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((statement) => statement.execute());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    prepare(sql) {
      const prepared = sqlite.prepare(sql);
      let parameters = [];
      return {
        bind(...values) { parameters = values; return this; },
        execute() {
          const results = prepared.all(...parameters);
          const changes = /^\s*(?:INSERT|UPDATE|DELETE|WITH)\b/i.test(sql) ? sqlite.prepare('SELECT changes() AS count').get().count : 0;
          return { results, meta: { changes }, success: true };
        },
        async first() { return prepared.get(...parameters) || null; },
        async all() { return this.execute(); },
        async run() { return { meta: { changes: prepared.run(...parameters).changes }, success: true }; },
      };
    },
  };
}
