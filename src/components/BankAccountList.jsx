// src/components/BankAccountList.jsx - COMPLETE FIXED VERSION
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  Container, 
  Typography, 
  Box, 
  Grid, 
  Card, 
  CardContent,
  Button,
  Paper,
  Divider,
  IconButton,
  Chip,
  CircularProgress,
  Alert // ADDED THIS IMPORT
} from '@mui/material';
import { 
  ArrowBack,
  AccountBalanceWallet,
  AttachMoney,
  AccountBalance,
  Business,
  Edit,
  Delete,
  Add
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';

function BankAccountList() {
  const navigate = useNavigate();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const fetchBankAccounts = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }

      const accountsQuery = query(
        collection(db, 'bank_accounts'),
        where('userId', '==', user.uid)
      );
      const querySnapshot = await getDocs(accountsQuery);
      
      const accounts = [];
      querySnapshot.forEach((doc) => {
        accounts.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort: Cash first, then by balance (highest to lowest)
      accounts.sort((a, b) => {
        if (a.isCash && !b.isCash) return -1;
        if (!a.isCash && b.isCash) return 1;
        return (b.balance || 0) - (a.balance || 0);
      });
      
      setBankAccounts(accounts);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      setError('Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm('Are you sure you want to delete this account?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'bank_accounts', accountId));
      // Refresh list
      fetchBankAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      setError('Failed to delete account');
    }
  };

  const getAccountTypeColor = (type) => {
    switch (type) {
      case 'savings': return 'success';
      case 'checking': return 'primary';
      case 'credit_card': return 'error';
      case 'ewallet': return 'warning';
      default: return 'default';
    }
  };

  const getAccountTypeLabel = (type) => {
    switch (type) {
      case 'savings': return 'Savings';
      case 'checking': return 'Checking';
      case 'credit_card': return 'Credit Card';
      case 'ewallet': return 'E-Wallet';
      case 'investment': return 'Investment';
      default: return 'Other';
    }
  };

  if (loading) {
    return (
      <Container sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '80vh' 
      }}>
        <CircularProgress />
      </Container>
    );
  }

  const totalBalance = bankAccounts.reduce((sum, account) => sum + (account.balance || 0), 0);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ArrowBack 
              sx={{ mr: 2, cursor: 'pointer' }} 
              onClick={() => navigate('/dashboard')}
            />
            <AccountBalanceWallet sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                My Bank Accounts
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage your accounts and track balances
              </Typography>
            </Box>
          </Box>
          
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/add-bank-account')}
            sx={{ borderRadius: 2 }}
          >
            Add New Account
          </Button>
        </Box>
        <Divider sx={{ mt: 2 }} />
      </Box>

      {/* Error Message - NOW WORKS WITH ALERT IMPORT */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Total Balance Summary */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3, bgcolor: 'primary.light', color: 'white' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Total Across All Accounts
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AttachMoney sx={{ fontSize: 40, mr: 2 }} />
          <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
            ₱{totalBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
          {bankAccounts.length} account{bankAccounts.length !== 1 ? 's' : ''}
        </Typography>
      </Paper>

      {/* Accounts Grid */}
      {bankAccounts.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <AccountBalanceWallet sx={{ fontSize: 60, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Bank Accounts Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Add your first bank account to start tracking transactions
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/add-bank-account')}
            sx={{ borderRadius: 2 }}
          >
            Add Your First Account
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {bankAccounts.map((account) => (
            <Grid item xs={12} sm={6} md={4} key={account.id}>
              <Card sx={{ 
                borderRadius: 3, 
                boxShadow: 2,
                height: '100%',
                borderLeft: `4px solid ${account.isCash ? '#34a853' : '#1a73e8'}`
              }}>
                <CardContent>
                  {/* Account Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Business sx={{ color: 'primary.main', mr: 1, fontSize: 20 }} />
                        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                          {account.bankName}
                        </Typography>
                      </Box>
                      <Typography variant="body1" color="text.secondary">
                        {account.accountName}
                      </Typography>
                    </Box>
                    <Chip 
                      label={account.isCash ? 'Cash' : getAccountTypeLabel(account.accountType)}
                      color={account.isCash ? 'success' : getAccountTypeColor(account.accountType)}
                      size="small"
                    />
                  </Box>

                  {/* Balance */}
                  <Box sx={{ mt: 3, mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Current Balance
                    </Typography>
                    <Typography 
                      variant="h4" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: (account.balance || 0) >= 0 ? 'success.main' : 'error.main'
                      }}
                    >
                      ₱{(account.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>

                  {/* Actions - FIXED EDIT BUTTON */}
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Edit />}
                      onClick={() => navigate(`/edit-bank-account/${account.id}`)}
                      fullWidth
                    >
                      Edit
                    </Button>
                    {!account.isCash && (
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<Delete />}
                        onClick={() => handleDeleteAccount(account.id)}
                        fullWidth
                      >
                        Delete
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Quick Stats */}
      {bankAccounts.length > 0 && (
        <Paper sx={{ p: 3, mt: 4, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Account Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">
                Total Accounts
              </Typography>
              <Typography variant="h6">{bankAccounts.length}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">
                Bank Accounts
              </Typography>
              <Typography variant="h6">{bankAccounts.filter(a => !a.isCash && a.accountType !== 'ewallet').length}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">
                E-Wallets
              </Typography>
              <Typography variant="h6">{bankAccounts.filter(a => a.accountType === 'ewallet').length}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">
                Credit Cards
              </Typography>
              <Typography variant="h6">{bankAccounts.filter(a => a.accountType === 'credit_card').length}</Typography>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Container>
  );
}

export default BankAccountList;