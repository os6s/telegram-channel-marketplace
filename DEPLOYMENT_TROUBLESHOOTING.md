# Deployment Troubleshooting Guide

## Common Issues & Solutions

### 1. Build Failures
**Error:** `vite: not found` or `esbuild: not found`
**Solution:** 
```yaml
# For Render - use render.yaml:
buildCommand: npx vite build && npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
```

### 2. Database Connection Issues
**Error:** Database connection failed
**Solution:**
- Add `DATABASE_URL` environment variable
- Format: `postgresql://username:password@host:port/database`

### 3. Port Issues
**Error:** Application not accessible
**Solution:**
- Ensure server binds to `0.0.0.0:${PORT}`
- Set `PORT` environment variable (usually auto-set by platform)

### 4. Missing Environment Variables
**Required Variables:**
```
NODE_ENV=production
PORT=(auto-set by platform)
DATABASE_URL=postgresql://...
```

### 5. Static File Serving Issues
**Error:** Frontend not loading
**Check:**
- Build creates `dist/public/` directory
- Server serves static files in production mode

## Platform-Specific Solutions

### Replit Deployments
- Use the deploy button in Replit interface
- Database auto-configured
- No additional configuration needed

### Render
- Connect GitHub repository
- Use `render.yaml` configuration
- Create PostgreSQL database separately
- Add `DATABASE_URL` to environment variables

### Manual Deployment
1. `npm install`
2. `npm run build`
3. Set environment variables
4. `npm start`

## Debugging Steps

1. **Test build locally:**
   ```bash
   npm run build
   NODE_ENV=production node dist/index.js
   ```

2. **Check logs:**
   - Look for specific error messages
   - Check database connection logs
   - Verify environment variables

3. **Test endpoints:**
   ```bash
   curl https://your-app-url.com/api/stats
   ```

## Contact Information

If deployment still fails after trying these solutions, provide:
- Exact error message
- Deployment platform
- Build/runtime logs
- Environment variables (without sensitive values)