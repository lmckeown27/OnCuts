# CampusCuts Web App

Decentralized web frontend for CampusCuts - the campus barber booking platform.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

Visit `http://localhost:5173` to see the app.

## 📦 Build

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

## 🔧 Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
VITE_STRIPE_PUBLIC_KEY=pk_test_your_key
```

## 📱 PWA Features

This is a Progressive Web App with:
- Offline support via Service Worker
- App manifest for mobile installation
- Push notification support
- Responsive design for all devices

## 🌐 Deployment

### Traditional Hosting (Vercel, Netlify, etc.)

```bash
# Build the app
npm run build

# Deploy dist/ folder to your hosting provider
```

### Docker Deployment

```bash
# Build Docker image
docker build -t campuscuts-web .

# Run container
docker run -p 8080:80 campuscuts-web
```

### IPFS Deployment (Decentralized)

```bash
# Install IPFS (if not already installed)
# https://docs.ipfs.tech/install/

# Make deploy script executable
chmod +x deploy-ipfs.sh

# Deploy to IPFS
./deploy-ipfs.sh
```

The script will:
1. Build the production app
2. Add files to IPFS
3. Return IPFS hash for access
4. Optionally pin to local node

Access via:
- `https://ipfs.io/ipfs/<hash>`
- `https://cloudflare-ipfs.com/ipfs/<hash>`
- Local gateway: `http://localhost:8080/ipfs/<hash>`

## 🏗️ Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Routing:** React Router v6
- **HTTP Client:** Axios
- **Real-time:** Socket.IO Client
- **Forms:** React Hook Form
- **Payments:** Stripe React
- **Icons:** Lucide React
- **Notifications:** React Hot Toast

## 📂 Project Structure

```
web-app/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   └── icons/                 # App icons
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Loading.tsx
│   │   └── Navbar.tsx
│   ├── pages/                 # Route pages
│   │   ├── auth/              # Authentication pages
│   │   ├── student/           # Student views
│   │   └── barber/            # Barber views
│   ├── services/              # API services
│   │   ├── api.service.ts
│   │   ├── auth.service.ts
│   │   ├── barber.service.ts
│   │   ├── booking.service.ts
│   │   ├── message.service.ts
│   │   └── socket.service.ts
│   ├── store/                 # State management
│   │   ├── useAuthStore.ts
│   │   └── useMessageStore.ts
│   ├── types/                 # TypeScript types
│   ├── config/                # Configuration
│   ├── App.tsx                # Main app component
│   └── main.tsx               # Entry point
├── Dockerfile                 # Docker configuration
├── nginx.conf                 # Nginx configuration
├── deploy-ipfs.sh             # IPFS deployment script
└── package.json
```

## 🔐 Security

- HTTPS only in production
- Environment variables for sensitive data
- JWT token authentication
- XSS protection via React
- CORS configuration
- Rate limiting on API

## 📱 Mobile Support

The app is fully responsive and works as a PWA on mobile devices:

- Install to home screen
- Offline functionality
- Push notifications
- Native-like experience

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details
