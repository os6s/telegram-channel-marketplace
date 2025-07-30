# 🚀 Render Deployment Guide for Telegram Channel Marketplace

## Prerequisites
- GitHub account with your project repository
- Render account (free tier available)
- Telegram Bot Token from @BotFather

## Step 1: Prepare Repository for Deployment

I've added the necessary files for Render deployment:

✅ **render.yaml** - Render service configuration
✅ **Dockerfile** - Container configuration
✅ **.dockerignore** - Excludes unnecessary files
✅ **Health check endpoint** - `/api/health` for monitoring
✅ **Production environment validation** - Database and token checks

## Step 2: Commit and Push to GitHub

```bash
git add .
git commit -m "feat: add Render deployment configuration with health checks"
git push origin main
```

## Step 3: Deploy on Render

### Option A: Using render.yaml (Recommended)

1. **Go to [Render Dashboard](https://dashboard.render.com/)**
2. **Click "New +"** → **"Blueprint"**
3. **Connect GitHub repository**: Select your `telegram-channel-marketplace` repo
4. **Review configuration**: Render will read the `render.yaml` file
5. **Set environment variables**:
   - `TELEGRAM_BOT_TOKEN`: Your bot token from @BotFather
   - Other variables are auto-configured

### Option B: Manual Setup

1. **Create Web Service**:
   - Go to Render Dashboard → New → Web Service
   - Connect GitHub repository
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

2. **Create PostgreSQL Database**:
   - New → PostgreSQL
   - Database Name: `telegram_marketplace`
   - Note the connection string

3. **Configure Environment Variables**:
   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=[PostgreSQL connection string]
   TELEGRAM_BOT_TOKEN=[Your bot token]
   WEBAPP_URL=https://[your-app-name].onrender.com
   JWT_SECRET=[Auto-generated or your own]
   SESSION_SECRET=[Auto-generated or your own]
   ```

## Step 4: Environment Variables Setup

### Required Variables:
- **TELEGRAM_BOT_TOKEN**: Get from @BotFather
- **DATABASE_URL**: Auto-provided by Render PostgreSQL
- **WEBAPP_URL**: Your Render app URL

### Auto-Generated Variables:
- **JWT_SECRET**: Render can auto-generate
- **SESSION_SECRET**: Render can auto-generate

### Optional Variables:
- **PORT**: Defaults to 5000
- **NODE_ENV**: Set to production

## Step 5: Database Migration

After deployment, the database will be automatically set up using Drizzle:
- Tables created based on shared/schema.ts
- No manual SQL needed

## Step 6: Telegram Bot Configuration

1. **Set Webhook** (if using webhooks):
   ```bash
   curl -X POST "https://api.telegram.org/bot[BOT_TOKEN]/setWebhook" \
   -H "Content-Type: application/json" \
   -d '{"url": "https://[your-app].onrender.com/api/telegram/webhook"}'
   ```

2. **Or use Polling** (default setup):
   - Bot automatically starts polling on deployment
   - No additional configuration needed

## Step 7: Verify Deployment

### Check Application Health:
Visit: `https://[your-app].onrender.com/api/health`

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-30T...",
  "uptime": 123.456,
  "environment": "production"
}
```

### Check Telegram Integration:
1. Message your bot: `/start`
2. Bot should respond with marketplace link
3. Click link to open web app

### Check Database:
- API endpoints should work: `/api/stats`, `/api/channels`
- Database connection verified in logs

## Step 8: Post-Deployment Configuration

### Update Telegram Bot Commands:
```bash
curl -X POST "https://api.telegram.org/bot[BOT_TOKEN]/setMyCommands" \
-H "Content-Type: application/json" \
-d '{
  "commands": [
    {"command": "start", "description": "Start using the marketplace"},
    {"command": "help", "description": "Get help and support"}
  ]
}'
```

### Configure Domain (Optional):
- Add custom domain in Render settings
- Update WEBAPP_URL environment variable
- Update Telegram bot webhook URL

## Troubleshooting

### Common Issues:

1. **Build Failure**:
   - Check Node.js version (18+ required)
   - Verify package.json scripts
   - Check build logs for missing dependencies

2. **Database Connection**:
   - Verify DATABASE_URL format
   - Check PostgreSQL service status
   - Review connection logs

3. **Bot Not Responding**:
   - Verify TELEGRAM_BOT_TOKEN is correct
   - Check bot permissions
   - Review webhook/polling configuration

4. **Health Check Failed**:
   - Verify `/api/health` endpoint
   - Check application startup logs
   - Ensure port 5000 is used

### Render-Specific:

1. **Free Tier Limitations**:
   - Service sleeps after 15 minutes of inactivity
   - First request after sleep takes ~30 seconds
   - 500 build hours per month

2. **Resource Limits**:
   - 512MB RAM
   - Shared CPU
   - 1GB storage

3. **Logs and Monitoring**:
   - View logs in Render dashboard
   - Monitor resource usage
   - Set up alerts for failures

## Performance Optimization

### For Production:
1. **Enable Caching**: Add Redis for session storage
2. **Database Optimization**: Use connection pooling
3. **Static Assets**: Use CDN for large files
4. **Monitoring**: Set up error tracking (Sentry)

### Free Tier Tips:
1. **Keep Service Warm**: Use a cron job to ping health endpoint
2. **Optimize Bundle**: Use tree shaking and compression
3. **Database Queries**: Optimize with proper indexing

## Security Checklist

- [ ] Environment variables properly set
- [ ] Database credentials secure
- [ ] Bot token kept secret
- [ ] HTTPS enabled (automatic on Render)
- [ ] Input validation enabled
- [ ] Rate limiting configured

## Monitoring

### Key Metrics:
- Response times
- Error rates
- Database connections
- Bot message volume

### Health Checks:
- API health endpoint
- Database connectivity
- Bot polling status

Your Telegram Channel Marketplace is now ready for production on Render! 🎉