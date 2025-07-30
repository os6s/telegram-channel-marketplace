#!/bin/bash

# Render Deployment Script for Telegram Channel Marketplace

echo "🚀 Preparing Telegram Channel Marketplace for Render deployment..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Please run 'git init' first."
    exit 1
fi

# Add all files
echo "📁 Adding files to git..."
git add .

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "✅ No changes to commit. Repository is up to date."
else
    # Commit changes
    echo "💾 Committing deployment configuration..."
    git commit -m "feat: add Render deployment configuration

    - Added render.yaml for service configuration
    - Created Dockerfile for containerization
    - Added health check endpoint (/api/health)
    - Implemented PostgreSQL database support
    - Added production environment validation
    - Created deployment guides and documentation"
fi

# Push to GitHub
echo "🔄 Pushing to GitHub..."
if git push origin main; then
    echo "✅ Successfully pushed to GitHub!"
else
    echo "❌ Failed to push to GitHub. Please check your git configuration."
    exit 1
fi

echo ""
echo "🎉 Deployment preparation complete!"
echo ""
echo "Next steps:"
echo "1. Go to https://dashboard.render.com/"
echo "2. Click 'New +' → 'Blueprint'"
echo "3. Connect your GitHub repository"
echo "4. Set TELEGRAM_BOT_TOKEN environment variable"
echo "5. Deploy!"
echo ""
echo "Your app will be available at: https://telegram-channel-marketplace.onrender.com"