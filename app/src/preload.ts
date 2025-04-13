import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'electron',
    {
        invoke: (channel: string, data: any) => {
            // whitelist channels
            const validChannels = [
                'login', 
                'register', 
                'connect-ssh-with-key',
                'connect-ssh-with-password',
                'terminal-input',
                'disconnect-terminal',
                'update-terminal-size'
            ];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, data);
            }
            return Promise.reject(new Error('Invalid channel'));
        },
        // Add method to update auth data in the main process
        updateAuth: (authData: { token: string, token_type: string, user_email: string }) => {
            ipcRenderer.send('auth-update', authData);
        },
        // Listen for terminal data
        onTerminalData: (callback: (data: { terminalId: string, data: string }) => void) => {
            ipcRenderer.on('terminal-data', (_, data) => callback(data));
            return () => {
                ipcRenderer.removeAllListeners('terminal-data');
            };
        }
    }
); 