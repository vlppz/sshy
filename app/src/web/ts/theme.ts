/**
 * Theme toggle functionality
 */

// Check for saved theme preference or use system preference
const getInitialTheme = (): 'light' | 'dark' => {
  // Check if user has saved preference
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
  if (savedTheme) {
    return savedTheme;
  }
  
  // If no saved preference, check system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

// Apply theme to document
const applyTheme = (theme: 'light' | 'dark') => {
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
    } else {
      themeToggle.innerHTML = `<i class="${theme === 'light' ? 'bi bi-moon' : 'bi bi-sun'}"></i>`;
    }
  }
  
  // Save preference to localStorage
  localStorage.setItem('theme', theme);
  
  // Re-enable transitions after a brief delay
  setTimeout(() => {
    document.documentElement.classList.remove('no-transition');
  }, 50);
};

// Initialize theme toggle and other features after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const initialTheme = getInitialTheme();
  
  // Update the button icon without reapplying the theme (to avoid flicker)
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const icon = themeToggle.querySelector('i');
    if (icon) {
      icon.className = initialTheme === 'light' ? 'bi bi-moon' : 'bi bi-sun';
    } else {
      themeToggle.innerHTML = `<i class="${initialTheme === 'light' ? 'bi bi-moon' : 'bi bi-sun'}"></i>`;
    }
    
    // Set up theme toggle button
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
    });
  }
  
  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't set a preference
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        applyTheme(newTheme);
      }
    });
  }
}); 