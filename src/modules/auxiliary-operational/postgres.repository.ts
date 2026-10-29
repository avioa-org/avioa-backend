import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

/** Fixed application SQL only. Values always use PostgreSQL bind parameters. */
export function compileSql(
  source: string,
  values: unknown[],
  previousChanges = 0,
) {
  let sql = source.replace(/INSERT OR IGNORE INTO/g, 'INSERT INTO');
  const ignore = /INSERT OR IGNORE INTO/.test(source);
  sql = sql.replace(
    /instr\(lower\(reservation_code\),lower\(\?\)\)>0/g,
    'strpos(lower(reservation_code),lower(?))>0',
  );
  sql = sql.replace(/\bby\b/g, '"by"');
  let i = 0;
  const args = [...values];
  // Quoted literals are skipped, so a question mark in a SQL string is never a parameter.
  sql = sql.replace(/'(?:''|[^'])*'|\?/g, (token) =>
    token === '?' ? '$' + ++i : token,
  );
  if (sql.includes('changes()>0')) {
    args.push(previousChanges);
    sql = sql.replace(/changes\(\)>0/g, '$' + args.length + '::integer>0');
  }
  if (ignore && !/ON CONFLICT/i.test(sql)) sql += ' ON CONFLICT DO NOTHING';
  return { sql, values: args };
}
export interface SqlResult<T = Record<string, unknown>> {
  results: T[];
  meta: { changes: number };
}
type Executor = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};
export class SqlStatement {
  constructor(
    readonly database: SqlDatabase,
    readonly sql: string,
    readonly values: unknown[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new SqlStatement(this.database, this.sql, values);
  }
  async all<T = Record<string, unknown>>() {
    return this.database.execute<T>(this);
  }
  async first<T = Record<string, unknown>>() {
    return (await this.all<T>()).results[0] || null;
  }
  async run() {
    return this.database.execute(this);
  }
}
@Injectable()
export class SqlDatabase {
  constructor(private readonly prisma: PrismaService) {}
  prepare(sql: string) {
    return new SqlStatement(this, sql);
  }
  async execute<T = Record<string, unknown>>(
    statement: SqlStatement,
    executor: Executor = this.prisma,
    previousChanges = 0,
  ): Promise<SqlResult<T>> {
    const compiled = compileSql(
      statement.sql,
      statement.values,
      previousChanges,
    );
    if (/^\s*SELECT\b/i.test(compiled.sql)) {
      const rows = await executor.$queryRawUnsafe<Record<string, unknown>[]>(
        compiled.sql,
        ...compiled.values,
      );
      return {
        results: rows.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [
              k,
              typeof v === 'bigint' ? Number(v) : v,
            ]),
          ),
        ) as T[],
        meta: { changes: 0 },
      };
    }
    const changes = await executor.$executeRawUnsafe(
      compiled.sql,
      ...compiled.values,
    );
    return { results: [], meta: { changes } };
  }
  async batch(statements: SqlStatement[]) {
    return this.prisma.$transaction(
      async (transaction) => {
        const results: SqlResult[] = [];
        let previous = 0;
        for (const statement of statements) {
          const result = await this.execute(statement, transaction, previous);
          results.push(result);
          previous = result.meta.changes;
        }
        return results;
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }
  /** Serialize shared AI quota reservations across all processes using this PostgreSQL DB. */
  async reserve(statement: SqlStatement) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(74231021)',
      );

      return this.execute(statement, transaction);
    });
  }
}
