import { BrowserWindow, ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { NodeSSH } from 'node-ssh';
import * as crypto from 'crypto';

// Store for active SSH connections
const activeConnections: Map<string, NodeSSH> = new Map();

// Store for active SSH shells
const activeShells: Map<string, any> = new Map();

// Path for temporary SSH keys
const tempKeyPath = path.join(app.getPath('temp'), 'sshy-keys');

// Ensure temp directory exists
if (!fs.existsSync(tempKeyPath)) {
    fs.mkdirSync(tempKeyPath, { recursive: true });
}

// Function to convert OpenSSH key format to PEM format
async function convertOpenSSHtoPEM(originalKey: string): Promise<string> {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    
    // Create temporary files for the key conversion
    const tempInputPath = path.join(tempKeyPath, `${crypto.randomBytes(8).toString('hex')}_input_key`);
    const tempOutputPath = path.join(tempKeyPath, `${crypto.randomBytes(8).toString('hex')}_output_key`);
    
    try {
        // Write the original key to the input file
        fs.writeFileSync(tempInputPath, originalKey, { mode: 0o600 });
        
        // Use ssh-keygen to convert the key format
        await execFileAsync('ssh-keygen', [
            '-p',
            '-m', 'PEM',
            '-f', tempInputPath,
            '-N', ''  // No passphrase
        ]);
        
        // Read the converted key
        const convertedKey = fs.readFileSync(tempInputPath, 'utf8');
        
        return convertedKey;
    } catch (error) {
        console.error('Error converting key format:', error);
        // Return the original key if conversion fails
        return originalKey;
    } finally {
        // Clean up temporary files
        try {
            if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
            if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
        } catch (err) {
            console.error('Error cleaning up temporary key files:', err);
        }
    }
}

// Setup terminal-related IPC handlers
export function setupTerminalHandlers() {
    // Handle terminal input globally
    ipcMain.handle('terminal-input', async (event, { terminalId, data }) => {
        try {
            const shell = activeShells.get(terminalId);
            if (shell) {
                // Check if it's an SSH shell or a local shell process
                if (shell.write && typeof shell.write === 'function' && !shell.closed) {
                    // SSH shell
                    shell.write(data);
                    return { success: true };
                } else if (shell.stdin && !shell.killed) {
                    // Local shell process
                    shell.stdin.write(data);
                    return { success: true };
                } else if (shell.readable && shell.writable) {
                    // Direct ssh2 shell stream
                    shell.write(data);
                    return { success: true };
                }
            }
            return { success: false, message: 'Shell not available or not writable' };
        } catch (error) {
            console.error('Error writing to shell:', error);
            return { 
                success: false, 
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });

    // Connect to SSH server with key authentication
    ipcMain.handle('connect-ssh-with-key', async (event, args) => {
        try {
            const { server, auth, terminalId, dimensions } = args;
            const { username, address } = server;
            let { privateKey } = auth;

            // Parse host and port from address
            const [host, port] = address.split(':');

            // Check if the key is in OpenSSH format
            const isOpenSSHFormat = privateKey.trim().startsWith('-----BEGIN OPENSSH PRIVATE KEY-----');

            if (isOpenSSHFormat) {
                console.log('Detected OpenSSH format key, attempting conversion');
                try {
                    // Try to convert the OpenSSH format to PEM format
                    privateKey = await convertOpenSSHtoPEM(privateKey);
                } catch (errorObj) {
                    const err = errorObj as Error;
                    console.error('Failed to convert key format using ssh-keygen:', err);
                    // Continue with original key, will try with direct approach below
                }
            }

            // Generate a unique filename for the private key
            const keyFileName = `${crypto.randomBytes(8).toString('hex')}_id_rsa`;
            const keyFilePath = path.join(tempKeyPath, keyFileName);

            // Write private key to file
            fs.writeFileSync(keyFilePath, privateKey, { mode: 0o600 });

            // Create new SSH connection
            const ssh = new NodeSSH();
            
            // Get the window to send terminal data
            const window = BrowserWindow.fromWebContents(event.sender);

            try {
                // First try: Standard connection approach
                try {
                    await ssh.connect({
                        host: host,
                        port: port ? parseInt(port) : 22,
                        username: username,
                        privateKey: keyFilePath,
                        readyTimeout: 30000,
                        // Allow connection even if host key verification fails
                        hostVerifier: () => true,
                        // Add passphrase option if key is encrypted
                        passphrase: auth.passphrase || undefined
                    });
                } catch (errorObj) {
                    const err = errorObj as Error;
                    console.error('Initial SSH connection attempt failed:', err);
                    
                    // If the first attempt failed due to key format issues, try an alternative approach
                    if (isOpenSSHFormat && err.message && err.message.includes('Unsupported key format')) {
                        console.log('Trying alternative connection approach for OpenSSH key');
                        
                        // Directly use the ssh2 Client for more control
                        const SSH2 = require('ssh2');
                        const conn = new SSH2.Client();
                        
                        // Create a promise to handle the SSH connection
                        await new Promise<void>((resolve, reject) => {
                            conn.on('ready', () => {
                                console.log('SSH2 Client connection successful');
                                resolve();
                            }).on('error', (err: Error) => {
                                reject(err);
                            }).connect({
                                host: host,
                                port: port ? parseInt(port) : 22,
                                username: username,
                                privateKey: fs.readFileSync(keyFilePath),
                                passphrase: auth.passphrase || undefined,
                                // This will help with some OpenSSH keys
                                algorithms: {
                                    serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'rsa-sha2-512', 'rsa-sha2-256'],
                                    cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-gcm', 'aes128-gcm@openssh.com', 'aes256-gcm', 'aes256-gcm@openssh.com'],
                                    kex: ['curve25519-sha256', 'curve25519-sha256@libssh.org', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521', 'diffie-hellman-group-exchange-sha256', 'diffie-hellman-group14-sha256', 'diffie-hellman-group16-sha512', 'diffie-hellman-group18-sha512'],
                                    hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1']
                                }
                            });
                        });
                        
                        // Now setup the shell using the ssh2 connection
                        let shellStream: any;
                        await new Promise<void>((resolve, reject) => {
                            conn.shell({
                                term: 'xterm-256color',
                                rows: dimensions?.rows || 24,
                                cols: dimensions?.cols || 80
                            }, (err: Error | null, stream: any) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                
                                shellStream = stream;
                                
                                // Store the shell
                                activeShells.set(terminalId, stream);
                                
                                // Handle data from the shell
                                stream.on('data', (data: Buffer) => {
                                    if (window) {
                                        window.webContents.send('terminal-data', {
                                            terminalId,
                                            data: data.toString()
                                        });
                                    }
                                });
                                
                                // Handle shell exit
                                stream.on('close', () => {
                                    console.log('Shell session closed');
                                    if (window) {
                                        window.webContents.send('terminal-data', {
                                            terminalId,
                                            data: '\r\n\x1b[1;31mShell session closed\x1b[0m\r\n'
                                        });
                                    }
                                    
                                    // Clean up
                                    activeShells.delete(terminalId);
                                    conn.end();
                                    activeConnections.delete(terminalId);
                                    try {
                                        fs.unlinkSync(keyFilePath);
                                    } catch (err) {
                                        console.error('Failed to delete key file:', err);
                                    }
                                });
                                
                                resolve();
                            });
                        });
                        
                        // Create a minimal wrapper to make the fallback compatible with terminal-input handler
                        const sshWrapper = {
                            dispose: () => {
                                conn.end();
                            }
                        };
                        
                        // Store the SSH connection wrapper
                        activeConnections.set(terminalId, sshWrapper as any);
                        
                        console.log('OpenSSH key shell setup completed successfully');
                        return { success: true };
                    } else {
                        // If it's not a key format issue or the alternative approach also failed, re-throw the error
                        throw err;
                    }
                }

                // Store the connection
                activeConnections.set(terminalId, ssh);

                // Create an interactive shell session with provided dimensions
                const shell = await ssh.requestShell({
                    term: 'xterm-256color',
                    rows: dimensions?.rows || 24,
                    cols: dimensions?.cols || 80
                });

                // Store the shell
                activeShells.set(terminalId, shell);

                // Handle data from the shell
                shell.on('data', (data: Buffer) => {
                    if (window) {
                        window.webContents.send('terminal-data', {
                            terminalId,
                            data: data.toString()
                        });
                    }
                });

                // Handle shell exit
                shell.on('close', () => {
                    console.log('Shell session closed');
                    if (window) {
                        window.webContents.send('terminal-data', {
                            terminalId,
                            data: '\r\n\x1b[1;31mShell session closed\x1b[0m\r\n'
                        });
                    }
                    // Clean up
                    activeShells.delete(terminalId);
                    ssh.dispose();
                    activeConnections.delete(terminalId);
                    try {
                        fs.unlinkSync(keyFilePath);
                    } catch (err) {
                        console.error('Failed to delete key file:', err);
                    }
                });

                return { success: true };
            } catch (error) {
                // Clean up key file on error
                try {
                    fs.unlinkSync(keyFilePath);
                } catch (err) {
                    console.error('Failed to delete key file:', err);
                }
                throw error;
            }
        } catch (error) {
            console.error('Error connecting with SSH key:', error);
            return { 
                success: false, 
                message: error instanceof Error ? 
                    `${error.message}. If using an OpenSSH format key, try converting it to PEM format using: ssh-keygen -p -m PEM -f your_key_file` 
                    : 'Unknown error'
            };
        }
    });

    // Connect to SSH server with password authentication
    ipcMain.handle('connect-ssh-with-password', async (event, args) => {
        try {
            const { server, auth, terminalId, dimensions } = args;
            const { username, address } = server;
            const { password } = auth;

            // Parse host and port from address
            const [host, port] = address.split(':');
            
            // Create new SSH connection
            const ssh = new NodeSSH();
            
            // Get the window to send terminal data
            const window = BrowserWindow.fromWebContents(event.sender);

            try {
                await ssh.connect({
                    host: host,
                    port: port ? parseInt(port) : 22,
                    username: username,
                    password: password,
                    readyTimeout: 30000,
                    // Allow connection even if host key verification fails
                    hostVerifier: () => true
                });

                // Store the connection
                activeConnections.set(terminalId, ssh);

                // Create an interactive shell session with provided dimensions
                const shell = await ssh.requestShell({
                    term: 'xterm-256color',
                    rows: dimensions?.rows || 24,
                    cols: dimensions?.cols || 80
                });

                // Store the shell
                activeShells.set(terminalId, shell);

                // Handle data from the shell
                shell.on('data', (data: Buffer) => {
                    if (window) {
                        window.webContents.send('terminal-data', {
                            terminalId,
                            data: data.toString()
                        });
                    }
                });

                // Handle shell exit
                shell.on('close', () => {
                    console.log('Shell session closed');
                    if (window) {
                        window.webContents.send('terminal-data', {
                            terminalId,
                            data: '\r\n\x1b[1;31mShell session closed\x1b[0m\r\n'
                        });
                    }
                    // Clean up
                    activeShells.delete(terminalId);
                    ssh.dispose();
                    activeConnections.delete(terminalId);
                });

                return { success: true };
            } catch (error) {
                throw error;
            }
        } catch (error) {
            console.error('Error connecting with SSH password:', error);
            return { 
                success: false, 
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });

    // Disconnect terminal
    ipcMain.handle('disconnect-terminal', async (event, args) => {
        try {
            const { terminalId } = args;
            const ssh = activeConnections.get(terminalId) as any; // Use any type to handle different connection types
            const shell = activeShells.get(terminalId);

            if (shell) {
                // Close the shell - handle different types of shells
                if (shell.end && typeof shell.end === 'function') {
                    shell.end();
                } else if (shell.kill && typeof shell.kill === 'function') {
                    shell.kill();
                }
                activeShells.delete(terminalId);
            }

            if (ssh) {
                // Dispose of the SSH connection - handle both NodeSSH and ssh2 wrapper
                if (ssh.dispose && typeof ssh.dispose === 'function') {
                    ssh.dispose();
                } else if (ssh.end && typeof ssh.end === 'function') {
                    ssh.end();
                }
                activeConnections.delete(terminalId);
            }

            return { success: true };
        } catch (error) {
            console.error('Error disconnecting terminal:', error);
            return { 
                success: false, 
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });

    // Handle terminal resize events
    ipcMain.handle('update-terminal-size', async (event, args) => {
        try {
            const { terminalId, cols, rows } = args;
            const ssh = activeConnections.get(terminalId) as any; // Use any type to handle different connection types
            const shell = activeShells.get(terminalId);

            if (!shell) {
                return { success: false, message: 'Shell not available' };
            }

            console.log(`Resizing terminal ${terminalId} to ${cols}x${rows}`);
            
            // Try different methods for resizing based on shell type
            if (shell.setWindow && typeof shell.setWindow === 'function') {
                // Direct SSH2 method
                shell.setWindow(rows, cols, 0, 0);
                return { success: true };
            } else if (!shell.closed && shell.resize && typeof shell.resize === 'function') {
                // Some shell objects have a resize method
                shell.resize(cols, rows);
                return { success: true };
            } else if (ssh && typeof ssh.execCommand === 'function') {
                // NodeSSH approach
                await ssh.execCommand(`stty rows ${rows} cols ${cols}`, { execOptions: { pty: true } });
                return { success: true };
            }
            
            return { success: false, message: 'Shell resize method not available' };
        } catch (error) {
            console.error('Error resizing terminal:', error);
            return { 
                success: false, 
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });
}

// Clean up all terminal connections and temporary files
export function cleanupTerminals() {
    // Close all active SSH connections
    for (const [terminalId, ssh] of activeConnections.entries()) {
        console.log(`Closing SSH connection: ${terminalId}`);
        ssh.dispose();
    }
    activeConnections.clear();
    
    // Clean up the temp directory
    try {
        if (fs.existsSync(tempKeyPath)) {
            const files = fs.readdirSync(tempKeyPath);
            files.forEach(file => {
                fs.unlinkSync(path.join(tempKeyPath, file));
            });
        }
    } catch (error) {
        console.error('Error cleaning up temp directory:', error);
    }
} 