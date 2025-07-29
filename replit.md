# Telegram Channel Marketplace

## Overview

This is a full-stack Telegram mini app that allows users to buy and sell Telegram channels. The platform operates as a marketplace where channel owners can list their channels for sale, and buyers can browse, purchase, and manage transactions through an escrow system. The application integrates with the Telegram Web App API and supports TON cryptocurrency payments. Successfully deployed and working on Render platform.

## Recent Changes

### January 29, 2025 - Major UI/UX Enhancement Update
- ✓ Implemented dark mode with automatic Telegram theme detection and synchronization
- ✓ Added comprehensive English/Arabic language switching with RTL layout support
- ✓ Enhanced marketplace with improved category navigation (no page reloads, smooth transitions)
- ✓ Created multi-step channel selling process with verification and enhanced UX
- ✓ Integrated TON wallet connection functionality with mock implementation for development
- ✓ Made app fully compatible with Telegram Mini App standards and WebApp API
- ✓ Fixed navigation system to use proper client-side routing instead of page reloads
- ✓ Added theme and settings modal with user-friendly controls
- ✓ Implemented internationalization system with context providers for theme and language
- ✓ Enhanced UI components with proper dark mode support and responsive design

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a modern full-stack architecture with clear separation between client and server components:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Radix UI components with shadcn/ui styling
- **Styling**: Tailwind CSS with custom Telegram-themed color palette
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON responses
- **Middleware**: Custom logging and error handling

### Database Architecture
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (configured for Neon Database)
- **Migrations**: Drizzle Kit for schema management
- **Storage**: Abstracted storage layer with in-memory implementation for development

## Key Components

### Data Models
- **Users**: Stores Telegram user information and wallet addresses
- **Channels**: Contains channel listings with metadata, pricing, and verification status
- **Escrows**: Manages secure transactions between buyers and sellers

### Core Features
1. **Channel Marketplace**: Browse, filter, and search for channels by category, price, and subscribers
2. **Channel Listing**: Sellers can list their channels with detailed information and pricing
3. **Escrow System**: Secure transaction management with verification steps
4. **Wallet Integration**: TON Connect integration for cryptocurrency payments
5. **Telegram Integration**: Native Telegram Web App features and user authentication

### UI Components
- **Responsive Design**: Mobile-first approach optimized for Telegram's mobile interface
- **Component Library**: Comprehensive set of reusable UI components from Radix UI
- **Navigation**: Bottom tab navigation following mobile app patterns
- **Forms**: React Hook Form with Zod validation for type-safe form handling

## Data Flow

1. **User Authentication**: Telegram Web App provides user identity and authentication
2. **Channel Browsing**: Users can filter and search channels through the marketplace
3. **Transaction Initiation**: Buyers create escrow transactions for channel purchases
4. **Verification Process**: Bot tokens are used to verify channel ownership transfer
5. **Payment Processing**: TON cryptocurrency handles the financial transactions
6. **Completion**: Successful verification triggers escrow completion and ownership transfer

## External Dependencies

### Telegram Integration
- **Telegram Web App SDK**: For native Telegram features and user authentication
- **Bot API**: For channel verification and ownership transfer

### Blockchain Integration
- **TON Connect**: Wallet connection and transaction management
- **Neon Database**: PostgreSQL hosting with serverless architecture

### Development Tools
- **Replit Integration**: Development environment with hot reloading and debugging
- **ESBuild**: Fast JavaScript bundling for production builds

## Deployment Strategy

### Development Environment
- **Hot Reloading**: Vite development server with HMR
- **Database**: Local PostgreSQL or cloud-hosted Neon Database
- **Environment Variables**: DATABASE_URL for database connection

### Production Build
- **Frontend**: Static assets built with Vite and served by Express
- **Backend**: Node.js server with bundled dependencies
- **Database**: PostgreSQL with connection pooling via Drizzle ORM

### Scaling Considerations
- **Storage Abstraction**: Interface allows switching from in-memory to persistent database
- **API Rate Limiting**: Ready for implementation as user base grows
- **Caching Strategy**: React Query provides client-side caching, server-side caching can be added
- **Session Management**: Currently stateless, can be enhanced with persistent sessions

The architecture prioritizes developer experience with TypeScript throughout, fast build times with Vite, and a clean separation of concerns that makes the codebase maintainable and extensible.