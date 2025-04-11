# SSHY - Secure SSH Connection Manager

SSHY is a modern desktop application that simplifies managing and connecting to your SSH servers. With an intuitive interface, secure credential storage, and quick connection capabilities, SSHY makes server management effortless.

![SSHY Dashboard](https://placehold.co/600x400?text=SSHY+Dashboard)

## Features

- **Secure Credential Storage**: All authentication data is encrypted locally
- **Multiple Authentication Methods**: Support for both password and SSH key authentication
- **Simple Server Management**: Add, edit, and delete SSH servers with ease
- **Modern UI**: Clean, responsive interface built with Electron
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Tech Stack

### Frontend
- **Electron**: Cross-platform desktop application framework
- **TypeScript**: Type-safe JavaScript
- **HTML/CSS**: Modern UI components
- **Webpack**: Module bundling

### Backend
- **FastAPI**: High-performance Python web framework
- **Tortoise ORM**: Async ORM for Python
- **SQLite/PostgreSQL**: Database options
- **Uvicorn**: ASGI web server

## Installation

### Prerequisites
- Node.js (v16+)
- Python (v3.9+)
- pip (Python package manager)

### Setup

1. **Clone the repository**
   ```
   git clone https://github.com/yourusername/sshy.git
   cd sshy
   ```

2. **Install backend dependencies**
   ```
   cd backend
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   ```
   cp .env.example .env
   # Edit .env file with your configuration
   ```

4. **Install frontend dependencies**
   ```
   cd ../app
   npm install
   ```

5. **Build and start the application**
   ```
   # In one terminal, start the backend
   cd backend
   python main.py
   
   # In another terminal, start the frontend
   cd app
   npm run start
   ```

## Usage

### Adding a New Server

1. Click the "+" button in the dashboard or the "Add Server" button in the empty state
2. Enter server details:
   - Server name (for display purposes)
   - Hostname/IP address
   - Username
   - Authentication method (password or SSH key)
3. Click "Save" to add the server

### Connecting to a Server

1. Click the "Connect" button on any server card
2. The application will establish an SSH connection using the stored credentials

### Managing Servers

- **Edit**: Click the "Edit" button on any server card to modify its details
- **Delete**: Click the "Delete" button to remove a server from your list

## Security

SSHY takes security seriously:

- All sensitive authentication data is encrypted using strong encryption
- Credentials are only stored locally
- Backend API is secured with JWT authentication
- No server credentials are sent in plaintext

## Development

### Backend Development

The backend is built with FastAPI and provides a RESTful API for server management:
```
cd backend
python main.py
```

### Frontend Development

For frontend development with hot reloading:
```
cd app
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Electron](https://www.electronjs.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Tortoise ORM](https://tortoise-orm.readthedocs.io/) 