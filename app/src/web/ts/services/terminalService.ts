import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { decryptAuthData } from './encryption';

// Re-enable the CSS import as we've updated webpack to handle it
import '@xterm/xterm/css/xterm.css';

// Terminal instances map (ID -> Terminal instance)
const terminals: Map<string, Terminal> = new Map();

// Terminal container elements
const terminalContainers: Map<string, HTMLElement> = new Map();

// Terminal ID counter for generating unique IDs
let terminalIdCounter = 0;

// Active tabs/terminals
const activeTabs: Map<string, {
    terminal: Terminal;
    server?: ServerData;
    connected: boolean;
}> = new Map();

// Store terminal dimensions to preserve them between tab switches
const terminalDimensions: Map<string, { cols: number; rows: number }> = new Map();

/**
 * Sets up global terminal data handler
 */
const setupTerminalDataHandler = () => {
    console.log('Setting up terminal data handler...');
    
    window.electron.onTerminalData(({ terminalId, data }) => {
        console.log(`Received terminal data for ${terminalId}, length: ${data.length}`);
        
        const terminal = terminals.get(terminalId);
        if (terminal) {
            try {
                terminal.write(data);
                console.log('Successfully wrote data to terminal');
            } catch (err) {
                console.error('Error writing to terminal:', err);
            }
        } else {
            console.error(`No terminal found for ID: ${terminalId}`);
            // Try to find the terminal by iterating through all keys
            console.log('Available terminal IDs:', Array.from(terminals.keys()));
        }
    });
    
    console.log('Terminal data handler setup complete');
};

// Set up the handler when this module loads
setupTerminalDataHandler();

/**
 * Initializes a new terminal instance
 */
export const createTerminal = (
    containerId: string,
    options: { rows?: number; cols?: number; fontFamily?: string; fontSize?: number } = {}
): Terminal => {
    console.log(`Creating terminal for container: ${containerId}`);
    
    // Configure terminal options
    const terminalOptions = {
        cursorBlink: true,
        fontFamily: options.fontFamily || 'Menlo, Monaco, "Courier New", monospace',
        fontSize: options.fontSize || 14,
        // Don't set initial rows/cols - let FitAddon handle it
        allowTransparency: false,
        rendererType: 'webgl', // Use WebGL renderer for better performance
        scrollback: 10000,
        disableStdin: false,
        theme: {
            background: document.documentElement.getAttribute('data-theme') === 'dark' 
                ? '#1a1a1a' : '#f5f5f5',
            foreground: document.documentElement.getAttribute('data-theme') === 'dark'
                ? '#f8f8f8' : '#333333',
            cursor: document.documentElement.getAttribute('data-theme') === 'dark'
                ? '#f8f8f8' : '#333333',
            selectionBackground: 'rgba(255, 255, 255, 0.3)',
            black: '#000000',
            red: '#cd3131',
            green: '#0dbc79',
            yellow: '#e5e510',
            blue: '#2472c8',
            magenta: '#bc3fbc',
            cyan: '#11a8cd',
            white: '#e5e5e5',
            brightBlack: '#666666',
            brightRed: '#f14c4c',
            brightGreen: '#23d18b',
            brightYellow: '#f5f543',
            brightBlue: '#3b8eea',
            brightMagenta: '#d670d6',
            brightCyan: '#29b8db',
            brightWhite: '#e5e5e5'
        }
    };

    // Create terminal instance
    const terminal = new Terminal(terminalOptions);
    terminals.set(containerId, terminal);
    
    console.log(`Terminal created and stored with ID: ${containerId}`);
    console.log(`Current terminal IDs: ${Array.from(terminals.keys())}`);

    return terminal;
};

/**
 * Initialize terminal with addons and mount to DOM
 */
export const initializeTerminal = (containerId: string, terminal: Terminal): void => {
    console.log(`Initializing terminal for container: ${containerId}`);
    
    // Get terminal container
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Terminal container ${containerId} not found`);
        return;
    }

    // Store the container
    terminalContainers.set(containerId, container);
    console.log(`Container stored for ID: ${containerId}`);

    // Make sure the terminal is registered with the right ID
    if (!terminals.has(containerId)) {
        terminals.set(containerId, terminal);
        console.log(`Terminal explicitly registered with ID: ${containerId}`);
    }

    // Set explicit styling on container for visibility
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.backgroundColor = document.documentElement.getAttribute('data-theme') === 'dark'
        ? '#1a1a1a' : '#f5f5f5';
    container.style.overflow = 'hidden';
    console.log('Set explicit styling on container');

    // Add terminal add-ons
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    // Add web links addon
    terminal.loadAddon(new WebLinksAddon());
    
    // Try to add WebGL addon for better performance
    try {
        terminal.loadAddon(new WebglAddon());
    } catch (error) {
        console.warn('WebGL addon could not be loaded:', error);
    }

    // Open terminal in the container
    console.log('Opening terminal in container...');
    terminal.open(container);
    
    // Make terminal container focusable and handle clicks
    container.tabIndex = 0;
    container.addEventListener('click', () => {
        terminal.focus();
    });

    // Function to handle resize
    const handleResize = () => {
        console.log('Handling terminal resize...');
        try {
            // Get the container dimensions
            const rect = container.getBoundingClientRect();
            console.log(`Container dimensions: ${rect.width}x${rect.height}`);
            
            // Only fit if the container has a reasonable size
            if (rect.width > 100 && rect.height > 100) {
                // Fit terminal to container
                fitAddon.fit();
                
                // Log new terminal dimensions
                console.log(`New terminal dimensions: ${terminal.cols}x${terminal.rows}`);
                
                // Store the dimensions
                terminalDimensions.set(containerId, {
                    cols: terminal.cols,
                    rows: terminal.rows
                });
                
                // Force a redraw
                terminal.refresh(0, terminal.rows - 1);
                
                // Notify main process about terminal size change
                if (terminals.has(containerId)) {
                    window.electron.invoke('update-terminal-size', {
                        terminalId: containerId,
                        cols: terminal.cols,
                        rows: terminal.rows
                    }).catch(error => {
                        console.error('Error updating terminal size:', error);
                    });
                }
            } else {
                console.log('Container too small, skipping resize');
            }
        } catch (err) {
            console.error('Error handling terminal resize:', err);
        }
    };

    // Initial fit after a short delay to ensure container is ready
    setTimeout(handleResize, 100);

    // Handle window resize events with debouncing
    let resizeTimeout: NodeJS.Timeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 100);
    });

    // Also handle container resize if ResizeObserver is available
    if (typeof ResizeObserver !== 'undefined') {
        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(handleResize, 100);
        });
        resizeObserver.observe(container);
    }

    // Handle tab activation (only resize if terminal was never sized before)
    const tabContent = container.closest('.tab-content');
    if (tabContent) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    if (tabContent.classList.contains('active')) {
                        setTimeout(() => {
                            // Only resize if we don't have stored dimensions
                            if (!terminalDimensions.has(containerId)) {
                                handleResize();
                            }
                            terminal.focus();
                        }, 100);
                    }
                }
            });
        });
        observer.observe(tabContent, { attributes: true });
    }
};

/**
 * Connect to a server via SSH
 */
export const connectToServer = async (
    terminal: Terminal,
    server: ServerData,
    terminalId: string
): Promise<void> => {
    try {
        if (!server.encrypted_auth_data) {
            throw new Error('Server authentication data is missing');
        }

        // Decrypt authentication data
        const password = localStorage.getItem('encryption_password');
        if (!password) {
            throw new Error('Encryption password not found');
        }

        const authData = decryptAuthData(server.encrypted_auth_data, password);

        // Clear terminal
        terminal.clear();
        terminal.reset();

        // Display connecting message
        terminal.writeln(`\r\n\x1b[1;32mConnecting to ${server.username}@${server.address}...\x1b[0m\r\n`);

        // Get current terminal dimensions
        const cols = terminal.cols;
        const rows = terminal.rows;
        console.log(`Using initial terminal dimensions: ${cols}x${rows}`);

        // Setup input handling - This is crucial for typing in the terminal
        terminal.onData(data => {
            try {
                window.electron.invoke('terminal-input', {
                    terminalId,
                    data
                }).catch(error => {
                    console.error('Error sending terminal input:', error);
                });
            } catch (err) {
                console.error('Error handling terminal input:', err);
            }
        });

        // Use IPC to execute SSH command through the main process
        // Here we create a command based on the authentication type
        if (authData.authType === 'key') {
            // For SSH key authentication, we need to create temporary key files
            if (!authData.privateKey) {
                throw new Error('Private key is missing');
            }
            
            // We'll ask the main process to create temp key file and use it
            const result = await window.electron.invoke('connect-ssh-with-key', {
                server: {
                    username: server.username,
                    address: server.address,
                },
                auth: {
                    privateKey: authData.privateKey,
                    publicKey: authData.publicKey || '',
                },
                terminalId,
                dimensions: { cols, rows }
            });
            
            console.log('SSH connection result:', result);
            
            if (!result.success) {
                terminal.writeln(`\r\n\x1b[1;31mConnection failed: ${result.message}\x1b[0m\r\n`);
            }
        } else {
            // Password authentication
            if (!authData.password) {
                throw new Error('Password is missing');
            }
            
            const result = await window.electron.invoke('connect-ssh-with-password', {
                server: {
                    username: server.username,
                    address: server.address,
                },
                auth: {
                    password: authData.password,
                },
                terminalId,
                dimensions: { cols, rows }
            });
            
            console.log('SSH connection result:', result);
            
            if (!result.success) {
                terminal.writeln(`\r\n\x1b[1;31mConnection failed: ${result.message}\x1b[0m\r\n`);
            }
        }
    } catch (error: unknown) {
        console.error('Connection error:', error);
        terminal.writeln(`\r\n\x1b[1;31mConnection error: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m\r\n`);
    }
};

/**
 * Generate a unique terminal ID
 */
export const generateTerminalId = (): string => {
    return `terminal-${++terminalIdCounter}`;
};

/**
 * Dispose a terminal instance
 */
export const disposeTerminal = (terminalId: string): void => {
    // Disconnect and clean up the terminal
    try {
        window.electron.invoke('disconnect-terminal', { terminalId })
            .catch(error => console.error('Error disconnecting terminal:', error));
    } catch (error: unknown) {
        console.error('Error invoking disconnect-terminal:', error);
    }
    
    // Dispose xterm.js instance
    const terminal = terminals.get(terminalId);
    if (terminal) {
        try {
            terminal.dispose();
        } catch (error: unknown) {
            console.error('Error disposing terminal:', error);
        }
        terminals.delete(terminalId);
    }
    
    // Clean up container reference
    terminalContainers.delete(terminalId);
    
    // Remove from active tabs
    activeTabs.delete(terminalId);
};

/**
 * Create a new terminal tab
 */
export const createTerminalTab = (server: ServerData): string => {
    // Generate unique terminal ID
    const terminalId = generateTerminalId();
    
    // Create tab element from template
    const tabTemplate = document.getElementById('terminal-tab-template') as HTMLTemplateElement;
    const tabNode = document.importNode(tabTemplate.content, true);
    const tabElement = tabNode.querySelector('.tab') as HTMLElement;
    
    // Set tab properties
    tabElement.dataset.tabId = terminalId;
    const tabLabel = tabElement.querySelector('.tab-label') as HTMLElement;
    tabLabel.textContent = server ? server.name : 'Terminal';
    
    // Add tab to the tabs wrapper
    const tabsWrapper = document.querySelector('.tabs-wrapper');
    if (tabsWrapper) {
        tabsWrapper.appendChild(tabElement);
    }
    
    // Create terminal content from template
    const contentTemplate = document.getElementById('terminal-content-template') as HTMLTemplateElement;
    const contentNode = document.importNode(contentTemplate.content, true);
    const contentElement = contentNode.querySelector('.tab-content') as HTMLElement;
    
    // Set content properties
    contentElement.id = `${terminalId}-content`;
    const terminalInstanceElement = contentElement.querySelector('.terminal-instance') as HTMLElement;
    terminalInstanceElement.id = terminalId;
    
    // Add content to the container
    const contentContainer = document.querySelector('.tab-content-container');
    if (contentContainer) {
        contentContainer.appendChild(contentElement);
    }
    
    // Create terminal instance
    const terminal = createTerminal(terminalId);
    
    // Store in active tabs
    activeTabs.set(terminalId, {
        terminal,
        server,
        connected: false
    });
    
    // Initialize the terminal
    initializeTerminal(terminalId, terminal);
    
    // Activate the tab
    activateTab(terminalId);
    
    // Focus the terminal to ensure it can receive keyboard input immediately
    setTimeout(() => {
        terminal.focus();
        console.log(`Initial focus set on terminal: ${terminalId}`);
    }, 200);
    
    // If server is provided, connect to it
    if (server) {
        setTimeout(() => {
            connectToServer(terminal, server, terminalId)
                .then(() => {
                    // Mark as connected
                    const tabInfo = activeTabs.get(terminalId);
                    if (tabInfo) {
                        tabInfo.connected = true;
                    }
                    
                    // Ensure focus after connection is established
                    terminal.focus();
                })
                .catch(error => {
                    console.error('Error connecting to server:', error);
                });
        }, 500);
    }
    
    return terminalId;
};

/**
 * Create a new servers tab
 */
export const createServersTab = (): string => {
    // Generate unique ID for this servers tab
    const tabId = `servers-${++terminalIdCounter}`;
    
    // Create tab element from template
    const tabTemplate = document.getElementById('terminal-tab-template') as HTMLTemplateElement;
    const tabNode = document.importNode(tabTemplate.content, true);
    const tabElement = tabNode.querySelector('.tab') as HTMLElement;
    
    // Set tab properties
    tabElement.dataset.tabId = tabId;
    const tabLabel = tabElement.querySelector('.tab-label') as HTMLElement;
    tabLabel.textContent = 'Servers';
    
    // Replace the terminal icon with a servers icon
    const iconElement = tabElement.querySelector('i') as HTMLElement;
    if (iconElement) {
        iconElement.className = 'bi bi-hdd-network';
    }
    
    // Add tab to the tabs wrapper
    const tabsWrapper = document.querySelector('.tabs-wrapper');
    if (tabsWrapper) {
        tabsWrapper.appendChild(tabElement);
    }
    
    // Clone the dashboard content for this new servers tab
    const dashboardContent = document.getElementById('dashboard-tab-content') as HTMLElement;
    if (dashboardContent) {
        // Clone the dashboard content
        const newServersContent = dashboardContent.cloneNode(true) as HTMLElement;
        
        // Set the new ID
        newServersContent.id = `${tabId}-content`;
        
        // Make sure the cloned "Add Server" button works
        const addServerBtn = newServersContent.querySelector('.add-server-btn') as HTMLElement;
        if (addServerBtn) {
            // Clone and replace to remove old event listeners
            const newAddServerBtn = addServerBtn.cloneNode(true) as HTMLElement;
            addServerBtn.parentNode?.replaceChild(newAddServerBtn, addServerBtn);
            
            // Add click event to the new button
            newAddServerBtn.addEventListener('click', () => {
                const addServerModal = document.getElementById('add-server-modal');
                if (addServerModal) {
                    addServerModal.classList.add('show');
                    document.body.style.overflow = 'hidden';
                }
            });
        }
        
        // Also make the empty state add server button work
        const emptyStateBtn = newServersContent.querySelector('.add-server-btn-empty') as HTMLElement;
        if (emptyStateBtn) {
            // Clone and replace to remove old event listeners
            const newEmptyStateBtn = emptyStateBtn.cloneNode(true) as HTMLElement;
            emptyStateBtn.parentNode?.replaceChild(newEmptyStateBtn, emptyStateBtn);
            
            // Add click event to the new button
            newEmptyStateBtn.addEventListener('click', () => {
                const addServerModal = document.getElementById('add-server-modal');
                if (addServerModal) {
                    addServerModal.classList.add('show');
                    document.body.style.overflow = 'hidden';
                }
            });
        }
        
        // Add to container
        const contentContainer = document.querySelector('.tab-content-container');
        if (contentContainer) {
            contentContainer.appendChild(newServersContent);
            
            // Refresh the server grid in this new tab
            const refreshButton = document.createElement('button');
            refreshButton.style.display = 'none';
            refreshButton.id = `refresh-${tabId}`;
            newServersContent.appendChild(refreshButton);
            
            // Trigger a refresh after a short delay
            setTimeout(() => {
                // Execute the refresh logic by simulating an event dispatch
                window.dispatchEvent(new CustomEvent('refresh-servers-grid', {
                    detail: { tabId: tabId }
                }));
            }, 100);
        }
    }
    
    // Activate the tab
    activateTab(tabId);
    
    return tabId;
};

/**
 * Activate a tab
 */
export const activateTab = (tabId: string): void => {
    console.log(`Activating tab with ID: ${tabId}`);
    
    // Deactivate all tabs and content
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activate the selected tab
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    console.log(`Tab element found: ${tabElement ? 'Yes' : 'No'}`);
    
    if (tabElement) {
        tabElement.classList.add('active');
    }
    
    // Activate the tab content
    const contentId = tabId === 'dashboard' ? 'dashboard-tab-content' : `${tabId}-content`;
    const contentElement = document.getElementById(contentId);
    console.log(`Content element (${contentId}) found: ${contentElement ? 'Yes' : 'No'}`);
    
    if (contentElement) {
        contentElement.classList.add('active');
        
        // If this is a servers tab (either main dashboard or a new servers tab), refresh the server list
        if (tabId === 'dashboard' || tabId.startsWith('servers-')) {
            console.log(`Refreshing server list in tab: ${tabId}`);
            
            // Import serverManager dynamically to avoid circular dependencies
            import('./serverManager').then(serverManager => {
                if (tabId === 'dashboard') {
                    // Refresh the main dashboard
                    serverManager.refreshServersGrid();
                } else {
                    // Refresh a specific servers tab
                    serverManager.refreshServersGrid(contentElement);
                }
            }).catch(error => {
                console.error('Error importing serverManager module:', error);
            });
        }
    } else {
        console.warn(`Tab content with ID ${contentId} not found in the DOM`);
    }
    
    // If it's a terminal tab, focus it but don't automatically resize
    if (tabId.startsWith('terminal-')) {
        const tabInfo = activeTabs.get(tabId);
        console.log(`Terminal tab info exists: ${tabInfo ? 'Yes' : 'No'}`);
        
        if (tabInfo && tabInfo.terminal) {
            // Give some time for the content to be visible
            setTimeout(() => {
                const terminalElement = document.getElementById(tabId);
                if (terminalElement) {
                    // Only resize if we've never sized this terminal before
                    if (!terminalDimensions.has(tabId)) {
                        console.log("Initial sizing for terminal");
                        // This is the first time we're seeing this terminal, trigger a resize
                        window.dispatchEvent(new Event('resize'));
                    } else {
                        console.log("Using existing terminal dimensions");
                    }
                    
                    // Focus the terminal so keyboard input works right away
                    tabInfo.terminal.focus();
                    
                    console.log(`Focused terminal: ${tabId}`);
                }
            }, 100);
        }
    }
};

/**
 * Close a terminal tab
 */
export const closeTerminalTab = (tabId: string): void => {
    // Get tab and content elements
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    const contentElement = document.getElementById(`${tabId}-content`);
    
    // Dispose terminal if exists
    disposeTerminal(tabId);
    
    // Remove tab and content from DOM
    if (tabElement) {
        tabElement.remove();
    }
    
    if (contentElement) {
        contentElement.remove();
    }
    
    // Activate dashboard tab if the closed tab was active
    if (tabElement && tabElement.classList.contains('active')) {
        activateTab('dashboard');
    }
};

/**
 * Setup tab event listeners
 */
export const setupTabEventListeners = (): void => {
    // Listen for tab clicks
    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const tab = target.closest('.tab') as HTMLElement | null;
        
        if (tab) {
            // Check if close button was clicked
            if (target.closest('.tab-close-btn')) {
                const tabId = tab.dataset.tabId;
                if (tabId && tabId !== 'dashboard') {
                    // If it's a terminal tab
                    if (tabId.startsWith('terminal-')) {
                        closeTerminalTab(tabId);
                    } else {
                        // For other tabs like servers
                        const contentElement = document.getElementById(`${tabId}-content`);
                        if (contentElement) {
                            contentElement.remove();
                        }
                        tab.remove();
                        
                        // Activate dashboard if this was the active tab
                        if (tab.classList.contains('active')) {
                            activateTab('dashboard');
                        }
                    }
                }
                return;
            }
            
            // Activate the tab
            const tabId = tab.dataset.tabId;
            if (tabId) {
                activateTab(tabId);
            }
        }
    });
    
    // New tab button creates a servers tab by default
    const newTabBtn = document.getElementById('new-tab-btn');
    if (newTabBtn) {
        newTabBtn.addEventListener('click', () => {
            // Create a new servers tab by default
            createServersTab();
        });
    }
}; 