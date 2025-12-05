# MonMon - Money Monitoring App
### MIT CCS 631 Final Project

## 🚀 Live Demo
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=for-the-badge&logo=vercel)](YOUR-VERCEL-URL-HERE)

**Live Application**: [monmon-app.vercel.app](YOUR-VERCEL-URL-HERE)

## 📋 Features
- **User Authentication**: Secure signup/login with Firebase Auth
- **Bank Account Management**: Track cash, bank accounts, e-wallets
- **Transaction Tracking**: Record money in/out with categories
- **Debt Management**: Create loans, track payments, view progress
- **Real-time Dashboard**: Financial overview with monthly summaries
- **Transaction History**: View all transactions with filters
- **Responsive Design**: Mobile-friendly Material-UI interface

## 🏗️ Tech Stack
- **Frontend**: React 18 + Vite + Material-UI
- **Backend**: Firebase Authentication + Firestore
- **Hosting**: Vercel
- **Database**: Cloud Firestore (NoSQL)
- **Styling**: Material-UI with custom theme

## 🎯 Project Structure

monmon-app/
├── src/
│ ├── components/ # React components
│ │ ├── Dashboard.jsx
│ │ ├── Login.jsx
│ │ ├── Signup.jsx
│ │ ├── MoneyInForm.jsx
│ │ ├── MoneyOutForm.jsx
│ │ ├── BankAccountForm.jsx
│ │ ├── BankAccountList.jsx
│ │ ├── DebtForm.jsx
│ │ └── DebtList.jsx
│ ├── firebase.js # Firebase configuration
│ ├── theme.js # Material-UI theme
│ ├── App.jsx # Main app component
│ └── main.jsx # Entry point
├── public/ # Static assets
└── package.json # Dependencies

## 📊 Database Schema
The application uses 7 Firestore collections matching the ERD design:
1. **users** - User profiles
2. **bank_accounts** - Financial accounts (with isCash flag)
3. **transactions** - All money movements
4. **money_in** - Income transactions
5. **money_out** - Expense transactions  
6. **debts** - Debt records
7. **bank_account_updates** - Audit trail

## 🚀 Local Development
# 1. Clone repository
git clone https://github.com/YOUR-USERNAME/monmon-app.git
cd monmon-app

# 2. Install dependencies
npm install

# 3. Set up Firebase
# Create a Firebase project at firebase.google.com
# Copy your config to src/firebase.js

# 4. Run development server
npm run dev

# 5. Open http://localhost:5173

📝 Firebase Setup
Create a Firebase project at Firebase Console

Enable Authentication (Email/Password)

Create Firestore Database

Copy configuration to src/firebase.js

Set Firestore security rules (provided in documentation)

🎓 Academic Context
This project was developed for MIT CCS 631: Web Information Systems as a final project demonstrating:

Full-stack web development with React + Firebase

Database design and implementation

Real-time data synchronization

User authentication and authorization

Responsive UI/UX design

📄 License
MIT License - see LICENSE file for details

👤 Author
William Evan P. Mancao
CIT-U MIT CCS 631 Student
GitHub Profile

-----

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
