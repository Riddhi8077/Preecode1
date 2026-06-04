# Preecode

AI-powered coding practice and skill-building platform directly inside VS Code.

> 🚀 Now powered by OpenRouter API for enhanced AI capabilities

Preecode helps developers practice consistently, review code with AI assistance, and improve problem-solving skills without leaving their editor. It combines coding workflows, guidance, and progress-oriented tooling in one extension.

Website: https://preecode.vercel.app

---

# Overview

Preecode is built to help developers learn and practice coding while staying inside their development environment.

Instead of switching between platforms, Preecode integrates practice, debugging assistance, code explanations, and AI-powered review directly into VS Code.

The project consists of three main parts:

• VS Code Extension
• Backend API Server
• Frontend Website

These components work together to provide authentication, AI services, progress tracking, and the user interface.

---

# Features

• AI-assisted coding practice directly in VS Code
• Quick debugging and code explanation tools
• AI code review assistance
• Integrated login system connected with the Preecode platform
• Control Center inside VS Code for focused workflow
• Backend integration for user data and progress
• Configurable backend and frontend URLs for development and production

---

# Project Structure

```
Preecode
│
├ preecode-backend        → Node.js backend API
├ preecode-frontend       → Web platform frontend
├ preecode-extension      → VS Code extension
└ .vscode                 → Workspace configuration
```

---

# Installation

## Install Extension from VS Code Marketplace

1. Open VS Code
2. Open Extensions panel
3. Search for **Preecode**
4. Click Install

---

## Install Manually Using VSIX

If installing manually:

```
code --install-extension preecode-0.0.1.vsix
```

---

# Usage

1. Open VS Code
2. Open Command Palette

```
Ctrl + Shift + P
```

3. Run:

```
Preecode: Open Control Center
```

4. Login using:

```
Preecode: Login
```

5. Start practicing, debugging, and reviewing code.

---

# Available Commands

• Preecode: Open Control Center
• Preecode: Login
• Preecode: Logout
• Preecode: Practice
• Preecode: Debug Selection
• Preecode: Explain Selection
• Preecode: Review Code

---

# Local Development Setup

To run the project locally you need to start backend, frontend, and extension.

---

## 1 Clone the Repository

```
git clone https://github.com/Prashantpd7/Preecode.git
cd Preecode
```

---

## 2 Install Dependencies

Backend

```
cd preecode-backend
npm install
```

Frontend

```
cd ../preecode-frontend
npm install
```

Extension

```
cd ../preecode-extension
npm install
```

---

## 3 Setup Environment Variables

Inside backend folder:

```
cd preecode-backend
```

Create environment file:

```
cp .env.example .env
```

Fill required variables.

Example:

```
PORT=5001
MONGO_URI=mongodb://localhost:27017/preecode
JWT_SECRET=random_secret
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5001
NODE_ENV=development
GOOGLE_CLIENT_ID=test
GOOGLE_CLIENT_SECRET=test
```

Important rules:

• Never commit `.env`
• Always use environment variables
• Never hardcode API keys or URLs

---

## 4 Run Backend

```
cd preecode-backend
npm run dev
```

Backend runs on:

```
http://localhost:5001
```

---

## 5 Run Frontend

```
cd preecode-frontend
npm run dev
```

Frontend runs on:

```
http://localhost:5173
```

---

## 6 Run Extension

Open the extension folder in VS Code.

Press **F5** to launch Extension Development Host.

This will open a new VS Code window where the extension can be tested.

---

# Contributing

Contributions are welcome.

Please follow these steps.

---

## 1 Create a Feature Branch

Never work directly on main.

```
git checkout -b feature/your-feature-name
```

---

## 2 Implement Changes

Work inside:

```
preecode-backend
preecode-frontend
preecode-extension
```

Important rules:

• Do not hardcode API keys
• Do not commit `.env`
• Always use environment variables
• Keep changes small and focused

---

## 3 Test Locally

Before pushing ensure:

• Backend works
• Frontend loads correctly
• Extension commands work
• No console errors appear

---

## 4 Commit Changes

```
git add .
git commit -m "Add feature: description"
```

---

## 5 Push Branch

```
git push origin feature/your-feature-name
```

---

## 6 Open Pull Request

Create a PR to the **main** branch.

Include:

• Clear title
• Description of feature
• Testing notes

---

# Contribution Rules

• Never commit `.env`
• Never push secrets or API keys
• Never hardcode URLs
• Always use environment variables
• Always create a branch before coding
• Always test locally before pushing

---

# License

MIT License
