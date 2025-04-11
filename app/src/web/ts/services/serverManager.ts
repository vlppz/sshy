import { decryptAuthData } from './encryption';
import * as serverApi from './serverApi';

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
export const refreshServersGrid = async () => {
    const serversGrid = document.querySelector('.servers-grid');
    const emptyState = document.querySelector('.empty-state') as HTMLElement;
    const fab = document.querySelector('.fab') as HTMLElement;
    
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
    
    const nameInput = form.querySelector('#server-name') as HTMLInputElement;
    const addressInput = form.querySelector('#server-address') as HTMLInputElement;
    const usernameInput = form.querySelector('#username') as HTMLInputElement;
    const authType = form.querySelector('.auth-option.active')?.getAttribute('data-auth') as 'password' | 'key';
    
    const authData: ServerAuthData = {
        username: usernameInput.value,
        authType
    };

    if (authType === 'password') {
        const passwordInput = form.querySelector('#password') as HTMLInputElement;
        authData.password = passwordInput.value;
    } else {
        const publicKeyInput = form.querySelector('#ssh-public-key') as HTMLTextAreaElement;
        const privateKeyInput = form.querySelector('#ssh-private-key') as HTMLTextAreaElement;
        authData.publicKey = publicKeyInput.value;
        authData.privateKey = privateKeyInput.value;
    }

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
        await refreshServersGrid();
    } else {
        // Show error message
        console.error('Failed to create server:', response.message);
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
        await refreshServersGrid();
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
 * Initializes server management functionality
 */
export const initializeServerManager = () => {
    // Initial load of servers
    refreshServersGrid();

    // Set up form submission handlers
    const addServerForm = document.getElementById('add-server-form') as HTMLFormElement;
    if (addServerForm) {
        addServerForm.addEventListener('submit', handleServerFormSubmit);
        
        // Set up external submit button
        document.getElementById('submit-add-server')?.addEventListener('click', () => {
            addServerForm.requestSubmit();
        });
    }

    const editServerForm = document.getElementById('edit-server-form') as HTMLFormElement;
    if (editServerForm) {
        editServerForm.addEventListener('submit', handleEditServerFormSubmit);
        
        // Set up external submit button
        document.getElementById('submit-edit-server')?.addEventListener('click', () => {
            editServerForm.requestSubmit();
        });
    }

    // Set up authentication toggles
    setupAuthToggle('add-server-form');
    setupAuthToggle('edit-server-form');

    // Set up password toggles
    setupPasswordToggle('add-server-form');
    setupPasswordToggle('edit-server-form');

    // Set up key paste functionality
    setupKeyPasteButtons('add-server-form');
    setupKeyPasteButtons('edit-server-form');

    // Handle empty state add server button
    document.querySelector('.add-server-btn-empty')?.addEventListener('click', () => {
        const modal = document.getElementById('add-server-modal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    });

    // Set up add modal close handlers
    const addModal = document.getElementById('add-server-modal');
    if (addModal) {
        const closeBtn = addModal.querySelector('.modal-close');
        const cancelBtn = addModal.querySelector('#cancel-add-server');
        const backdrop = addModal.querySelector('.modal-backdrop');

        const closeAddModal = () => {
            addModal.classList.remove('show');
            document.body.style.overflow = '';
            (document.getElementById('add-server-form') as HTMLFormElement).reset();
        };

        closeBtn?.addEventListener('click', closeAddModal);
        cancelBtn?.addEventListener('click', closeAddModal);
        backdrop?.addEventListener('click', closeAddModal);
    }

    // Set up edit modal close handlers
    const editModal = document.getElementById('edit-server-modal');
    if (editModal) {
        const closeBtn = editModal.querySelector('.modal-close');
        const cancelBtn = editModal.querySelector('#cancel-edit-server');
        const backdrop = editModal.querySelector('.modal-backdrop');

        const closeEditModal = () => {
            editModal.classList.remove('show');
            document.body.style.overflow = '';
            (document.getElementById('edit-server-form') as HTMLFormElement).reset();
        };

        closeBtn?.addEventListener('click', closeEditModal);
        cancelBtn?.addEventListener('click', closeEditModal);
        backdrop?.addEventListener('click', closeEditModal);
    }

    // Event delegation for server actions
    document.querySelector('.servers-grid')?.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const serverCard = target.closest('.server-card') as HTMLElement;
        if (!serverCard) return;

        const serverId = parseInt(serverCard.dataset.serverId || '');
        if (!serverId) return;

        if (target.closest('.delete-btn')) {
            if (confirm('Are you sure you want to delete this server?')) {
                const response = await serverApi.deleteServer(serverId);
                if (response.success) {
                    await refreshServersGrid();
                } else {
                    console.error('Failed to delete server:', response.message);
                }
            }
        } else if (target.closest('.connect-btn')) {
            // Handle connection (to be implemented based on your connection mechanism)
            console.log('Connecting to server:', serverId);
        } else if (target.closest('.edit-btn')) {
            await loadServerDataIntoEditForm(serverId);
        }
    });
}; 