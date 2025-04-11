interface AuthData {
    email: string;
    password: string;
}

interface AuthResponse {
    success: boolean;
    token?: string;
    token_type?: string;
    message?: string;
    user?: any;
}

// Define the electron interface
interface ElectronAPI {
    invoke: (channel: string, data: any) => Promise<any>;
    updateAuth: (authData: { token: string, token_type: string, user_email: string }) => void;
}

// Get DOM elements
const loginForm = document.getElementById('login-form') as HTMLDivElement | null;
const registerForm = document.getElementById('register-form') as HTMLDivElement | null;
const showRegisterLink = document.getElementById('show-register') as HTMLAnchorElement | null;
const showLoginLink = document.getElementById('show-login') as HTMLAnchorElement | null;

// Form elements
const loginSubmit = document.getElementById('login-submit') as HTMLButtonElement | null;
const registerSubmit = document.getElementById('register-submit') as HTMLButtonElement | null;

// Switch between forms - add null checks
if (showRegisterLink) {
    showRegisterLink.addEventListener('click', (e: Event) => {
        e.preventDefault();
        if (loginForm && registerForm) {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        }
    });
}

if (showLoginLink) {
    showLoginLink.addEventListener('click', (e: Event) => {
        e.preventDefault();
        if (registerForm && loginForm) {
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        }
    });
}

// Handle login - add null check
if (loginForm) {
    loginForm.addEventListener('submit', async (e: Event) => {
        e.preventDefault();
        console.log('Login form submitted');
        const emailInput = document.getElementById('login-email') as HTMLInputElement;
        const passwordInput = document.getElementById('login-password') as HTMLInputElement;
        
        if (!emailInput || !passwordInput) {
            console.error('Login form elements not found');
            return;
        }
        
        const email = emailInput.value;
        const password = passwordInput.value;

        const data: AuthData = { email, password };
        
        try {
            // Send login data to main process
            const response: AuthResponse = await window.electron.invoke('login', data);
            
            if (response.success) {
                console.log('Login successful');
                // Store token in localStorage for future authenticated requests
                if (response.token) {
                    const token = response.token;
                    const token_type = response.token_type || 'bearer';
                    
                    // Save to localStorage
                    localStorage.setItem('auth_token', token);
                    localStorage.setItem('token_type', token_type);
                    localStorage.setItem('user_email', email);
                    // Store password temporarily in localStorage
                    localStorage.setItem('encryption_password', password);
                    
                    // Send auth data to main process for persistent storage
                    (window.electron as ElectronAPI).updateAuth({
                        token,
                        token_type,
                        user_email: email
                    });
                    
                    // Redirect to dashboard page with correct path
                    window.location.href = 'dashboard.html';
                }
            } else {
                console.error('Login failed:', response.message);
                // Show error message to user
                alert(`Login failed: ${response.message}`);
            }
        } catch (error) {
            console.error('Login failed:', error);
            // Handle login error (show error message)
            alert('Login failed. Please try again.');
        }
    });
}

// Handle registration - add null check
if (registerForm) {
    registerForm.addEventListener('submit', async (e: Event) => {
        e.preventDefault();
        console.log('Register form submitted');
        const emailInput = document.getElementById('register-email') as HTMLInputElement;
        const passwordInput = document.getElementById('register-password') as HTMLInputElement;
        const confirmPasswordInput = document.getElementById('register-confirm-password') as HTMLInputElement;
        
        if (!emailInput || !passwordInput || !confirmPasswordInput) {
            console.error('Register form elements not found');
            return;
        }
        
        const email = emailInput.value;
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (password !== confirmPassword) {
            console.error('Passwords do not match');
            alert('Passwords do not match');
            return;
        }

        const data: AuthData = { email, password };
        
        try {
            // Send registration data to main process
            const response: AuthResponse = await window.electron.invoke('register', data);
            
            if (response.success) {
                console.log('Registration successful');
                // Show success messages
                alert('Registration successful! Please login.');
                // Switch to login form
                if (loginForm) {
                    registerForm.classList.add('hidden');
                    loginForm.classList.remove('hidden');
                }
            } else {
                console.error('Registration failed:', response.message);
                // Show error message to user
                alert(`Registration failed: ${response.message}`);
            }
        } catch (error) {
            console.error('Registration failed:', error);
            // Handle registration error
            alert('Registration failed. Please try again.');
        }
    });
} 