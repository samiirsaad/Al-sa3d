import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export default class DB {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
  }

  backup(backupPath: string): void {
    const backup = this.db.backup(backupPath);
    backup.progress(100);
  }

  restore(restorePath: string): void {
    this.db.close();
    fs.copyFileSync(restorePath, this.db.name);
    this.db = new Database(this.db.name);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  getPath(): string {
    return this.db.name;
  }
}
