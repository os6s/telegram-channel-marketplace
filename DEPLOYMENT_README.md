# Deployment Configuration

## Fixed Issues

### Port Configuration
- Fixed port mismatch between .replit config (PORT=5000) and server code
- Server now properly defaults to PORT=5000 instead of 10000
- Deployment configuration properly matches server configuration

### Environment Variables
- Added SESSION_SECRET environment variable handling
- Server provides sensible defaults for missing environment variables
- Warning messages for production deployments without proper secrets

### Build Configuration
- Maintained existing npm scripts for build and start
- Production build creates proper distribution files
- Static file serving configured for production

## Required Environment Variables for Production

```
PORT=5000                                    # Set by deployment platform
NODE_ENV=production                          # Set by deployment platform  
DATABASE_URL=postgresql://...                # PostgreSQL connection string
SESSION_SECRET=your-secure-session-secret    # Session encryption key
TELEGRAM_BOT_TOKEN=your-bot-token           # Optional: For bot functionality
```

## Deployment Commands

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Database Setup
```bash
npm run db:push
```

## Platform-Specific Notes

### Replit Deployments
- Use the deploy button in Replit interface
- Environment variables configured automatically
- Database connection handled by platform

### Manual Deployment
1. Set all required environment variables
2. Run `npm run build` to create distribution files
3. Run `npm start` to start production server
4. Ensure PostgreSQL database is accessible