import { ipcMain } from 'electron';
import axios from 'axios';
import { API_URL } from './config';

// Handle Login
export const setupAuthHandlers = () => {
    ipcMain.handle('login', async (_event, data) => {
        try {
            // Connect to backend API using form-urlencoded format as expected by OAuth2PasswordRequestForm
            const response = await axios.post(`${API_URL}/api/auth/login`, 
                new URLSearchParams({
                    username: data.email,  // FastAPI OAuth2 expects 'username'
                    password: data.password
                }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            
            // Store token for future authenticated requests
            const token = response.data.access_token;
            
            return { 
                success: true, 
                token: token,
                token_type: response.data.token_type
            };
        } catch (error: any) {
            console.error('Login error:', error);
            let errorMessage = 'Login failed';
            
            if (error.response?.data) {
                if (Array.isArray(error.response.data.detail)) {
                    errorMessage = error.response.data.detail.map((err: any) => err.msg).join(', ');
                } else if (error.response.data.detail) {
                    errorMessage = error.response.data.detail;
                }
            }
            
            return { 
                success: false, 
                message: errorMessage
            };
        }
    });

    // Handle Registration
    ipcMain.handle('register', async (_event, data) => {
        try {
            // Connect to backend API
            const response = await axios.post(`${API_URL}/api/auth/register`, {
                email: data.email,
                password: data.password,
            });
            
            return { 
                success: true,
                user: response.data
            };
        } catch (error: any) {
            console.error('Registration error:', error);
            let errorMessage = 'Registration failed';
            
            if (error.response?.data) {
                if (Array.isArray(error.response.data.detail)) {
                    errorMessage = error.response.data.detail.map((err: any) => err.msg).join(', ');
                } else if (error.response.data.detail) {
                    errorMessage = error.response.data.detail;
                }
            }
            
            return { 
                success: false, 
                message: errorMessage
            };
        }
    });
}; 