import { encryptAuthData } from './encryption';

const API_BASE_URL = 'http://localhost:8000';

/**
 * Get the authentication headers for API requests
 */
const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('auth_token');
    const tokenType = localStorage.getItem('token_type') || 'Bearer';
    
    if (!token) {
        throw new Error('Authentication token not found');
    }
    
    return {
        'Authorization': `${tokenType} ${token}`,
        'Content-Type': 'application/json'
    };
};

/**
 * Get user's encryption password from storage
 */
const getStoredPassword = (): string => {
    const password = localStorage.getItem('encryption_password');
    if (!password) {
        throw new Error('Encryption password not found');
    }
    return password;
};

/**
 * Fetch all servers for the current user
 */
export const fetchServers = async (): Promise<ServersResponse> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/servers`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch servers');
        }

        const data = await response.json();
        return {
            success: true,
            data
        };
    } catch (error) {
        console.error('Error fetching servers:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to fetch servers'
        };
    }
};

/**
 * Create a new server with encrypted authentication data
 */
export const createServer = async (
    name: string,
    address: string,
    authData: ServerAuthData
): Promise<ServerResponse> => {
    try {
        const password = getStoredPassword();
        const encrypted_auth_data = encryptAuthData(authData, password);

        const response = await fetch(`${API_BASE_URL}/api/servers`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                name,
                address,
                username: authData.username,
                encrypted_auth_data
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to create server');
        }

        const data = await response.json();
        return {
            success: true,
            data
        };
    } catch (error) {
        console.error('Error creating server:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to create server'
        };
    }
};

/**
 * Update an existing server
 */
export const updateServer = async (
    serverId: number,
    updates: {
        name?: string;
        address?: string;
        authData?: ServerAuthData;
    }
): Promise<ServerResponse> => {
    try {
        const updateData: Partial<ServerData> = {};
        
        if (updates.name) updateData.name = updates.name;
        if (updates.address) updateData.address = updates.address;
        
        if (updates.authData) {
            const password = getStoredPassword();
            updateData.encrypted_auth_data = encryptAuthData(updates.authData, password);
            updateData.username = updates.authData.username;
        }

        const response = await fetch(`${API_BASE_URL}/api/servers/${serverId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update server');
        }

        const data = await response.json();
        return {
            success: true,
            data
        };
    } catch (error) {
        console.error('Error updating server:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to update server'
        };
    }
};

/**
 * Delete a server
 */
export const deleteServer = async (serverId: number): Promise<{ success: boolean; message?: string }> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/servers/${serverId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete server');
        }

        return { success: true };
    } catch (error) {
        console.error('Error deleting server:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to delete server'
        };
    }
};

/**
 * Get a specific server by ID
 */
export const getServer = async (serverId: number): Promise<ServerResponse> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/servers/${serverId}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch server');
        }

        const data = await response.json();
        return {
            success: true,
            data
        };
    } catch (error) {
        console.error('Error fetching server:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to fetch server'
        };
    }
}; 