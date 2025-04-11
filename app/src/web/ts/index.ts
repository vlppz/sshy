/**
 * Main entry point for the web application
 * This file imports all the necessary modules to be bundled together
 */

// Import all necessary modules that should be bundled together
import './auth';
import './dashboard';
import './theme';
import './services/serverManager';

// Note: types.d.ts is automatically included as it's a declaration file
// No need to export or import it 