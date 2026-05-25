import Database from 'better-sqlite3';
import { createTables, seedDatabase } from './schema.js';

export default class DatabaseManager {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  initialize(): void {
    createTables(this.db);
    seedDatabase(this.db);
  }

  getDb(): Database.Database {
    return this.db;
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
    const fs = require('fs');
    fs.copyFileSync(restorePath, this.dbPath);
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }
}
