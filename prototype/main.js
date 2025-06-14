const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';

// Security: Content Security Policy
const cspHeader = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdn.socket.io https://cdnjs.cloudflare.com",
    "img-src 'self' data: https://rsms.me https://upload.wikimedia.org https://flagcdn.com",
    "style-src 'self' 'unsafe-inline' https://rsms.me https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
    "font-src 'self' https://rsms.me https://cdnjs.cloudflare.com https://use.fontawesome.com data:",
    "connect-src 'self' http://localhost:4000 http://138.197.106.91:4000 https://eos.greymass.com wss://localhost:4000 ws://localhost:4000 ws://138.197.106.91:4000 wss://138.197.106.91:4000",
    "frame-src 'none'",
    "object-src 'none'"
  ].join('; ')
};

function createWindow() {
  // Create the browser window
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: true,  // Allow resizing for better UX
    minWidth: 800,    // Set minimum dimensions
    minHeight: 600,
    autoHideMenuBar: true, // Hide the menu bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,      // Enable Node integration for this prototype
      contextIsolation: true,     // Keep context isolation for security
      enableRemoteModule: false,  // Improved security
      worldSafeExecuteJavaScript: true,
      sandbox: false,             // Disable sandbox to allow crypto module
      webSecurity: true,          // Improved security
      devTools: !app.isPackaged,  // Only enable devTools in development
    },
  });

  // Set security headers
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        ...cspHeader,
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block']
      }
    });
  });

  // Load the index.html file
  win.loadFile(path.join(__dirname, 'index.html'));

  // Only open DevTools in development mode and if explicitly enabled
  if (isDev && !app.isPackaged) {
    // win.webContents.openDevTools(); // Commented out to prevent auto-opening
  }

  // Prevent navigation to untrusted domains
  win.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    const validOrigins = ['http://localhost', 'file://'];
    
    if (!validOrigins.some(origin => parsedUrl.origin.startsWith(origin))) {
      event.preventDefault();
      console.warn(`Navigation to untrusted domain blocked: ${url}`);
    }
  });
}

// Create window when Electron is ready
app.whenReady().then(() => {
  createWindow();

  // Set up IPC handlers
  setupIpcHandlers();

  app.on('activate', function () {
    // On macOS, recreate a window when the dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Set up secure IPC handlers
function setupIpcHandlers() {
  // Example of a secure IPC handler
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
  
  // Persist arbitrary text data to a log file under userData
  ipcMain.handle('save-data', async (_e, key, data) => {
    try {
      if (!key) throw new Error('Invalid key');
      // Sanitize again on main side
      const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      const dir = app.getAppPath();
      const filePath = path.join(dir, `${safeKey}.log`);
      fs.appendFileSync(filePath, data + '\n', { encoding: 'utf8' });
      return true;
    } catch (err) {
      console.error('save-data IPC error:', err);
      return false;
    }
  });

  // Read the entire log back (optional)
  ipcMain.handle('load-data', async (_e, key) => {
    try {
      const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      const dir = app.getAppPath();
      const filePath = path.join(dir, `${safeKey}.log`);
      if (!fs.existsSync(filePath)) return '';
      return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      console.error('load-data IPC error:', err);
      return '';
    }
  });
  
  // Add more IPC handlers as needed
}

// Security: Disable navigation to file:// URLs from remote content
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.protocol === 'file:') {
      event.preventDefault();
    }
  });
  
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    // Strip away preload scripts
    delete webPreferences.preload;
    
    // Disable Node.js integration
    webPreferences.nodeIntegration = false;
    
    // Enable context isolation
    webPreferences.contextIsolation = true;
  });
});

