require('dotenv').config();
const express = require('express');
const axios = require('axios');
const Groq = require('groq-sdk');

const app = express();
app.use(express.json());

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// WhatsApp message character limit
const WHATSAPP_MESSAGE_LIMIT = 4000; // Safe limit (actual is 4096)

// Conversation memory storage (in-memory)
const conversations = new Map();
const MAX_MESSAGES = 10; // Keep last 10 messages

// Server start time
const serverStartTime = new Date();

// ==========================================
// NATURE'S VIRTUE COMPLETE PRODUCT CATALOG
// ==========================================

const PRODUCT_CATALOG = {
  "Natural Cereal & Baby Food": [
    { name: "Herali Cereal with Mango", price: 1695 },
    { name: "Herali Cereal with Soursop", price: 1495 },
    { name: "Herali Cereal Banana", price: 1250 },
    { name: "Bowl Of Herali Cereal", price: 1250 }
  ],
  "Herbal Drinks": [
    { name: "Red Hibiscus & Lemon", price: 2650 },
    { name: "Soursop Black Tea", price: 1495 },
    { name: "Pineapple Black Tea", price: 1765 },
    { name: "Lunuwila Tea", price: 1250 },
    { name: "Detox Morning Tea", price: 1090 },
    { name: "Yakanaran Drink", price: 890 },
    { name: "Lemongrass Tea", price: 480 },
    { name: "Lemongrass Tea Cut", price: 550 }
  ],
  "Food Supplements & Beauty Care": [
    { name: "Hair Growth Oil", price: 2950 },
    { name: "Skin Glow Pro (4 in One)", price: 2850 },
    { name: "Skin Glow BC Drink", price: 1850 }
  ],
  "Dehydrated Fruits": [
    { name: "Mixed Fruit Cubes", price: 2250 },
    { name: "Dehydrated Mix Fruit Cubes", price: 1250 },
    { name: "Star Fruits", price: 1125 },
    { name: "Salted Bilimbi", price: 1125 },
    { name: "Dehydrated Mango", price: 890 },
    { name: "Blue Lotus Flower", price: 750 },
    { name: "Dehydrated Red Hibiscus", price: 750 },
    { name: "Jack Fruits (Waraka)", price: 650 },
    { name: "Dehydrated Papaya", price: 560 },
    { name: "Lunu Bilim", price: 495 },
    { name: "Dehydrated Breadfruit", price: 460 },
    { name: "Dehydrated Banana", price: 380 },
    { name: "Ripe Banana Coins Pack", price: 380 },
    { name: "Dehydrated Lemon Slices", price: 340 },
    { name: "Dehydrated Pandan Leaves", price: 320 },
    { name: "Jack", price: 220 }
  ],
  "Herbal Powders & Supplements": [
    { name: "Soursop Fruits Powder", price: 2225 },
    { name: "Red Hibiscus Powder", price: 1650 },
    { name: "Tomato Powder", price: 1250 },
    { name: "Heenbovitya Powder", price: 1250 },
    { name: "Centella Asiatica Powder (Gotukola)", price: 1250 },
    { name: "Beetroot Powder", price: 1200 },
    { name: "Bitter Gourd Powder", price: 1150 },
    { name: "Lunuwila Powder Bottle", price: 1100 },
    { name: "Moringa Leaves Powder", price: 1000 },
    { name: "Carrot Powder", price: 980 },
    { name: "Asparagus Racemosus Powder", price: 980 },
    { name: "Unsalted Dehydrated Spray", price: 950 },
    { name: "Soursop Fruit Powder", price: 950 },
    { name: "Jackfruit Powder", price: 870 },
    { name: "Blue Butterfly Pea Flower", price: 850 },
    { name: "Balloon Vine Powder", price: 750 },
    { name: "Moringa Powder Bottle", price: 650 },
    { name: "Mix Herbal Porridge Bottle", price: 480 },
    { name: "Curry Leaves Powder Bottle", price: 480 },
    { name: "Neem Leaf Powder", price: 450 },
    { name: "Mixed Herbal Porridge", price: 450 },
    { name: "Insulin Plant Leaf Powder", price: 360 }
  ]
};

// Generate price list text for AI
function generatePriceList() {
  let priceList = "\n\n=== COMPLETE PRODUCT CATALOG WITH PRICES ===\n\n";
  
  for (const [category, products] of Object.entries(PRODUCT_CATALOG)) {
    priceList += `\n${category}:\n`;
    products.forEach(product => {
      priceList += `   • ${product.name} - Rs. ${product.price.toLocaleString()}\n`;
    });
  }
  
  priceList += "\n\n✨ Delivery: Island-wide delivery, Cash on Delivery available\n";
  priceList += "💳 Payment: Cash, Card, Bank Transfer, Online\n";
  priceList += "🌐 Website: https://naturesvirtue.lk\n";
  priceList += "📞 WhatsApp: +94750912066\n\n";
  
  return priceList;
}

// ==========================================
// LANGUAGE DETECTION (Handles Mixed Languages)
// ==========================================

function detectLanguage(text) {
  const sinhalaPattern = /[\u0D80-\u0DFF]/;
  const tamilPattern = /[\u0B80-\u0BFF]/;
  
  const hasSinhala = sinhalaPattern.test(text);
  const hasTamil = tamilPattern.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  
  // Mixed language detection
  if (hasSinhala && hasEnglish) return 'sinhala'; // Prioritize Sinhala if mixed
  if (hasTamil && hasEnglish) return 'tamil'; // Prioritize Tamil if mixed
  if (hasSinhala) return 'sinhala';
  if (hasTamil) return 'tamil';
  return 'english';
}

// ==========================================
// INTENT DETECTION (Block off-topic questions)
// ==========================================

function isShopRelated(message) {
  const offTopicPatterns = [
    /what is \d+[\+\-\*\/]\d+/i,
    /calculate|solve|math|equation/i,
    /joke|funny|laugh|comedy/i,
    /president|minister|election|politics|government/i,
    /recipe|cooking|bake|how to cook/i,
    /weather|temperature|forecast|rain/i,
    /news|breaking|headline/i,
    /sport|football|cricket|game score|match/i,
    /movie|film|actor|actress|cinema/i,
    /tell me a story|once upon a time/i
  ];
  
  return !offTopicPatterns.some(pattern => pattern.test(message));
}

// ==========================================
// MULTILINGUAL RESPONSES (NO TRANSLATION OF NAMES)
// ==========================================

const OFF_TOPIC_RESPONSES = {
  english: "I can only help with Nature's Virtue products. What are you looking for today? 🌿",
  sinhala: "මට Nature's Virtue එකේ නිෂ්පාදන ගැන විතරයි උදව් කරන්න පුළුවන්. ඔබට ඕනේ මොනවද? 🌿",
  tamil: "என்னால் Nature's Virtue தயாரிப்புகள் பற்றி மட்டுமே உதவ முடியும். உங்களுக்கு என்ன வேண்டும்? 🌿"
};

const ERROR_MESSAGES = {
  english: "Sorry, something went wrong. Please WhatsApp us at +94750912066 or call us! 🙏",
  sinhala: "සමාවන්න, යම් ගැටළුවක් ඇති වුනා. කරුණාකර +94750912066 අමතන්න! 🙏",
  tamil: "மன்னிக்கவும், ஏதோ தவறு நடந்தது. தயவுசெய்து +94750912066 அழைக்கவும்! 🙏"
};

// ==========================================
// GROQ AI INTEGRATION (HUMAN-LIKE RESPONSES)
// ==========================================

async function getGroqResponse(message, language, conversationHistory) {
  const systemPrompt = `You are a friendly customer service person for Nature's Virtue - a natural products shop in Sri Lanka.

🏪 SHOP INFO:
- Name: Nature's Virtue (DON'T translate this!)
- Location: Habaraduwa, Galle, Sri Lanka
- Phone: +94750912066
- Email: info@naturesvirtue.lk
- Website: https://naturesvirtue.lk
- Hours: 24/7 Online
- Certified: ISO 22000:2018 & HACCP

${generatePriceList()}

🎯 YOUR JOB:
- Talk like a REAL human, not a robot
- Be warm, friendly, and helpful
- Answer questions about products and prices
- Help customers find what they need
- NO formal/robotic language
- Keep it SHORT and natural (like texting a friend)

🚫 IMPORTANT RULES:
1. NEVER translate product names! (Keep "Herali Cereal", "Detox Morning Tea" etc.)
2. NEVER translate "Nature's Virtue" - it stays as is
3. Only translate the conversation text, not brand names
4. If customer asks "herali කියන්නේ මොකක්ද", just say "Herali Cereal එක අපේ baby food product එකක්"
5. Mix languages naturally if customer does (e.g., "Herali Cereal එකේ මිල Rs. 1,250")

💬 LANGUAGE: Respond in ${language === 'sinhala' ? 'Sinhala' : language === 'tamil' ? 'Tamil' : 'English'}

📏 KEEP IT SHORT:
- 2-3 sentences max
- Don't list more than 5 items at once
- If long list needed, say "මේ තියෙන්නේ popular එවා" and show top 5

✅ EXAMPLES OF GOOD RESPONSES:

English: "Detox Morning Tea is Rs. 1,090! It's great for natural cleansing. Want to order? 😊"

Sinhala: "Herali Cereal එකේ flavors තුනක් තියෙනවා - Mango (Rs. 1,695), Soursop (Rs. 1,495), Banana (Rs. 1,250). කැමති එක කියන්න!"

Tamil: "Blue Lotus Flower Rs. 750 தான். இயற்கையான தேநீர். ஆர்டர் செய்யலாமா?"

❌ DON'T DO THIS:
- "මම ඔබට උදව් කිරීමට සතුටු වෙමි" (too formal!)
- "I would be delighted to assist you" (too robotic!)
- "Herali මිශ්‍රණය" (DON'T translate product names!)

Be natural, be human, be helpful! 🌿`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: message }
  ];

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: messages,
    temperature: 0.9, // More natural/varied responses
    max_tokens: 300, // Increased slightly for better responses
    top_p: 0.95
  });

  return completion.choices[0].message.content;
}

// ==========================================
// MESSAGE SPLITTING (Handle WhatsApp limits)
// ==========================================

function splitMessage(text, maxLength = WHATSAPP_MESSAGE_LIMIT) {
  if (text.length <= maxLength) {
    return [text];
  }

  const messages = [];
  let currentMessage = '';
  
  // Split by sentences first
  const sentences = text.split(/(?<=[.!?।।]\s)/);
  
  for (const sentence of sentences) {
    if ((currentMessage + sentence).length <= maxLength) {
      currentMessage += sentence;
    } else {
      if (currentMessage) {
        messages.push(currentMessage.trim());
      }
      currentMessage = sentence;
    }
  }
  
  if (currentMessage) {
    messages.push(currentMessage.trim());
  }
  
  return messages;
}

// ==========================================
// CONVERSATION MANAGEMENT
// ==========================================

function getConversation(phoneNumber) {
  if (!conversations.has(phoneNumber)) {
    conversations.set(phoneNumber, {
      messages: [],
      language: 'english',
      startTime: new Date()
    });
  }
  return conversations.get(phoneNumber);
}

function addToConversation(phoneNumber, role, content) {
  const conversation = getConversation(phoneNumber);
  conversation.messages.push({ role, content });
  
  // Keep only last MAX_MESSAGES messages
  if (conversation.messages.length > MAX_MESSAGES) {
    conversation.messages = conversation.messages.slice(-MAX_MESSAGES);
  }
}

// ==========================================
// WHATSAPP MESSAGE SENDING (With splitting)
// ==========================================

async function sendWhatsAppMessage(to, message) {
  const url = `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`;
  
  // Split message if too long
  const messages = splitMessage(message);
  
  for (let i = 0; i < messages.length; i++) {
    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: {
        preview_url: false,
        body: messages[i]
      }
    };

    try {
      await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Message ${i + 1}/${messages.length} sent successfully`);
      
      // Small delay between messages to avoid rate limits
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`❌ WhatsApp Send Error (Message ${i + 1}):`, error.response?.data || error.message);
      throw error;
    }
  }
}

// ==========================================
// WEBHOOK ENDPOINTS
// ==========================================

// Webhook verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed!');
    res.sendStatus(403);
  }
});

// Webhook to receive messages (POST)
app.post('/webhook', async (req, res) => {
  console.log('📨 ===== WEBHOOK RECEIVED =====');
  console.log(JSON.stringify(req.body, null, 2));
  
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log('⚠️  No message found in webhook');
      return;
    }

    const from = message.from;
    const messageType = message.type;
    const messageTime = new Date(parseInt(message.timestamp) * 1000);

    console.log('\n📱 NEW MESSAGE');
    console.log(`From: ${from}`);
    console.log(`Type: ${messageType}`);
    console.log(`Time: ${messageTime.toLocaleString()}`);

    // Handle different message types
    if (messageType !== 'text') {
      const lang = getConversation(from).language;
      const unsupportedMessage = {
        english: "I can only read text messages. Please send your question as text! 😊",
        sinhala: "මට text messages විතරයි කියවන්න පුළුවන්. කරුණාකර text එකක් යවන්න! 😊",
        tamil: "என்னால் text messages மட்டுமே படிக்க முடியும். தயவுசெய்து text அனுப்பவும்! 😊"
      };
      await sendWhatsAppMessage(from, unsupportedMessage[lang]);
      return;
    }

    const userMessage = message.text.body.trim();
    console.log(`Message: ${userMessage}`);
    
    // Detect language (handles mixed languages)
    const language = detectLanguage(userMessage);
    console.log(`🌐 Detected Language: ${language}`);
    
    // Update conversation language
    const conversation = getConversation(from);
    conversation.language = language;

    // Check if message is shop-related
    const shopRelated = isShopRelated(userMessage);
    console.log(`🎯 Intent: ${shopRelated ? 'shop_related' : 'off_topic'}`);

    if (!shopRelated) {
      await sendWhatsAppMessage(from, OFF_TOPIC_RESPONSES[language]);
      return;
    }

    // Get AI response from Groq
    const aiResponse = await getGroqResponse(userMessage, language, conversation.messages);
    console.log(`🤖 Groq Response: ${aiResponse}`);

    // Update conversation history
    addToConversation(from, 'user', userMessage);
    addToConversation(from, 'assistant', aiResponse);

    // Send response to user (will auto-split if too long)
    await sendWhatsAppMessage(from, aiResponse);

  } catch (error) {
    console.error('❌ Webhook Processing Error:', error);
    try {
      const lang = getConversation(message?.from)?.language || 'english';
      await sendWhatsAppMessage(message?.from, ERROR_MESSAGES[lang]);
    } catch (err) {
      console.error('Failed to send error message:', err);
    }
  }
});

// ==========================================
// STATUS & MONITORING ENDPOINTS
// ==========================================

// Root endpoint - Status dashboard
app.get('/', (req, res) => {
  const uptime = Math.floor((new Date() - serverStartTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;
  
  const totalProducts = Object.values(PRODUCT_CATALOG).reduce((sum, products) => sum + products.length, 0);
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Nature's Virtue WhatsApp Bot</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f0f9f0; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2d7a2d; margin-bottom: 10px; }
        .status { background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff; }
        .stat { display: inline-block; margin: 10px 20px 10px 0; }
        .stat strong { color: #2d7a2d; }
        a { color: #2d7a2d; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .emoji { font-size: 1.2em; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1><span class="emoji">🌿</span> Nature's Virtue WhatsApp AI Bot</h1>
        <p>Premium Natural Products | ISO 22000:2018 & HACCP Certified</p>
        
        <div class="status">
          <strong>✅ Bot Status:</strong> Running<br>
          <strong>⏰ Uptime:</strong> ${hours}h ${minutes}m ${seconds}s<br>
          <strong>🚀 Started:</strong> ${serverStartTime.toLocaleString()}
        </div>
        
        <div class="info">
          <div class="stat"><strong>📦 Total Products:</strong> ${totalProducts}</div>
          <div class="stat"><strong>💬 Active Chats:</strong> ${conversations.size}</div>
          <div class="stat"><strong>🌍 Languages:</strong> English, සිංහල, தமிழ்</div>
          <div class="stat"><strong>🤖 AI Model:</strong> Groq (llama-3.3-70b)</div>
          <div class="stat"><strong>📏 Message Limit:</strong> ${WHATSAPP_MESSAGE_LIMIT} chars</div>
        </div>
        
        <h3>📋 Product Categories:</h3>
        <ul>
          ${Object.entries(PRODUCT_CATALOG).map(([cat, products]) => 
            `<li><strong>${cat}:</strong> ${products.length} products</li>`
          ).join('')}
        </ul>
        
        <h3>🔗 Quick Links:</h3>
        <ul>
          <li><a href="/health">Health Check</a></li>
          <li><a href="/conversations">View Active Conversations</a></li>
          <li><a href="https://naturesvirtue.lk" target="_blank">Visit Website</a></li>
        </ul>
        
        <h3>📞 Contact:</h3>
        <ul>
          <li><strong>WhatsApp:</strong> +94750912066</li>
          <li><strong>Email:</strong> info@naturesvirtue.lk</li>
          <li><strong>Location:</strong> Habaraduwa, Galle, Sri Lanka</li>
        </ul>
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor((new Date() - serverStartTime) / 1000),
    timestamp: new Date().toISOString(),
    activeConversations: conversations.size,
    totalProducts: Object.values(PRODUCT_CATALOG).reduce((sum, products) => sum + products.length, 0),
    messageLimit: WHATSAPP_MESSAGE_LIMIT,
    groqConfigured: !!process.env.GROQ_API_KEY,
    whatsappConfigured: !!process.env.WHATSAPP_TOKEN
  });
});

// View conversations endpoint
app.get('/conversations', (req, res) => {
  const convData = [];
  conversations.forEach((conv, phone) => {
    convData.push({
      phone,
      language: conv.language,
      messageCount: conv.messages.length,
      startTime: conv.startTime,
      lastMessage: conv.messages[conv.messages.length - 1]
    });
  });
  
  res.json({
    total: conversations.size,
    conversations: convData
  });
});

// Clear specific conversation
app.delete('/conversations/:phone', (req, res) => {
  const phone = req.params.phone;
  if (conversations.has(phone)) {
    conversations.delete(phone);
    res.json({ success: true, message: `Conversation with ${phone} cleared` });
  } else {
    res.status(404).json({ success: false, message: 'Conversation not found' });
  }
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('\n🚀 ========================================');
  console.log('✅ Nature\'s Virtue WhatsApp AI Bot Started!');
  console.log('========================================');
  console.log(`📍 Shop: Nature's Virtue`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`📦 Total Products: ${Object.values(PRODUCT_CATALOG).reduce((sum, products) => sum + products.length, 0)}`);
  console.log(`💰 All Prices: LOADED`);
  console.log(`📏 Message Limit: ${WHATSAPP_MESSAGE_LIMIT} characters`);
  console.log(`🌍 Mixed Languages: SUPPORTED`);
  console.log(`✨ Bot is ready to receive messages!`);
  console.log(`💬 Waiting for WhatsApp messages...`);
  console.log('========================================\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});