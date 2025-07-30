// Quick test script to validate webhook endpoint from Telegram's perspective
const https = require('https');

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = 'https://telegram-channel-marketplace.onrender.com/webhook/telegram';

console.log('Testing webhook setup with bot token:', botToken ? 'Present' : 'Missing');
console.log('Webhook URL:', webhookUrl);

// Test 1: Simple GET request
https.get(webhookUrl, (res) => {
  console.log('\n=== GET Test ===');
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response:', data);
    
    // Test 2: POST request
    const postData = JSON.stringify({ test: 'webhook_validation' });
    const options = {
      hostname: 'telegram-channel-marketplace.onrender.com',
      port: 443,
      path: '/webhook/telegram',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    
    console.log('\n=== POST Test ===');
    const req = https.request(options, (res) => {
      console.log('Status:', res.statusCode);
      console.log('Headers:', res.headers);
      
      let postResponseData = '';
      res.on('data', chunk => postResponseData += chunk);
      res.on('end', () => {
        console.log('Response:', postResponseData);
        
        // Test 3: Try webhook setup
        if (botToken) {
          console.log('\n=== Webhook Setup Test ===');
          const webhookData = JSON.stringify({ url: webhookUrl });
          const webhookOptions = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${botToken}/setWebhook`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': webhookData.length
            }
          };
          
          const webhookReq = https.request(webhookOptions, (res) => {
            console.log('Webhook setup status:', res.statusCode);
            let webhookResponseData = '';
            res.on('data', chunk => webhookResponseData += chunk);
            res.on('end', () => {
              console.log('Webhook setup response:', webhookResponseData);
            });
          });
          
          webhookReq.on('error', (e) => {
            console.error('Webhook setup error:', e);
          });
          
          webhookReq.write(webhookData);
          webhookReq.end();
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('POST request error:', e);
    });
    
    req.write(postData);
    req.end();
  });
}).on('error', (e) => {
  console.error('GET request error:', e);
});