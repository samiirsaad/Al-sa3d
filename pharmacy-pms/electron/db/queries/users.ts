import { Database } from 'better-sqlite3';

export function createUserQueries(db: Database) {
  const createUser = (username: string, passwordHash: string, role: string, fullName: string) => {
    const stmt = db.prepare(`
      INSERT INTO users (username, password_hash, role, full_name, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, datetime('now'))
    `);
    return stmt.run(username, passwordHash, role, fullName);
  };

  const getUserByUsername = (username: string) => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1');
    return stmt.get(username) as any;
  };

  const getUserById = (id: number) => {
    const stmt = db.prepare('SELECT id, username, role, full_name, is_active, created_at FROM users WHERE id = ?');
    return stmt.get(id) as any;
  };

  const getAllUsers = () => {
    const stmt = db.prepare('SELECT id, username, role, full_name, is_active, created_at FROM users ORDER BY username');
    return stmt.all() as any[];
  };

  const updateUser = (id: number, updates: { full_name?: string; role?: string; is_active?: number }) => {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    const stmt = db.prepare(`UPDATE users SET ${fields}, updated_at = datetime('now') WHERE id = ?`);
    return stmt.run(...values, id);
  };

  const deleteUser = (id: number) => {
    const stmt = db.prepare('UPDATE users SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?');
    return stmt.run(id);
  };

  return { createUser, getUserByUsername, getUserById, getAllUsers, updateUser, deleteUser };
}
