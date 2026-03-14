# 📧 Email Outreach Tool

Send personalized recruiter emails with a Next.js frontend and an external Node.js scheduling backend.  
Built with **Next.js 14 · Tailwind CSS · Express · Nodemailer · MongoDB Atlas**.

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Create `.env.local` and fill it in:
```bash
EMAIL_USER=your.gmail@gmail.com
EMAIL_PASS=your_16_char_app_password
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
BACKEND_PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority&appName=email-outreach
MONGODB_DB_NAME=email_outreach
```

> **Gmail App Password** (required — not your normal password):
> 1. Enable **2-Step Verification** on your Google account.
> 2. Visit https://myaccount.google.com/apppasswords
> 3. Generate a new App Password for **"Mail"**.
> 4. Paste the 16-character code as `EMAIL_PASS` (no spaces).

### 3. Run frontend + backend
```bash
npm run dev
```

This starts:
- Next.js frontend on `http://localhost:3000`
- Scheduler backend on `http://localhost:4000`

If `MONGODB_URI` is configured, scheduled jobs are stored in MongoDB Atlas and reloaded when the backend restarts.
If `MONGODB_URI` is empty, the backend falls back to in-memory storage.

For Render free hosting: an internal cron inside the same service cannot reliably prevent sleep, because it stops when the service sleeps. This repo includes an external GitHub Actions cron in [.github/workflows/render-keep-alive.yml](.github/workflows/render-keep-alive.yml) that pings the backend every 10 minutes.

Set a GitHub Actions secret named `RENDER_KEEP_ALIVE_URL` to:

```bash
https://your-render-service.onrender.com/api/keep-alive
```

---

## Features

| Feature | Details |
|---|---|
| **Single Email** | Send now or schedule on the backend |
| **Bulk CSV** | Upload CSV and schedule a backend campaign with a configurable interval |
| **Smart Template** | Auto-adapts when org/role are missing |
| **Subject personalisation** | Uses the exact role when present, otherwise asks for SDE / Full Stack / Frontend / Backend roles |
| **Scheduler jobs** | Polls backend job status and progress |
| **Mongo-backed recovery** | Scheduled jobs reload from MongoDB Atlas after backend restart |
| **Keep-alive endpoint** | External cron can ping Render to reduce sleep risk |
| **Email preview** | See the exact email before sending or scheduling |
| **Download sample CSV** | One-click to get a properly formatted template |

---

## CSV Format

```csv
name,email,org,role
Sneha Maam,sneha@company.com,TechCorp,SDE Intern
Rahul,rahul@startup.com,StartupX,
Hiring Team,hr@company.com,,
```

`org` and `role` columns are optional — leave them blank and the template adjusts automatically.

---

## How the template adapts

| Fields provided | Result |
|---|---|
| name + org + role | Fully personalised |
| name + org | Role line removed |
| name only | Generic opportunity inquiry |
| email only | "Dear Hiring Team," + generic text |

Subject line also changes:
- With role → `Application for SDE Intern - Adarsh Tiwari`
- Without role → `Application for SDE / Full Stack / Frontend / Backend Roles - Adarsh Tiwari`

Body highlights now include:
- Knight badge on LeetCode
- 600+ problems solved
- Internships at Opernova LLP, T Mouse and Cheese Design Studio, and Agile Growth Tech

---

## Project Structure

```
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                   # Main UI (single + bulk scheduling)
├── backend/
│   ├── emailTemplate.js           # Backend template helpers
│   ├── jobStore.js                # MongoDB / fallback store helpers
│   └── server.js                  # Express scheduler backend
├── .github/workflows/
│   └── render-keep-alive.yml      # External cron ping for Render
├── lib/
│   ├── emailTemplate.ts           # Frontend preview template helpers
│   └── mailer.ts                  # Legacy Next mailer helper
├── .env.local.example
└── ...config files
```
