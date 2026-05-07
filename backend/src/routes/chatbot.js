import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../utils/env.js";

const router = express.Router();

// Simple in-memory cache to reduce API calls (works in production)
const responseCache = new Map();
const CACHE_TTL = 3600000; // 1 hour
const MAX_CACHE_SIZE = 500; // Increased cache size

// Rate limiting per user (prevents abuse)
const userRequestCount = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 15; // Increased slightly

function getCacheKey(message) {
  return message.toLowerCase().trim().slice(0, 200);
}

function checkRateLimit(userId) {
  const now = Date.now();
  const userKey = userId || 'anonymous';
  
  if (!userRequestCount.has(userKey)) {
    userRequestCount.set(userKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  const userData = userRequestCount.get(userKey);
  if (now > userData.resetAt) {
    userData.count = 1;
    userData.resetAt = now + RATE_LIMIT_WINDOW;
    return true;
  }
  
  if (userData.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  userData.count++;
  return true;
}

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      responseCache.delete(key);
    }
  }
}, 600000); // Clean every 10 minutes

function getLocalFallbackReply(message) {
  const userMessage = String(message || "").toLowerCase();

  // Platform navigation
  if (userMessage.includes("hello") || userMessage.includes("hi") || userMessage.includes("hey")) {
    return "Hello! I am Vedalaya AI Assistant. How can I help you today? You can ask me about login, quizzes, lectures, attendance, or any study-related questions.";
  }
  if (userMessage.includes("login") || userMessage.includes("log in") || userMessage.includes("sign in")) {
    return "To login, click Login on the homepage, enter your email and password, then continue to your dashboard.";
  }
  if (userMessage.includes("register") || userMessage.includes("signup") || userMessage.includes("sign up") || userMessage.includes("create account")) {
    return "To create an account, click Register on the homepage and fill in your name, email, role (student/teacher), and password.";
  }
  if (userMessage.includes("quiz")) {
    return "Students can open the Quizzes section, choose a quiz, and submit answers before time runs out. Teachers can create quizzes and view student performance.";
  }
  if (userMessage.includes("lecture") || userMessage.includes("video") || userMessage.includes("lesson")) {
    return "Students can open Lectures to watch videos, listen to audio lessons, and download study files. Teachers can upload new lectures.";
  }
  if (userMessage.includes("attendance")) {
    return "Attendance can be tracked from the Attendance page where teachers manage records and students view their attendance summaries.";
  }
  if (userMessage.includes("flashcard")) {
    return "Flashcards help you memorize important concepts. You can create flashcard sets or generate them automatically from your study materials.";
  }
  if (userMessage.includes("scholarship")) {
    return "Check the Scholarships section to explore available scholarships and financial aid opportunities for students.";
  }
  if (userMessage.includes("password") || userMessage.includes("forgot")) {
    return "If you forgot your password, use the 'Forgot Password' link on the login page to reset it via email.";
  }
  if (userMessage.includes("teacher") || userMessage.includes("instructor")) {
    return "Teachers can upload lectures, create quizzes, track student attendance, and analyze student performance from their dashboard.";
  }
  if (userMessage.includes("student")) {
    return "Students can attend lectures, take quizzes, create flashcards, track attendance, and explore scholarships from their dashboard.";
  }

  // Study help
  if (userMessage.includes("study") || userMessage.includes("learn")) {
    return "To study effectively: 1) Watch lectures regularly, 2) Take quizzes to test yourself, 3) Use flashcards for memorization, 4) Review your mistakes, and 5) Ask questions when stuck.";
  }
  if (userMessage.includes("math") || userMessage.includes("mathematics")) {
    return "For math: Practice regularly, understand concepts before memorizing formulas, solve many problems, and review your mistakes. Check the Lectures section for math lessons.";
  }
  if (userMessage.includes("science")) {
    return "For science: Understand concepts through experiments and examples, make notes, use diagrams, and practice questions. Check Lectures for science topics.";
  }

  // Generic helpful response
  return "I'm here to help! You can ask me about:\n• Login and registration\n• Taking quizzes and viewing results\n• Watching lectures\n• Creating flashcards\n• Tracking attendance\n• Scholarships\n• Study tips\n\nWhat would you like to know?";
}

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user?.sub || req.ip;

    if (!message || message.trim() === "") {
      return res.json({ reply: "Please enter a valid question." });
    }

    // Check rate limit
    if (!checkRateLimit(userId)) {
      return res.status(429).json({
        reply: "You're asking too many questions too quickly. Please wait a moment and try again.",
      });
    }

    const userMessage = message.toLowerCase();

    // Quick responses for common questions (no API needed - saves quota)
    const commonResponses = {
      'hello': "Hello! I am Vedalaya AI Assistant. How can I help you today?",
      'hi': "Hi there! I'm here to help with your learning. What would you like to know?",
      'login': "To login, click on the Login button on the homepage and enter your email and password.",
      'register': "To create an account, click on Register and fill in your details (name, email, role, password).",
      'signup': "To create an account, click on Register and fill in your details (name, email, role, password).",
      'quiz': "Students can take quizzes from the Quizzes section. Teachers can create and manage quizzes.",
      'lecture': "Access lectures from the Lectures section. Teachers can upload videos, audio, and documents.",
      'attendance': "Track attendance from the Attendance page. Teachers manage records, students view their attendance.",
      'flashcard': "Create flashcard sets to memorize concepts. You can generate them automatically from text.",
      'scholarship': "Explore scholarships and financial aid in the Scholarships section.",
    };

    for (const [keyword, response] of Object.entries(commonResponses)) {
      if (userMessage.includes(keyword)) {
        return res.json({ reply: response, source: 'instant' });
      }
    }

    // Check cache (reduces API calls significantly)
    const cacheKey = getCacheKey(message);
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({ reply: cached.reply, source: 'cached' });
    }

    // Use Gemini with lighter model (gemini-1.5-flash-8b is 50% cheaper than gemini-1.5-flash)
    if (!env.GEMINI_API_KEY) {
      return res.json({ 
        reply: getLocalFallbackReply(message),
        source: 'fallback'
      });
    }

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-8b", // Cheaper model
      generationConfig: {
        maxOutputTokens: 300, // Limit response length to save quota
        temperature: 0.7,
      }
    });
    
    // Shorter, more efficient prompt
    const prompt = `You are Vedalaya AI Assistant for an online education platform.

Platform features:
- Students: attend lectures, take quizzes, use flashcards, track attendance
- Teachers: upload lectures, create quizzes, manage students

Answer in SIMPLE, SHORT English (max 3-4 sentences). Be helpful and friendly.

Question: ${message}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const reply = response.text();

    // Cache the response (reduces future API calls)
    if (responseCache.size >= MAX_CACHE_SIZE) {
      const firstKey = responseCache.keys().next().value;
      responseCache.delete(firstKey);
    }
    responseCache.set(cacheKey, { reply, timestamp: Date.now() });

    res.json({ reply, source: 'gemini' });

  } catch (error) {
    const status = Number(error?.status || error?.response?.status || 500);
    const isQuotaError =
      status === 429 ||
      /quota|rate limit|too many requests/i.test(
        `${error?.message || ""} ${JSON.stringify(error?.errorDetails || "")}`,
      );

    if (isQuotaError) {
      console.log("Gemini quota exceeded, using fallback");
      return res.status(200).json({
        reply: getLocalFallbackReply(req.body?.message),
        source: 'fallback'
      });
    }

    console.error("Chatbot Error:", error.message);
    res.status(500).json({
      reply: "Sorry, I am facing technical issues right now. Please try again in a moment.",
    });
  }
});

export default router;