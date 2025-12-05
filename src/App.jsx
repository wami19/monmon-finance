// src/App.jsx - UPDATED VERSION
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container, Typography, Box, AppBar, Toolbar, CssBaseline } from '@mui/material';
import { AccountBalanceWallet } from '@mui/icons-material';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import MoneyInForm from './components/MoneyInForm';
import MoneyOutForm from './components/MoneyOutForm';
import BankAccountForm from './components/BankAccountForm';
import BankAccountList from './components/BankAccountList';
import DebtList from './components/DebtList';
import DebtForm from './components/DebtForm';
import TransactionList from './components/TransactionList';
import monMonLogo from './assets/MonMon-logo-v2.png';
import './App.css';

function App() {
  return (
    <Router>
      <CssBaseline />
      
      <div className="App">
        {/* Header */}
        <AppBar position="static" sx={{ mb: 4 }}>
          <Toolbar>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              mr: 2,
              p: 0.5,
              borderRadius: 1
            }}>
              <img 
                src={monMonLogo}
                alt="MonMon Logo" 
                style={{ 
                  width: '50px', 
                  height: 'auto',
                  marginRight: '8px'
                }}
              />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" component="div" sx={{ color: '#ffffff', fontWeight: 600 }}>
                MonMon: Your Money Monitoring Web App
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', display: 'block' }}>
                Track • Monitor • Master Your Finances
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              A CCS 631 Final Project
            </Typography>
          </Toolbar>
        </AppBar>
        
        {/* Routes - UPDATED WITH MISSING ROUTES */}
        <Container sx={{ mt: 4, mb: 8 }}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/money-in" element={<MoneyInForm />} />
            <Route path="/money-out" element={<MoneyOutForm />} />
            <Route path="/add-bank-account" element={<BankAccountForm />} />
            <Route path="/edit-bank-account/:accountId" element={<BankAccountForm />} /> {/* ADDED */}
            <Route path="/bank-accounts" element={<BankAccountList />} />
            <Route path="/debts" element={<DebtList />} />
            <Route path="/add-debt" element={<DebtForm />} />
            <Route path="/edit-debt/:debtId" element={<DebtForm />} />
            <Route path="/transactions" element={<TransactionList />} />
            {/* Add more routes here as needed */}
          </Routes>
        </Container>
        
        {/* Footer */}
        <Box sx={{ 
          py: 3, 
          bgcolor: 'grey.100', 
          textAlign: 'center',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0
        }}>
          <Typography variant="body2" color="text.secondary">
            © 2025 William Evan Mancao. All Rights Reserved. | Built with Vite + React + Firebase
          </Typography>
        </Box>
      </div>
    </Router>
  );
}

export default App;