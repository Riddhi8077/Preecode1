# preecode – Web Dashboard

> Part of the **preecode** coding practice ecosystem.
> 
> ✨ Updated UI with improved user experience

## What is preecode?

preecode is a coding practice ecosystem built around three parts:

| Part | Description |
|------|-------------|
| VS Code Extension | Users solve coding questions directly inside VS Code |
| Backend Server | Stores user submissions and progress |
| **Web Dashboard** | Shows user analytics and progress *(this repo)* |

This repository is **only for the Web Dashboard (frontend UI)**.

---

## Current Status (MVP)

- No backend integration
- Uses dummy static data
- Basic UI layout only
- No complex features (no leaderboard, no advanced analytics)

---

## Features

### Login Page
- Email and password fields
- Login button
- Demo credentials provided on screen

### Dashboard Page
- **Stats overview:**
  - Total Questions Solved
  - Easy / Medium / Hard breakdown
  - Average Time Taken
- **Recent Submissions table:**
  - Question Name
  - Difficulty (color-coded badge)
  - Time Taken
  - Date
- **Navigation bar:** Dashboard link, Logout button

---

## Tech Stack

- HTML
- CSS (custom, no frameworks)
- Vanilla JavaScript

---

## Getting Started

No build step required. Just open in a browser:

```
index.html   →  Login page
dashboard.html  →  Dashboard (after login)
```

**Demo credentials:**
```
Email:    user@preecode.io
Password: password123
```

---

## Project Structure

```
preecode-Ui/
├── index.html       # Login page
├── dashboard.html   # Dashboard page
├── styles.css       # All styles
├── app.js           # Login logic + dummy data
└── README.md
```

---

## Design Principles

- Clean, minimal, professional dark UI
- Responsive layout (desktop + mobile)
- No unnecessary complexity
