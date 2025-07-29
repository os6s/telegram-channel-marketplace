# 🏪 Telegram Channel Marketplace

A sophisticated Telegram web app marketplace for secure channel trading using TON cryptocurrency, featuring advanced escrow protection and dynamic user management.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.6.3-blue.svg)

## ✨ Features

- 🛒 **Secure Channel Trading** - Buy and sell Telegram channels with escrow protection
- 💰 **TON Cryptocurrency** - Native integration with Telegram Open Network
- 🔒 **Advanced Escrow System** - Multi-party protection with automated verification
- 🛡️ **Guarantor Services** - Trusted third-party escrow providers
- 📱 **Responsive Design** - Mobile-first Telegram WebApp interface
- 🤖 **Automated Bot Integration** - Real-time channel ownership monitoring
- 🌍 **Multi-language Support** - English, Arabic, and more
- 🎨 **Modern UI** - Dark/light themes with smooth animations

## 🚀 Tech Stack

### Frontend
- **React 18** with TypeScript for type safety
- **Vite** for lightning-fast development
- **TailwindCSS** + **shadcn/ui** for modern styling
- **Framer Motion** for smooth animations
- **React Query** for efficient data fetching

### Backend
- **Express.js** with TypeScript
- **PostgreSQL** with **Drizzle ORM**
- **Telegram Bot API** integration
- **TON Blockchain** connectivity
- **WebSocket** for real-time updates

### Security & Authentication
- **Telegram WebApp API** for user authentication
- **JWT tokens** for session management
- **Input validation** with Zod schemas
- **Authorization middleware** for protected routes

## 📦 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Telegram Bot Token ([Get one from @BotFather](https://t.me/botfather))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/telegram-channel-marketplace.git
   cd telegram-channel-marketplace
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Configure database**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

Visit `http://localhost:5000` to see your marketplace in action!

## ⚙️ Environment Configuration

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/marketplace

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
WEBAPP_URL=https://yourdomain.com

# TON Integration
TON_WALLET_MANIFEST_URL=https://yourdomain.com/tonconnect-manifest.json

# Security
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# Optional: Development
NODE_ENV=development
PORT=5000
```

## 📁 Project Structure

```
telegram-channel-marketplace/
├── 📁 client/                    # React frontend application
│   ├── 📁 src/
│   │   ├── 📁 components/        # Reusable UI components
│   │   ├── 📁 pages/            # Application pages
│   │   ├── 📁 contexts/         # React contexts
│   │   ├── 📁 hooks/            # Custom React hooks
│   │   └── 📁 lib/              # Utility functions
│   └── 📄 index.html            # Entry HTML file
├── 📁 server/                    # Express backend
│   ├── 📄 index.ts              # Server entry point
│   ├── 📄 routes.ts             # API routes
│   ├── 📄 storage.ts            # Database operations
│   ├── 📄 telegram-bot.ts       # Bot integration
│   └── 📄 vite.ts               # Vite development setup
├── 📁 shared/                    # Shared TypeScript schemas
│   └── 📄 schema.ts             # Database & validation schemas
├── 📁 drizzle/                   # Database migrations
└── 📄 components.json           # shadcn/ui configuration
```

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push database schema changes |

## 🔗 API Documentation

### Authentication
All protected endpoints require Telegram WebApp authentication.

### Channels API
```typescript
GET    /api/channels              # List channels with filters
POST   /api/channels              # Create new channel listing
GET    /api/channels/:id          # Get channel details
PATCH  /api/channels/:id          # Update channel (owner only)
DELETE /api/channels/:id          # Delete channel (owner only)
POST   /api/channels/:id/verify   # Verify channel ownership
```

### Escrows API
```typescript
GET    /api/escrows               # List user escrows
POST   /api/escrows               # Create escrow transaction
GET    /api/escrows/:id           # Get escrow details
PATCH  /api/escrows/:id           # Update escrow status
```

### Users API
```typescript
POST   /api/users                 # Create or authenticate user
GET    /api/users/:id             # Get user profile
PATCH  /api/users/:id             # Update user profile
```

### Statistics API
```typescript
GET    /api/stats                 # Get marketplace statistics
```

## 🔐 Security Features

- **Authentication**: Telegram WebApp integration for secure user identity
- **Authorization**: Owner-only operations for channel management
- **Input Validation**: Comprehensive data validation using Zod schemas
- **Escrow Protection**: Prevents channel deletion during active transactions
- **Bot Verification**: Automated channel ownership verification
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Configured for secure cross-origin requests

## 🤖 Telegram Bot Setup

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Set up webhook or polling mode
4. Configure bot commands:
   ```
   /start - Start using the marketplace
   /help - Get help and support
   ```

## 🎨 UI Components

Built with **shadcn/ui** components for consistent design:

- **Cards** - Channel listings and user profiles
- **Forms** - Channel creation and user settings
- **Dialogs** - Confirmation modals and details
- **Navigation** - Bottom navigation and breadcrumbs
- **Data Display** - Tables, stats, and progress indicators

## 🧪 Testing

```bash
# Run type checking
npm run check

# Run linting
npm run lint

# Run tests (when available)
npm test
```

## 🚀 Deployment

### Using Render.com (Recommended)
1. Fork this repository
2. Connect to Render.com
3. Set environment variables
4. Deploy automatically from GitHub

### Using Docker
```bash
# Build image
docker build -t telegram-marketplace .

# Run container
docker run -p 5000:5000 --env-file .env telegram-marketplace
```

### Manual Deployment
```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Roadmap

- [ ] **Enhanced Payment System** - Full TON blockchain integration
- [ ] **Advanced Analytics** - Detailed marketplace insights
- [ ] **Mobile App** - Native iOS and Android applications
- [ ] **Multi-language** - Support for more languages
- [ ] **API Rate Limiting** - Enhanced security measures
- [ ] **Real-time Chat** - In-app messaging system
- [ ] **Reputation System** - User ratings and reviews

## 🐛 Known Issues

- Data persistence currently uses in-memory storage (PostgreSQL migration needed)
- TON wallet integration is UI-only (blockchain connection required)  
- Channel verification endpoint needs implementation
- Missing React error boundaries for crash prevention

## 📞 Support

- **Documentation**: [Wiki](https://github.com/yourusername/telegram-channel-marketplace/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/telegram-channel-marketplace/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/telegram-channel-marketplace/discussions)
- **Telegram**: [@YourSupportBot](https://t.me/yoursupportbot)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Telegram](https://telegram.org/) for the amazing platform
- [TON Foundation](https://ton.org/) for blockchain infrastructure
- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components
- [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations

---

<div align="center">
  <strong>Built with ❤️ for the Telegram community</strong>
</div>