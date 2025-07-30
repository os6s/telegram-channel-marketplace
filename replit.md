# Telegram Channel Marketplace

## Overview
A sophisticated Telegram web app marketplace for secure channel trading using TON cryptocurrency, featuring advanced escrow protection and dynamic user management. The app allows users to buy and sell Telegram channels with secure escrow transactions.

## Tech Stack
- Frontend: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- Backend: Express + TypeScript
- Database: PostgreSQL (with in-memory storage for development)
- Authentication: Telegram WebApp API
- Payment: TON Cryptocurrency (integration pending)

## Project Architecture

### Key Components
1. **Marketplace**: Browse and search channels by category, subscribers, and price
2. **Sell Channel**: List channels for sale with verification
3. **Guarantors**: Third-party escrow service providers
4. **Profile**: User management and transaction history
5. **Telegram Bot**: Automated channel ownership monitoring

### Data Models
- **User**: Telegram users with wallet connections
- **Channel**: Listed channels with pricing and metadata
- **Escrow**: Transaction management with status tracking
- **Guarantor**: Trusted third-party escrow providers

## Recent Changes

### Render Deployment Fix (July 30, 2025)
1. **Build Process Fixed**:
   - Created custom build.sh script with npx for proper binary execution
   - Added .nvmrc for Node.js version specification
   - Updated render.yaml and Dockerfile for new build process
   - Resolved "vite: not found" error on Render platform

2. **Production Optimization**:
   - Build dependencies properly installed as production dependencies
   - Custom build script with fallback installation
   - Detailed logging for deployment debugging
   - Successfully tested locally with full build process

### GitHub Publication Preparation (July 30, 2025)
1. **Repository Files Created**:
   - Added comprehensive .gitignore for proper version control
   - Created professional README_GITHUB.md with full documentation
   - Added CONTRIBUTING.md with development guidelines
   - Created LICENSE file (MIT)
   - Added .env.example template for environment setup

2. **Publication Guides**:
   - Created GITHUB_PUBLISHING_GUIDE.md with step-by-step instructions
   - Added ALTERNATIVE_PUBLISHING_METHODS.md for non-technical users
   - Created SIMPLE_GITHUB_UPLOAD.md for web-based upload
   - Added PUBLISH_COMMANDS.txt with exact git commands

3. **Documentation Enhancement**:
   - Comprehensive API documentation with TypeScript examples
   - Security features and architecture explanations
   - Installation and deployment instructions
   - Contributing guidelines and development setup

### Render Bot Configuration Fix (July 30, 2025)
1. **Webhook Route Priority Fixed**:
   - Webhook route registered with absolute priority before any middleware
   - Resolved static file serving intercepting webhook requests
   - Added comprehensive webhook debugging and validation
   
2. **Enhanced Webhook Setup**:
   - Automatic webhook configuration for production environment
   - Force delete existing webhook before setting new one
   - Added webhook info debugging and POST endpoint testing
   - Proper error handling and detailed logging
   
3. **Message Handling Implementation**:
   - Added complete webhook message processing with /start command support
   - Implemented sendTelegramMessage helper for bot responses
   - Added callback query handling for inline keyboards
   - Comprehensive error handling and logging for all message types

4. **Mini App Integration - WORKING SOLUTION**:
   - Added inline web app button to /start command for direct marketplace access
   - Configured proper web_app parameter for Telegram Mini App functionality
   - Resolved redirect conflicts by disabling problematic middleware
   - Mini App opens perfectly within Telegram (no redirects)
   - External visitors to Render URL properly redirected to bot chat
   - Current configuration maintained as requested by user
   
4. **Environment Variable Requirements**:
   - TELEGRAM_BOT_TOKEN must be set in Render dashboard
   - Webhook URL automatically uses WEBAPP_URL environment variable
   - Production mode detection properly implemented

### Bug Fixes (July 29, 2025)
1. **Type Safety Issues Fixed**:
   - Added proper typing for marketplace stats API response
   - Fixed form error handling TypeScript issues in sell channel page
   
2. **Security Improvements**:
   - Added proper user authentication using Telegram WebApp context
   - Implemented authorization checks for channel updates and deletions
   - Added validation for negative numbers in price and subscriber fields
   - Added username format validation (5-32 chars, alphanumeric + underscores)
   - Prevent channel deletion if active escrows exist

3. **Memory Leak Prevention**:
   - Fixed Telegram bot monitoring intervals with proper cleanup
   - Added timeout handling for channel transfer monitoring
   - Store active monitors in a Map for proper management

4. **Input Validation**:
   - Enhanced filter inputs to prevent NaN and edge cases
   - Added min/max constraints on numeric inputs
   - Proper handling of empty filter values

### Current Working Configuration
1. **Mini App Access**: Working perfectly - opens directly in Telegram without redirects
2. **External Redirect**: External browsers accessing Render URL are properly redirected to bot
2. **Data Persistence**: Currently using in-memory storage - need migration to PostgreSQL
3. **Payment Integration**: TON wallet integration is UI-only, needs blockchain connection
4. **Bot Token Verification**: Channel verification endpoint has TODO - needs implementation
5. **Escrow Processing**: No actual payment processing or smart contract integration
6. **Error Boundaries**: React components lack error boundaries for crash prevention

## User Preferences
- Language: Simple, non-technical explanations
- Code Style: TypeScript with proper type safety
- Priority: Security and data validation over features

## Development Guidelines
1. Always validate user inputs on both client and server
2. Use proper TypeScript types - avoid `any`
3. Implement proper error handling with user-friendly messages
4. Add authorization checks for all sensitive operations
5. Clean up resources (timers, listeners) to prevent memory leaks

## API Endpoints
- `POST /api/users` - Create/get user by Telegram ID
- `GET /api/channels` - List channels with filters
- `POST /api/channels` - Create new channel listing (requires auth)
- `PATCH /api/channels/:id` - Update channel (owner only)
- `DELETE /api/channels/:id` - Delete channel (owner only, no active escrows)
- `POST /api/escrows` - Create escrow transaction
- `GET /api/stats` - Marketplace statistics

## Telegram Bot Commands
- `/start` - Welcome message with marketplace link
- Channel ownership monitoring for escrow completion
- Automated notifications for buyers and sellers

## Security Considerations
1. All channel modifications require owner authentication
2. Channels with active escrows cannot be deleted
3. Input validation prevents XSS and injection attacks
4. Telegram WebApp authentication for user identity
5. Bot token should be kept secret and validated

## Next Steps
1. Implement PostgreSQL data persistence
2. Add TON blockchain integration for payments
3. Implement channel verification with bot tokens
4. Add comprehensive error boundaries
5. Build transaction history views
6. Add email/SMS notifications for escrow updates