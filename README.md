# Telegram Channel Marketplace

A Telegram web app marketplace for buying and selling Telegram channels with automated escrow using TON cryptocurrency.

## Features

- 🔍 **Channel Marketplace**: Browse, search, and filter channels by category, price, and subscriber count
- 💰 **Automated Escrow**: Secure transactions with TON cryptocurrency
- 🔒 **Channel Verification**: Bot token verification for ownership transfer
- 📱 **Mobile-First**: Optimized for Telegram's mobile interface
- 🎨 **Telegram-Themed UI**: Native look and feel with Telegram colors

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS + Radix UI
- **Blockchain**: TON Connect for wallet integration
- **Telegram**: Web App SDK integration

## Deployment on Render

### Prerequisites

1. Create a Render account at [render.com](https://render.com)
2. Fork or clone this repository
3. Set up a PostgreSQL database on Render

### Environment Variables

Configure these environment variables in your Render service:

```
DATABASE_URL=postgresql://username:password@host:port/database
NODE_ENV=production
PORT=10000
```

### Deploy Steps

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Use these build settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node
4. Add the environment variables above
5. Deploy

### Database Setup

The application will automatically run database migrations on startup. Make sure your PostgreSQL database is accessible and the `DATABASE_URL` is correctly configured.

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up your database URL in environment variables
4. Run development server: `npm run dev`
5. Access at `http://localhost:5000`

## Telegram Bot Setup

1. Create a Telegram bot via @BotFather
2. Configure the bot with your web app URL
3. Enable inline mode and web app features
4. Set up webhook for channel verification (optional)

## TON Integration

The app integrates with TON Connect for cryptocurrency transactions. Users need:

1. A TON wallet (TonKeeper, TonHub, etc.)
2. TON cryptocurrency for transactions
3. Web3 browser or Telegram app for wallet connection

## API Endpoints

- `GET /api/channels` - List all channels with filters
- `GET /api/channels/:id` - Get channel details
- `POST /api/channels` - Create new channel listing
- `GET /api/escrows` - List user escrows
- `POST /api/escrows` - Create new escrow
- `GET /api/stats` - Marketplace statistics

## Security Features

- Server-side validation with Zod schemas
- SQL injection protection via Drizzle ORM
- CORS configuration for Telegram domains
- Input sanitization and validation
- Secure session management

## License

MIT License - see LICENSE file for details