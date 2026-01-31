// test-key.js
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function checkConnection() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("❌ No API Key found in .env");
    return;
  }

  console.log(`🔑 Testing Key: ${apiKey.substring(0, 8)}...`);
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // 1. Try to simply list available models
    // This checks if the key has permission to view the Generative Language API
    console.log("📡 Connecting to Google servers...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // 2. Try a simple generation
    console.log("⚡️ Attempting to generate text...");
    const result = await model.generateContent("Hello, are you working?");
    const response = await result.response;
    const text = response.text();
    
    console.log("\n✅ SUCCESS! The API is working.");
    console.log(`🤖 Bot Replied: "${text}"`);
    
  } catch (error) {
    console.error("\n❌ TEST FAILED");
    console.error("Error Message:", error.message);
    
    if (error.message.includes("404")) {
      console.log("\n💡 DIAGNOSIS: The API Key is valid, but the 'Generative Language API' is not enabled for this project.");
      console.log("👉 SOLUTION: Go to https://aistudio.google.com/app/apikey and create a key in a NEW project.");
    }
  }
}

checkConnection();