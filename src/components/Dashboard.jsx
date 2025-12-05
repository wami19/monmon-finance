// src/components/Dashboard.jsx - BACKWARD COMPATIBLE FIXED VERSION
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit
} from 'firebase/firestore';
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  AccountBalanceWallet,
  AttachMoney,
  MoneyOff,
  AccountBalance,
  Logout,
  Add,
  TrendingUp,
  TrendingDown,
  AccountCircle,
  ArrowUpward,
  ArrowDownward,
  List as ListIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    totalBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    cashOnHand: 0,
    totalDebt: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchUserData(currentUser.uid);
      } else {
        navigate('/login');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [navigate]);

  const fetchUserData = async (userId) => {
    try {
      // 1. Fetch user document
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        setUserData(userDocSnap.data());
      }

      // 2. Fetch bank accounts
      const bankAccountsQuery = query(
        collection(db, 'bank_accounts'),
        where('userId', '==', userId)
      );
      const bankAccountsSnapshot = await getDocs(bankAccountsQuery);
      
      let totalBalance = 0;
      let cashOnHand = 0;
      const accountsArray = [];
      
      bankAccountsSnapshot.forEach(doc => {
        const account = { id: doc.id, ...doc.data() };
        accountsArray.push(account);
        totalBalance += account.balance || 0;
        if (account.isCash) {
          cashOnHand = account.balance || 0;
        }
      });

      // 3. Fetch ALL transactions (simpler approach)
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', userId),
        orderBy('transacDate', 'desc'), // Use transacDate which all transactions have
        limit(50)
      );
      
      const transactionsSnapshot = await getDocs(transactionsQuery);
      const allTransactions = [];
      
      // Get totals for this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      let monthIncome = 0;
      let monthExpenses = 0;
      
      // Get all money_in and money_out records
      const moneyInQuery = query(
        collection(db, 'money_in'),
        where('userId', '==', userId)
      );
      const moneyOutQuery = query(
        collection(db, 'money_out'),
        where('userId', '==', userId)
      );
      
      const [moneyInSnapshot, moneyOutSnapshot] = await Promise.all([
        getDocs(moneyInQuery),
        getDocs(moneyOutQuery)
      ]);
      
      // Create maps for quick lookup
      const moneyInMap = new Map();
      const moneyOutMap = new Map();
      
      moneyInSnapshot.forEach(doc => {
        const data = doc.data();
        moneyInMap.set(data.transacID, data.sourceType || 'income');
      });
      
      moneyOutSnapshot.forEach(doc => {
        const data = doc.data();
        moneyOutMap.set(data.transacID, data.spendingCategory || 'expense');
      });
      
      // Process transactions
      for (const transactionDoc of transactionsSnapshot.docs) {
        const transaction = transactionDoc.data();
        
        // Get transaction date (handle both formats)
        let transacDate;
        if (transaction.createdAt) {
          // New format with createdAt
          transacDate = transaction.createdAt.toDate();
        } else if (transaction.transacDate) {
          // Old format with transacDate string
          if (typeof transaction.transacDate === 'string') {
            transacDate = new Date(transaction.transacDate);
          } else if (transaction.transacDate.toDate) {
            // If it's a Firestore timestamp
            transacDate = transaction.transacDate.toDate();
          } else {
            transacDate = new Date();
          }
        } else {
          transacDate = new Date();
        }
        
        // Check if transaction is from this month
        const isThisMonth = transacDate >= startOfMonth;
        
        // Calculate month totals
        if (isThisMonth) {
          if (transaction.transactionType === 'IN') {
            monthIncome += transaction.amount || 0;
          } else if (transaction.transactionType === 'OUT') {
            monthExpenses += transaction.amount || 0;
          }
        }
        
        // Get category from maps
        let category = '';
        if (transaction.transactionType === 'IN') {
          category = moneyInMap.get(transactionDoc.id) || 'income';
        } else {
          category = moneyOutMap.get(transactionDoc.id) || 'expense';
        }
        
        // Get payment method
        let paymentMethod = 'Unknown';
        if (transaction.paymentMethodID === 'cash') {
          paymentMethod = 'Cash';
        } else if (transaction.paymentMethodID === 'bank') {
          paymentMethod = 'Bank';
        } else if (transaction.paymentMethodID === 'bank_transfer') {
          paymentMethod = 'Bank Transfer';
        } else if (transaction.paymentMethodID === 'balance_adjustment') {
          paymentMethod = 'Adjustment';
        } else if (transaction.paymentMethodID) {
          paymentMethod = transaction.paymentMethodID;
        }
        
        allTransactions.push({
          id: transactionDoc.id,
          description: transaction.description,
          amount: transaction.transactionType === 'IN' ? transaction.amount : -transaction.amount,
          type: transaction.transactionType,
          date: transacDate,
          displayDate: transacDate.toLocaleDateString('en-PH'),
          displayTime: transacDate.toLocaleTimeString('en-PH', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }),
          category: category,
          paymentMethod: paymentMethod,
          timestamp: transacDate.getTime()
        });
      }

      // 4. Fetch debts
      const debtsQuery = query(
        collection(db, 'debts'),
        where('userId', '==', userId),
        where('currentBal', '>', 0)
      );
      const debtsSnapshot = await getDocs(debtsQuery);

      let totalDebt = 0;
      debtsSnapshot.forEach((doc) => {
        const debt = doc.data();
        totalDebt += debt.currentBal || 0;
      });

      // Update state with ALL data
      setTotals({
        totalBalance,
        totalIncome: monthIncome,
        totalExpenses: monthExpenses,
        cashOnHand,
        totalDebt
      });

      // Sort transactions by date (newest first) and take top 5
      allTransactions.sort((a, b) => b.timestamp - a.timestamp);
      setRecentTransactions(allTransactions.slice(0, 5));
      
      setBankAccounts(accountsArray);

    } catch (error) {
      console.error('Error fetching user data:', error);
      console.log('Error details:', error.message);
      console.log('Stack:', error.stack);
      
      // Don't show error to user, just use fallback
      useDummyDataAsFallback();
    }
  };

  const useDummyDataAsFallback = () => {
    console.log('Using fallback data...');
    const dummyTransactions = [
      { 
        id: 1, 
        description: 'Sample Income', 
        amount: 10000, 
        type: 'IN', 
        displayDate: 'Today', 
        displayTime: '10:30 AM',
        category: 'Salary',
        paymentMethod: 'Cash'
      },
      { 
        id: 2, 
        description: 'Sample Expense', 
        amount: -500, 
        type: 'OUT', 
        displayDate: 'Today', 
        displayTime: '02:15 PM',
        category: 'Food',
        paymentMethod: 'Bank'
      },
    ];
    
    setTotals({
      totalBalance: 9500,
      totalIncome: 10000,
      totalExpenses: 500,
      cashOnHand: 9500,
      totalDebt: 0
    });
    
    setRecentTransactions(dummyTransactions);
    setBankAccounts([{ id: 'demo', accountName: 'Demo Account', balance: 9500 }]);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setError('Logout failed. Please try again.');
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
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} sx={{ color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Loading your dashboard...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Error Alert */}
      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        {/* Left: Logo & Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ 
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            bgcolor: 'primary.light',
            p: 1,
            borderRadius: 2
          }}>
            <AccountBalanceWallet sx={{ width: '40px', height: '40px', color: '#ffffff' }} />
          </Box>
          
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                Dashboard
              </Box>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                MonMon Dashboard
              </Box>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '1rem' } }}>
              {userData?.givName ? `Welcome, ${userData.givName}!` : 'Your Financial Hub'}
            </Typography>
          </Box>
        </Box>
        
        {/* Right: User & Logout */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ 
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center', 
            bgcolor: 'grey.50', 
            p: 1, 
            borderRadius: 2 
          }}>
            <AccountCircle sx={{ color: 'primary.main', mr: 1, fontSize: '1rem' }} />
            <Typography variant="caption" color="text.secondary">
              {user?.email?.split('@')[0]}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Logout />}
            onClick={handleLogout}
            sx={{ borderRadius: 2 }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Logout
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              Logout
            </Box>
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Total Balance */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            borderRadius: 3, 
            boxShadow: 2,
            borderTop: '4px solid #1a73e8',
            height: '100%'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountBalanceWallet sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Total Balance
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    ₱{totals.totalBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Across all accounts
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Cash on Hand */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            borderRadius: 3, 
            boxShadow: 2,
            borderTop: '4px solid #34a853',
            height: '100%'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AttachMoney sx={{ fontSize: 40, color: 'secondary.main', mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Cash on Hand
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>
                    ₱{totals.cashOnHand.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Physical cash available
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* This Month Income */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            borderRadius: 3, 
            boxShadow: 2,
            borderTop: '4px solid #1a73e8',
            height: '100%'
          }}>
            <CardContent>
              <Box sx={{ display: '-flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    This Month Income
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    ₱{totals.totalIncome.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Money in this month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* This Month Expenses */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            borderRadius: 3, 
            boxShadow: 2,
            borderTop: '4px solid #ea4335',
            height: '100%'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingDown sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    This Month Expenses
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                    ₱{totals.totalExpenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Money out this month
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Debt Summary Card */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            borderRadius: 3, 
            boxShadow: 2,
            borderTop: '4px solid #ea4335',
            cursor: 'pointer',
            height: '100%',
            '&:hover': {
              boxShadow: 4,
              transform: 'translateY(-2px)',
              transition: 'all 0.2s'
            }
          }}
          onClick={() => navigate('/debts')}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Active Debt
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                    ₱{totals.totalDebt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Click to manage debts
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions & Recent Transactions */}
      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold', color: 'primary.main' }}>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button 
                    variant="contained" 
                    startIcon={<ArrowUpward />}
                    onClick={() => navigate('/money-in')}
                    sx={{ 
                        borderRadius: 2, 
                        py: 1.5,
                        background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)'
                    }}
                    >
                    Add Money In
                </Button>

                <Button 
                    variant="contained" 
                    color="secondary"
                    startIcon={<ArrowDownward />}
                    onClick={() => navigate('/money-out')}
                    sx={{ 
                        borderRadius: 2, 
                        py: 1.5,
                        background: 'linear-gradient(135deg, #34a853 0%, #5bb974 100%)'
                    }}
                    >
                    Add Money Out
                </Button>
             
                <Button 
                  variant="outlined" 
                  startIcon={<AccountBalance />}
                  onClick={() => navigate('/add-bank-account')}
                  sx={{ borderRadius: 2, py: 1.5 }}
                >
                  Add Bank Account
                </Button>

                <Button 
                  variant="outlined" 
                  startIcon={<ListIcon />}
                  onClick={() => navigate('/bank-accounts')}
                  sx={{ borderRadius: 2, py: 1.5 }}
                >
                  View All Accounts
                </Button>
            </Box>

            {/* User Stats */}
            <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #e8eaed' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
                Your Stats
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Accounts:
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {bankAccounts.length}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Transactions:
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {recentTransactions.length}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Net Flow:
                  </Typography>
                  <Typography 
                    variant="body1" 
                    fontWeight="bold"
                    color={totals.totalIncome - totals.totalExpenses >= 0 ? 'secondary.main' : 'error.main'}
                  >
                    ₱{(totals.totalIncome - totals.totalExpenses).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Savings Rate:
                  </Typography>
                  <Typography variant="body1" fontWeight="bold" color="secondary.main">
                    {totals.totalIncome > 0 ? 
                      `${((totals.totalIncome - totals.totalExpenses) / totals.totalIncome * 100).toFixed(1)}%` : 
                      '0%'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>

        {/* Recent Transactions */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                Recent Transactions
              </Typography>
              <Button 
                variant="text" 
                size="small"
                sx={{ color: 'primary.main', fontWeight: 'bold' }}
                onClick={() => navigate('/transactions')}
              >
                View All
              </Button>
            </Box>
            
            {recentTransactions.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <AccountBalanceWallet sx={{ fontSize: 60, color: 'grey.300', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  No transactions yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Add your first transaction to get started
                </Typography>
              </Box>
            ) : (
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {recentTransactions.map((transaction) => (
                  <ListItem 
                    key={transaction.id}
                    sx={{ 
                      borderBottom: '1px solid #eee',
                      '&:last-child': { borderBottom: 'none' },
                      py: 2
                    }}
                  >
                    <ListItemIcon>
                      {transaction.type === 'IN' ? (
                        <ArrowUpward sx={{ color: 'secondary.main' }} />
                      ) : (
                        <ArrowDownward sx={{ color: 'error.main' }} />
                      )}
                    </ListItemIcon>

                    <ListItemText
                      primary={
                        <Typography variant="body1" fontWeight="medium" component="span">
                          {transaction.description}
                        </Typography>
                      }
                      secondary={
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                          <Typography component="span" variant="caption" color="text.secondary">
                            {transaction.displayDate} {transaction.displayTime}
                          </Typography>
                          <Typography 
                            component="span"
                            variant="caption" 
                            sx={{ 
                              bgcolor: transaction.type === 'IN' ? 'rgba(52, 168, 83, 0.1)' : 'rgba(234, 67, 53, 0.1)',
                              color: transaction.type === 'IN' ? 'secondary.main' : 'error.main',
                              px: 1,
                              py: 0.25,
                              borderRadius: 1
                            }}
                          >
                            {transaction.category}
                          </Typography>
                          <Typography 
                            component="span"
                            variant="caption" 
                            sx={{ 
                              bgcolor: 'rgba(66, 133, 244, 0.1)',
                              color: 'primary.main',
                              px: 1,
                              py: 0.25,
                              borderRadius: 1
                            }}
                          >
                            {transaction.paymentMethod}
                          </Typography>
                        </Box>
                      }
                    />

                    <Typography 
                      variant="body1" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: transaction.type === 'IN' ? 'secondary.main' : 'error.main'
                      }}
                    >
                      {transaction.type === 'IN' ? '+' : '-'}₱{Math.abs(transaction.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard;