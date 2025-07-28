# Telegram Bot Setup Guide

## Step 1: Create Your Bot

1. Open Telegram and search for **@BotFather**
2. Start a chat with BotFather and send `/newbot`
3. Choose a name for your bot (e.g., "Channel Marketplace")
4. Choose a username ending in "bot" (e.g., "channelmarketplace_bot")
5. Save the **Bot Token** that BotFather gives you

## Step 2: Configure Web App

After getting your bot token, send these commands to @BotFather:

```
/setdomain
@your_bot_username
your-render-app-url.onrender.com
```

## Step 3: Set Up Web App Menu Button

```
/setmenubutton
@your_bot_username
```

Then send:
```
Marketplace - https://your-render-app-url.onrender.com
```

## Step 4: Configure Bot Settings

### Set Description:
```
/setdescription
@your_bot_username
Buy and sell Telegram channels with secure escrow using TON cryptocurrency. Browse channels, create listings, and complete transactions safely.
```

### Set About Text:
```
/setabouttext  
@your_bot_username
Telegram Channel Marketplace - Secure buying and selling with TON escrow
```

### Set Commands:
```
/setcommands
@your_bot_username
```

Then send:
```
start - Launch the marketplace
marketplace - Browse channels for sale
sell - List your channel for sale
escrows - View your transactions
help - Get help and support
```

## Step 5: Enable Inline Mode (Optional)

```
/setinline
@your_bot_username
Search channels...
```

## Step 6: Test Your Bot

1. Search for your bot in Telegram
2. Send `/start` to your bot
3. Click the "Marketplace" menu button
4. Your web app should open inside Telegram

## Important Notes

- **Replace** `your-render-app-url.onrender.com` with your actual Render deployment URL
- **Replace** `@your_bot_username` with your actual bot username
- The web app will only work with HTTPS URLs (Render provides this automatically)
- Users can access your marketplace by starting your bot or using the menu button

## Bot Commands You Can Add

Create a simple bot handler (optional) by adding this to your server:

```javascript
// Add to server/index.ts if you want basic bot responses
app.post('/webhook', (req, res) => {
  const { message } = req.body;
  
  if (message?.text === '/start') {
    // Send welcome message with web app button
    // This requires bot token and Telegram Bot API
  }
  
  res.sendStatus(200);
});
```

Your web app will work without this - users can access it through the menu button!