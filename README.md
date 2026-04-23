# Vedalaya (MERN)

AI-assisted online learning platform with **teacher/student roles**, **JWT auth**, **quizzes**, **results**, and **flashcards**.

## Tech
- **Frontend**: React (Vite) + React Router + Tailwind
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **Auth**: JWT (Bearer token)

## Project structure
- `backend/` Express API
- `frontend/` React app

## Setup

### 1) MongoDB
Use either:
- **Local MongoDB**: make sure it’s running on `mongodb://127.0.0.1:27017`
- **MongoDB Atlas**: use your Atlas connection string

### 2) Backend env
Copy the example file and edit it:
- `backend/.env.example` → `backend/.env`

Minimum required:
- `MONGODB_URI`
- `JWT_SECRET` (16+ chars)

### 3) Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 4) Run (two terminals)

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Open the app at `http://localhost:5173`.

## API quick reference
- Auth: `POST /api/register`, `POST /api/login`, `GET /api/auth/me`
- Quizzes: `GET /api/quizzes`, `POST /api/quizzes`, `PUT /api/quizzes/:id`
- Attempts: `POST /api/attempts/submit`, `GET /api/attempts/me`
- Lectures: `POST /api/lectures` (multipart), `GET /api/lectures`, `GET /api/lectures/:id/download`
- Doubt AI: `POST /api/doubts/ask`, `GET /api/doubts/history`
- Training data: `POST /api/training/examples`, `GET /api/training/examples`, `POST /api/training/examples/from-doubt/:id`
- Generators: `POST /api/generate/quiz`, `POST /api/generate/flashcards`
- Flashcards: `POST /api/flashcards/sets`, `GET /api/flashcards/sets/me`

See `backend/TRAINING.md` for your custom model fine-tuning workflow.

