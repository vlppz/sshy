/**
 * Dashboard functionality
 */

import { initializeServerManager } from './services/serverManager';

// Theme management
type Theme = 'light' | 'dark';

// Apply theme to document
const applyDashboardTheme = (theme: Theme) => {
    // Disable transitions temporarily
    document.documentElement.classList.add('no-transition');
    
    // Apply theme
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update button icon
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'light' ? 'bi bi-moon' : 'bi bi-sun';
        }
    }
    
    // Save preference to localStorage
    localStorage.setItem('theme', theme);
    
    // Re-enable transitions after a brief delay
    setTimeout(() => {
        document.documentElement.classList.remove('no-transition');
    }, 50);
};

// Check for saved theme preference or use system preference
const getDashboardInitialTheme = (): Theme => {
    // Check if user has saved preference
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
        return savedTheme;
    }
    
    // If no saved preference, check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('auth_token');
    const userEmail = localStorage.getItem('user_email');
    
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    
    // Display user email
    if (userEmail) {
        const userEmailElement = document.getElementById('user-email');
        if (userEmailElement) {
            userEmailElement.textContent = userEmail;
        }
    }
    
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') as Theme;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    applyDashboardTheme(initialTheme);
    
    // Initialize server management
    initializeServerManager();
    
    // Handle logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token_type');
        localStorage.removeItem('user_email');
        sessionStorage.removeItem('encryption_password');
        window.location.href = 'index.html';
    });
}); 