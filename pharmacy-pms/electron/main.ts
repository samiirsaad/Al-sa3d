import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import DatabaseManager from './db/index.js';
import { setupIpcHandlers } from './ipc/handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();
let db: DatabaseManager | null = null;
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  const dbPath = path.join(app.getPath('userData'), 'pharmacy.db');
  db = new DatabaseManager(dbPath);
  db.initialize();

  // Setup IPC handlers
  setupIpcHandlers(ipcMain, db.getDb(), store);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (db) {
    db.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle backup
ipcMain.handle('backup-database', async () => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Backup Database',
    defaultPath: `pharmacy-backup-${new Date().toISOString().split('T')[0]}.db`,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  });

  if (!result.canceled && result.filePath && db) {
    db.backup(result.filePath);
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

// Handle restore
ipcMain.handle('restore-database', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Restore Database',
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths.length > 0 && db) {
    db.restore(result.filePaths[0]);
    return { success: true };
  }
  return { success: false };
});

// Handle store set
ipcMain.handle('store-set', (_, key: string, value: any) => {
  try {
    store.set(key, value);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Handle store get
ipcMain.handle('store-get', (_, key: string) => {
  return store.get(key);
});

// Handle app restart
ipcMain.handle('app-restart', () => {
  app.relaunch();
  app.exit(0);
});
