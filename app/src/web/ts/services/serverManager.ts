import { decryptAuthData } from './encryption';
import * as serverApi from './serverApi';
import * as terminalService from './terminalService';

/**
 * Renders a server card in the grid
 */
const renderServerCard = (server: ServerData): HTMLElement => {
    const card = document.createElement('div');
    card.className = 'server-card';
    card.dataset.serverId = server.id?.toString();

    card.innerHTML = `
        <div class="server-card-content">
            <h3 class="server-name">${server.name}</h3>
            <div class="server-info">
                <p class="server-host"><i class="bi bi-hdd-network"></i> ${server.username}@${server.address}</p>
            </div>
            <div class="server-actions">
                <button class="system-btn connect-btn">
                    <i class="bi bi-terminal"></i>
                    <span>Connect</span>
                </button>
                <button class="system-btn edit-btn">
                    <i class="bi bi-pencil"></i>
                    <span>Edit</span>
                </button>
                <button class="system-btn delete-btn">
                    <i class="bi bi-trash"></i>
                    <span>Delete</span>
                </button>
            </div>
        </div>
    `;

    return card;
};

/**
 * Updates the servers grid with the latest data
 */
export const refreshServersGrid = async (targetContainer?: HTMLElement) => {
    // Use the provided container or find the main one
    const serversGrid = targetContainer ? 
        targetContainer.querySelector('.servers-grid') : 
        document.querySelector('.servers-grid');
    
    // Find empty state and fab within the correct container
    const container = targetContainer || document;
    const emptyState = container.querySelector('.empty-state') as HTMLElement;
    const fab = container.querySelector('.fab') as HTMLElement;
    
    if (!serversGrid || !emptyState || !fab) return;

    const response = await serverApi.fetchServers();
    
    if (!response.success || !response.data) {
        // Show error toast or notification
        console.error('Failed to fetch servers:', response.message);
        return;
    }

    // Clear existing server cards
    const existingCards = serversGrid.querySelectorAll('.server-card');
    existingCards.forEach(card => card.remove());

    if (response.data.length === 0) {
        emptyState.style.display = 'flex';
        fab.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    fab.style.display = 'flex';
    
    // Sort servers by created_at in descending order (newest first)
    const sortedServers = [...response.data].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // Descending order
    });
    
    sortedServers.forEach(server => {
        const card = renderServerCard(server);
        serversGrid.appendChild(card);
    });
};

/**
 * Handles server form submission
 */
export const handleServerFormSubmit = async (event: Event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const modal = document.getElementById('add-server-modal');
    
    // Add null checks for each form element
    const nameInput = form.querySelector('#server-name') as HTMLInputElement;
    if (!nameInput) {
        console.error('Cannot find server name input element');
        return;
    }
    
    const addressInput = form.querySelector('#server-address') as HTMLInputElement;
    if (!addressInput) {
        console.error('Cannot find server address input element');
        return;
    }
    
    const usernameInput = form.querySelector('#username') as HTMLInputElement;
    if (!usernameInput) {
        console.error('Cannot find username input element');
        return;
    }
    
    const activeAuthOption = form.querySelector('.auth-option.active');
    if (!activeAuthOption) {
        console.error('Cannot find active authentication option');
        return;
    }
    
    const authType = activeAuthOption.getAttribute('data-auth') as 'password' | 'key';
    if (!authType) {
        console.error('Cannot determine authentication type');
        return;
    }
    
    const authData: ServerAuthData = {
        username: usernameInput.value,
        authType
    };

    if (authType === 'password') {
        const passwordInput = form.querySelector('#password') as HTMLInputElement;
        if (!passwordInput) {
            console.error('Cannot find password input element');
            return;
        }
        authData.password = passwordInput.value;
    } else {
        const publicKeyInput = form.querySelector('#ssh-public-key') as HTMLTextAreaElement;
        if (!publicKeyInput) {
            console.error('Cannot find SSH public key input element');
            return;
        }
        
        const privateKeyInput = form.querySelector('#ssh-private-key') as HTMLTextAreaElement;
        if (!privateKeyInput) {
            console.error('Cannot find SSH private key input element');
            return;
        }
        
        authData.publicKey = publicKeyInput.value;
        authData.privateKey = privateKeyInput.value;
    }

    try {
        const response = await serverApi.createServer(
            nameInput.value,
            addressInput.value,
            authData
        );

        if (response.success) {
            // Close modal and refresh grid
            if (modal) {
                modal.classList.remove('show');
                document.body.style.overflow = '';
                form.reset();
            }
            
            // Refresh the main servers grid
            await refreshServersGrid();
            
            // Also refresh any other server tabs
            window.dispatchEvent(new CustomEvent('refresh-servers-grid', {
                detail: { tabId: 'all' }
            }));
        } else {
            // Show error message
            console.error('Failed to create server:', response.message);
        }
    } catch (error) {
        console.error('Error during server creation:', error);
    }
};

/**
 * Loads server data into the edit form
 */
const loadServerDataIntoEditForm = async (serverId: number) => {
    const response = await serverApi.getServer(serverId);
    if (!response.success || !response.data) {
        console.error('Failed to fetch server data:', response.message);
        return;
    }

    const server = response.data;
    const form = document.getElementById('edit-server-form') as HTMLFormElement;
    
    // Fill in basic server information
    (form.querySelector('#edit-server-name') as HTMLInputElement).value = server.name;
    (form.querySelector('#edit-server-address') as HTMLInputElement).value = server.address;
    (form.querySelector('#edit-username') as HTMLInputElement).value = server.username;

    // Store server ID in the form for submission
    form.dataset.serverId = server.id?.toString();

    // Decrypt and load authentication data if available
    if (server.encrypted_auth_data) {
        try {
            const password = localStorage.getItem('encryption_password');
            if (!password) {
                throw new Error('Encryption password not found');
            }

            const authData = decryptAuthData(server.encrypted_auth_data, password);
            
            // Set the correct authentication method
            const authOptions = form.querySelectorAll('.auth-option');
            authOptions.forEach(option => {
                if (option.getAttribute('data-auth') === authData.authType) {
                    option.classList.add('active');
                } else {
                    option.classList.remove('active');
                }
            });

            // Show/hide the appropriate auth input fields
            const keyAuth = form.querySelector('#edit-ssh-key-input');
            const passwordAuth = form.querySelector('#edit-password-input');
            
            if (authData.authType === 'key') {
                keyAuth?.setAttribute('style', 'display: block');
                passwordAuth?.setAttribute('style', 'display: none');
                
                if (authData.publicKey) {
                    (form.querySelector('#edit-ssh-public-key') as HTMLTextAreaElement).value = authData.publicKey;
                }
                if (authData.privateKey) {
                    (form.querySelector('#edit-ssh-private-key') as HTMLTextAreaElement).value = authData.privateKey;
                }
            } else {
                keyAuth?.setAttribute('style', 'display: none');
                passwordAuth?.setAttribute('style', 'display: block');
                
                if (authData.password) {
                    (form.querySelector('#edit-password') as HTMLInputElement).value = authData.password;
                }
                
                // Reinitialize password toggle for password auth
                setupPasswordToggle('edit-server-form');
            }
        } catch (error) {
            console.error('Failed to decrypt authentication data:', error);
        }
    }

    // Show the edit modal
    const modal = document.getElementById('edit-server-modal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
};

/**
 * Handles edit server form submission
 */
const handleEditServerFormSubmit = async (event: Event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const serverId = parseInt(form.dataset.serverId || '');
    
    if (!serverId) {
        console.error('No server ID found in form');
        return;
    }

    const nameInput = form.querySelector('#edit-server-name') as HTMLInputElement;
    const addressInput = form.querySelector('#edit-server-address') as HTMLInputElement;
    const usernameInput = form.querySelector('#edit-username') as HTMLInputElement;
    const authType = form.querySelector('.auth-option.active')?.getAttribute('data-auth') as 'password' | 'key';
    
    const updates: {
        name: string;
        address: string;
        authData?: ServerAuthData;
    } = {
        name: nameInput.value,
        address: addressInput.value,
    };

    // Only include auth data if it has been modified
    const authData: ServerAuthData = {
        username: usernameInput.value,
        authType
    };

    if (authType === 'password') {
        const passwordInput = form.querySelector('#edit-password') as HTMLInputElement;
        if (passwordInput.value) {
            authData.password = passwordInput.value;
            updates.authData = authData;
        }
    } else {
        const publicKeyInput = form.querySelector('#edit-ssh-public-key') as HTMLTextAreaElement;
        const privateKeyInput = form.querySelector('#edit-ssh-private-key') as HTMLTextAreaElement;
        if (publicKeyInput.value && privateKeyInput.value) {
            authData.publicKey = publicKeyInput.value;
            authData.privateKey = privateKeyInput.value;
            updates.authData = authData;
        }
    }

    const response = await serverApi.updateServer(serverId, updates);

    if (response.success) {
        // Close modal and refresh grid
        const modal = document.getElementById('edit-server-modal');
        if (modal) {
            modal.classList.remove('show');
        }
        form.reset();
        
        // Refresh the main servers grid
        await refreshServersGrid();
        
        // Also refresh any other server tabs
        window.dispatchEvent(new CustomEvent('refresh-servers-grid', {
            detail: { tabId: 'all' }
        }));
        
        document.body.style.overflow = '';
    } else {
        // Show error message
        console.error('Failed to update server:', response.message);
    }
};

/**
 * Sets up authentication toggle functionality for a form
 */
const setupAuthToggle = (formId: string) => {
    const form = document.getElementById(formId);
    if (!form) return;

    const authOptions = form.querySelectorAll('.auth-option');
    const keyAuth = form.querySelector(`#${formId === 'edit-server-form' ? 'edit-' : ''}ssh-key-input`);
    const passwordAuth = form.querySelector(`#${formId === 'edit-server-form' ? 'edit-' : ''}password-input`);

    authOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Update active state
            authOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');

            // Toggle auth fields visibility
            const authType = option.getAttribute('data-auth');
            if (authType === 'key') {
                keyAuth?.setAttribute('style', 'display: block');
                passwordAuth?.setAttribute('style', 'display: none');
            } else {
                keyAuth?.setAttribute('style', 'display: none');
                passwordAuth?.setAttribute('style', 'display: block');
                
                // Re-initialize password toggle when switching to password auth
                // This ensures the toggle works after switching auth methods
                setupPasswordToggle(formId);
            }
        });
    });
};

/**
 * Sets up password toggle functionality for a form
 */
const setupPasswordToggle = (formId: string) => {
    const form = document.getElementById(formId);
    if (!form) return;

    const passwordToggleBtn = form.querySelector('.password-toggle-btn');
    const passwordField = form.querySelector(`#${formId === 'edit-server-form' ? 'edit-' : ''}password`) as HTMLInputElement;

    if (passwordToggleBtn && passwordField) {
        // Remove any existing click event listeners first
        // by cloning and replacing the button
        const newToggleBtn = passwordToggleBtn.cloneNode(true);
        passwordToggleBtn.parentNode?.replaceChild(newToggleBtn, passwordToggleBtn);
        
        // Add the event listener to the new button
        newToggleBtn.addEventListener('click', () => {
            const isPassword = passwordField.type === 'password';
            passwordField.type = isPassword ? 'text' : 'password';
            (newToggleBtn as HTMLElement).innerHTML = isPassword 
                ? '<i class="bi bi-eye-slash"></i>' 
                : '<i class="bi bi-eye"></i>';
        });
    }
};

/**
 * Sets up clipboard paste functionality for key fields
 */
const setupKeyPasteButtons = (formId: string) => {
    const form = document.getElementById(formId);
    if (!form) return;

    form.querySelectorAll('.key-paste-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                const targetId = (btn as HTMLElement).dataset.target;
                if (targetId) {
                    const targetElement = document.getElementById(targetId) as HTMLTextAreaElement;
                    if (targetElement) {
                        targetElement.value = text;
                    }
                }
            } catch (err) {
                console.error('Failed to read clipboard:', err);
            }
        });
    });
};

/**
 * Handles connecting to a server
 */
const connectToServer = async (serverId: number) => {
    console.log(`Connecting to server ${serverId}...`);
    
    // Get server data
    const response = await serverApi.getServer(serverId);
    if (!response.success || !response.data) {
        console.error('Failed to fetch server data:', response.message);
        return;
    }

    const server = response.data;
    
    // Create a new terminal tab with this server
    terminalService.createTerminalTab(server);
};

/**
 * Initializes the server manager
 */
export const initializeServerManager = () => {
    console.log('Initializing server manager...');
    
    // Refresh the servers grid
    refreshServersGrid();
    
    // Listen for refresh events from new servers tabs
    window.addEventListener('refresh-servers-grid', (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail && customEvent.detail.tabId) {
            const tabId = customEvent.detail.tabId;
            
            // Handle special 'all' case to refresh all tabs
            if (tabId === 'all') {
                console.log('Refreshing all server tabs');
                
                // First refresh the main dashboard tab
                refreshServersGrid();
                
                // Then find and refresh all other server tabs
                document.querySelectorAll('[id^="servers-"][id$="-content"]').forEach(element => {
                    console.log('Refreshing server tab:', element.id);
                    refreshServersGrid(element as HTMLElement);
                });
            } else {
                // Refresh a specific tab
                const tabContent = document.getElementById(`${tabId}-content`);
                if (tabContent) {
                    refreshServersGrid(tabContent);
                }
            }
        }
    });
    
    // Initialize form handlers
    const addServerForm = document.getElementById('add-server-form') as HTMLFormElement | null;
    const editServerForm = document.getElementById('edit-server-form') as HTMLFormElement | null;
    
    if (addServerForm) {
        // Submit button click handler
        document.getElementById('submit-add-server')?.addEventListener('click', (e) => {
            // Since we're clicking a button and not submitting the form directly,
            // ensure we correctly pass the form to the handler
            const form = document.getElementById('add-server-form') as HTMLFormElement;
            if (!form) {
                console.error('Cannot find add server form');
                return;
            }
            
            // Create a synthetic event with the form as target
            const event = { preventDefault: () => {}, target: form } as unknown as Event;
            handleServerFormSubmit(event);
        });
    }
    
    if (editServerForm) {
        // Submit button click handler
        document.getElementById('submit-edit-server')?.addEventListener('click', (e) => {
            // Since we're clicking a button and not submitting the form directly,
            // we need to manually pass the form to the handler
            const form = document.getElementById('edit-server-form') as HTMLFormElement;
            if (!form) return;
            
            // Create a synthetic event with the form as target
            const event = { preventDefault: () => {}, target: form } as unknown as Event;
            handleEditServerFormSubmit(event);
        });
    }
    
    // Event delegation for server card actions (connect, edit, delete)
    document.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        
        // Find the closest button
        const actionButton = target.closest('button');
        if (!actionButton) return;
        
        // Find the server card containing this button
        const serverCard = actionButton.closest('.server-card') as HTMLElement | null;
        if (!serverCard) return;
        
        // Get the server ID
        const serverId = parseInt(serverCard.dataset.serverId || '');
        if (!serverId) {
            console.error('No server ID found in card');
            return;
        }
        
        // Handle different actions
        if (actionButton.classList.contains('connect-btn')) {
            await connectToServer(serverId);
        } else if (actionButton.classList.contains('edit-btn')) {
            loadServerDataIntoEditForm(serverId);
        } else if (actionButton.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to delete this server? This action cannot be undone.')) {
                const response = await serverApi.deleteServer(serverId);
                if (response.success) {
                    // Refresh all servers tabs
                    refreshServersGrid();
                    // Also refresh any other server tabs
                    window.dispatchEvent(new CustomEvent('refresh-servers-grid', {
                        detail: { tabId: 'all' }
                    }));
                } else {
                    console.error('Failed to delete server:', response.message);
                }
            }
        }
    });
    
    // Initialize add server modal
    const addServerBtn = document.querySelector('.add-server-btn');
    const addServerBtnEmpty = document.querySelector('.add-server-btn-empty');
    const addServerModal = document.getElementById('add-server-modal');
    
    // Setup form elements
    setupAuthToggle('add-server-form');
    setupPasswordToggle('add-server-form');
    setupKeyPasteButtons('add-server-form');
    
    setupAuthToggle('edit-server-form');
    setupPasswordToggle('edit-server-form');
    setupKeyPasteButtons('edit-server-form');
    
    // Open modal when clicking add server button
    if (addServerBtn && addServerModal) {
        addServerBtn.addEventListener('click', () => {
            addServerModal.classList.add('show');
            document.body.style.overflow = 'hidden';
        });
    }
    
    // Also for empty state button
    if (addServerBtnEmpty && addServerModal) {
        addServerBtnEmpty.addEventListener('click', () => {
            addServerModal.classList.add('show');
            document.body.style.overflow = 'hidden';
        });
    }
    
    // Close modals (generic handler)
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(element => {
        element.addEventListener('click', function(this: HTMLElement, e) {
            const modal = this.closest('.modal') as HTMLElement;
            if (modal) {
                modal.classList.remove('show');
                document.body.style.overflow = '';
                
                // Reset any forms inside the modal
                const form = modal.querySelector('form') as HTMLFormElement | null;
                if (form) {
                    // If it's the edit form, preserve the server ID
                    if (form.id === 'edit-server-form') {
                        const serverId = form.dataset.serverId;
                        form.reset();
                        if (serverId) {
                            form.dataset.serverId = serverId;
                        }
                    } else {
                        form.reset();
                    }
                }
            }
        });
    });
    
    // Prevent clicks inside modal content from closing the modal
    document.querySelectorAll('.modal-container').forEach(element => {
        element.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    });
    
    // Close add modal with cancel button
    const closeAddModal = () => {
        if (addServerModal) {
            addServerModal.classList.remove('show');
            document.body.style.overflow = '';
            
            // Reset form
            if (addServerForm) {
                addServerForm.reset();
            }
        }
    };
    
    document.getElementById('cancel-add-server')?.addEventListener('click', closeAddModal);
    
    // Close edit modal with cancel button
    const closeEditModal = () => {
        const editServerModal = document.getElementById('edit-server-modal');
        if (editServerModal) {
            editServerModal.classList.remove('show');
            document.body.style.overflow = '';
            
            // Reset form without removing the server ID
            const form = document.getElementById('edit-server-form') as HTMLFormElement;
            if (form) {
                // Store the server ID
                const serverId = form.dataset.serverId;
                
                // Reset form
                form.reset();
                
                // Restore the server ID if it existed
                if (serverId) {
                    form.dataset.serverId = serverId;
                }
            }
        }
    };
    
    document.getElementById('cancel-edit-server')?.addEventListener('click', closeEditModal);
    
    // Initialize tabs system
    terminalService.setupTabEventListeners();
}; 