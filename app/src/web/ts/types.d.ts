interface Window {
    electron: {
        invoke(channel: string, data: any): Promise<any>;
    }
}

interface ServerAuthData {
    username: string;
    password?: string;
    publicKey?: string;
    privateKey?: string;
    authType: 'password' | 'key';
}

interface ServerData {
    id?: number;
    name: string;
    address: string;
    username: string;
    encrypted_auth_data?: string;
    created_at?: string;
    modified_at?: string;
    user_id?: number;
}

interface ServerResponse {
    success: boolean;
    data?: ServerData;
    message?: string;
}

interface ServersResponse {
    success: boolean;
    data?: ServerData[];
    message?: string;
}