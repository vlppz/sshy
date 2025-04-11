# SSHY App

## TypeScript Bundling Setup

This project uses webpack to bundle TypeScript files into a single file for production to avoid directory importing issues.

### How It Works

1. **Webpack Configuration**: The `webpack.config.js` file defines two configurations:
   - Main process bundle: Compiles all the Electron main process TypeScript files into a single `main.js` file
   - Web process bundle: Compiles all the web TypeScript files into a single `index.bundle.js` file

2. **Entry Points**:
   - Main process: `src/main.ts`
   - Web process: `src/web/ts/index.ts` (imports all other TypeScript files)

3. **Build Process**:
   - `npm run build` - Builds both main and web bundles
   - `npm run watch` - Watches for changes and rebuilds

### Development

During development, webpack automatically resolves imports between TypeScript files and bundles them together.

### Production

In production, the bundled files are used:
- `dist/main.js` for the Electron main process
- `dist/web/js/index.bundle.js` for the web process

This approach prevents directory import issues in production by ensuring all TypeScript code is compiled into single files. 