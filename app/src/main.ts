import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import axios from 'axios';
import { setupAuthHandlers } from './auth';
import * as fs from 'fs';

// API configuration
const API_URL = 'http://localhost:8000';

// Store auth data
let authData = {
    token: '',
    token_type: '',
    user_email: ''
};

// Path for storing persistent auth data
const authDataPath = path.join(app.getPath('userData'), 'auth-data.json');

// Function to save auth data to file
function saveAuthData() {
    try {
        fs.writeFileSync(authDataPath, JSON.stringify(authData), 'utf-8');
        console.log('Auth data saved');
    } catch (error) {
        console.error('Failed to save auth data:', error);
    }
}

// Function to load auth data from file
function loadAuthData() {
    try {
        if (fs.existsSync(authDataPath)) {
            const data = fs.readFileSync(authDataPath, 'utf-8');
            authData = JSON.parse(data);
            console.log('Auth data loaded');
            return true;
        }
    } catch (error) {
        console.error('Failed to load auth data:', error);
    }
    return false;
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1024,
        height: 640,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
    });

    // Set Content Security Policy
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Access-Control-Allow-Origin': ['*'],
                'Content-Security-Policy': [
                    "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval';",
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
                    "style-src 'self' 'unsafe-inline' https: data:;",
                    "font-src 'self' https: data:;",
                    "img-src 'self' https: data:;",
                    "connect-src 'self' https: http://localhost:*;"
                ].join(' ')
            }
        });
    });

    // Enable CORS for all requests
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({
            requestHeaders: {
                ...details.requestHeaders,
                'Origin': '*'
            }
        });
    });

    // In development, the files are in dist/web
    // In production, they will be in dist/web
    const htmlPath = path.join(__dirname, 'web', 'index.html');
    mainWindow.loadFile(htmlPath);

    // Open DevTools in development
    // if (!app.isPackaged) {
    //     mainWindow.webContents.openDevTools();
    // }

    // Handle page load to check for auth data and inject it
    mainWindow.webContents.on('did-finish-load', () => {
        // If we have auth data and we're on the index page, inject it
        if (authData.token && mainWindow.webContents.getURL().includes('index.html')) {
            mainWindow.webContents.executeJavaScript(`
                localStorage.setItem('auth_token', '${authData.token}');
                localStorage.setItem('token_type', '${authData.token_type}');
                localStorage.setItem('user_email', '${authData.user_email}');
                // Redirect to dashboard if authenticated
                window.location.href = 'dashboard.html';
            `);
        }
    });

    // Listen for authentication changes from renderer process
    ipcMain.on('auth-update', (_event, data) => {
        authData = data;
        saveAuthData();
    });
}

app.whenReady().then(() => {
    // Load auth data before creating window
    loadAuthData();
    createWindow();
    setupAuthHandlers();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    // Save auth data when all windows are closed
    saveAuthData();
    if (process.platform !== 'darwin') app.quit();
});

// Save auth data when app is about to quit
app.on('before-quit', () => {
    saveAuthData();
});
