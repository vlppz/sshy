"use strict";
// Theme management
class ThemeController {
    constructor() {
        this.html = document.documentElement;
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) {
            throw new Error('Theme toggle button not found');
        }
        this.themeToggle = toggle;
        this.currentTheme = this.getInitialTheme();
        this.init();
    }
    getInitialTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return savedTheme || (systemPrefersDark ? 'dark' : 'light');
    }
    init() {
        this.setTheme(this.currentTheme);
        this.themeToggle.addEventListener('click', () => this.toggle());
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)')
            .addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
    toggle() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }
    setTheme(theme) {
        this.currentTheme = theme;
        this.html.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.themeToggle.innerHTML = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
    }
}
// Authentication setup
function setupAuth() {
    // Get DOM elements
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    // Switch between forms
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    });
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });
    // Handle login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Login form submitted');
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const data = { email, password };
        try {
            // Send login data to main process
            await window.electron.invoke('login', data);
            console.log('Login successful');
            // Handle successful login (redirect or show success message)
        }
        catch (error) {
            console.error('Login failed:', error);
            // Handle login error (show error message)
        }
    });
    // Handle registration
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Register form submitted');
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        if (password !== confirmPassword) {
            console.error('Passwords do not match');
            return;
        }
        const data = { email, password, name };
        try {
            // Send registration data to main process
            await window.electron.invoke('register', data);
            console.log('Registration successful');
            // Handle successful registration (redirect to login or show success message)
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        }
        catch (error) {
            console.error('Registration failed:', error);
            // Handle registration error (show error message)
        }
    });
}
// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        new ThemeController();
        setupAuth();
    }
    catch (error) {
        console.error('Failed to initialize:', error);
    }
});
//# sourceMappingURL=auth.js.map