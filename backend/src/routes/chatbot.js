import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    // ✅ Basic validation
    if (!message || message.trim() === "") {
      return res.json({ reply: "Please enter a valid question." });
    }

    const userMessage = message.toLowerCase();

    // ✅ Quick local responses (faster than API)
    if (userMessage.includes("hello") || userMessage.includes("hi")) {
      return res.json({
        reply: "Hello! I am Vedalaya AI Assistant. How can I help you today?",
      });
    }

    if (userMessage.includes("login")) {
      return res.json({
        reply:
          "To login, click on the Login button on the homepage and enter your email and password.",
      });
    }

    if (userMessage.includes("register") || userMessage.includes("signup")) {
      return res.json({
        reply:
          "To create an account, click on Register and fill in your details.",
      });
    }

    // ✅ Main Gemini API call
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
You are "Vedalaya AI Assistant", a smart and friendly chatbot for a remote classroom platform built for rural students.

=======================
PLATFORM DETAILS
=======================
Vedalaya is an online education system.

STUDENT FEATURES:
- Attend lectures
- Attempt quizzes
- View results
- Use flashcards
- Track attendance
- Explore scholarships

TEACHER FEATURES:
- Upload lectures
- Create quizzes
- Analyze performance
- Manage students
- Track attendance

=======================
YOUR BEHAVIOR
=======================
- Always answer in SIMPLE English
- Keep answers SHORT and CLEAR
- Be polite and helpful
- Teach like a friendly teacher
- Use examples when explaining concepts
- If user uses Hindi, reply in Hindi or Hinglish

=======================
SPECIAL RULES
=======================
- For login/help questions → give step-by-step instructions
- For study questions → explain clearly
- For unclear questions → ask user to clarify
- Do NOT give unrelated answers

=======================
USER QUESTION
=======================
${message}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const reply = response.text();

    res.json({ reply });

  } catch (error) {
    console.error("Gemini Error:", error.message);

    res.status(500).json({
      reply: "Sorry, I am facing technical issues right now. Please try again later.",
    });
  }
});

export default router;