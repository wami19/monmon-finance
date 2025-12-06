// src/components/BankAccountList.jsx - COMPLETE VERSION WITH TRANSACTIONAL DELETE
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
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import { 
  ArrowBack,
  AccountBalanceWallet,
  AttachMoney,
  Business,
  Edit,
  Delete,
  Add
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  deleteDoc,
  getDoc,
  addDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

function BankAccountList() {
  const navigate = useNavigate();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    accountId: null,
    accountName: '',
    bankName: '',
    accountBalance: 0
  });

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

  const handleDeleteClick = (accountId, accountName, bankName, accountBalance) => {
    setDeleteDialog({
      open: true,
      accountId,
      accountName,
      bankName,
      accountBalance: accountBalance || 0
    });
  };

  const handleCloseDialog = () => {
    setDeleteDialog({
      open: false,
      accountId: null,
      accountName: '',
      bankName: '',
      accountBalance: 0
    });
  };

  const createDeletionTransaction = async (userId, accountId, accountData) => {
    const accountBalance = accountData.balance || 0;
    const accountName = accountData.accountName || 'Unknown Account';
    const bankName = accountData.bankName || 'Bank';
    
    // Only create transaction if there's a balance
    if (accountBalance <= 0) return null;

    // Generate transaction ID (matches your pattern)
    const transactionId = `txn_del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 1. Create transaction document (matches MoneyOutForm pattern)
    const transactionData = {
      transacID: transactionId,
      amount: accountBalance,
      description: `Account Closure: ${bankName} - ${accountName}`,
      transacDate: serverTimestamp(),
      userId: userId,
      paymentMethodID: 'balance_adjustment', // Same as edit-bank-account
      bankAccountID: accountId,
      transactionType: 'OUT', // Money leaving the system
      createdAt: serverTimestamp(),
      category: 'account_closure',
      tags: ['system', 'deletion']
    };

    await addDoc(collection(db, 'transactions'), transactionData);

    // 2. Create money_out record (matches MoneyOutForm pattern)
    await addDoc(collection(db, 'money_out'), {
      transacID: transactionId,
      spendingCategory: 'account_deletion',
      debtID: null,
      userId: userId,
      createdAt: serverTimestamp(),
      notes: `Account ${accountName} (${bankName}) was deleted with balance ₱${accountBalance.toFixed(2)}`
    });

    // 3. Create audit trail (matches your pattern)
    await addDoc(collection(db, 'bank_account_updates'), {
      bankAccountID: accountId,
      previousBalance: accountBalance,
      newBalance: 0,
      transactionId: transactionId,
      changeAmount: accountBalance,
      changeType: 'ACCOUNT_DELETION',
      userId: userId,
      updatedAt: serverTimestamp(),
      description: `Account ${accountName} deleted`
    });

    return transactionId;
  };

  const deleteRelatedRecords = async (accountId, userId) => {
    try {
      // Optional: Delete related transactions
      // You can skip this if you want to keep transaction history
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', userId),
        where('bankAccountID', '==', accountId)
      );
      
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      const batch = writeBatch(db);
      
      // Delete related transactions and their money_in/money_out records
      transactionsSnapshot.forEach((transactionDoc) => {
        const transId = transactionDoc.id;
        
        // Delete transaction
        batch.delete(transactionDoc.ref);
        
        // Delete money_in record if exists
        const moneyInRef = doc(db, 'money_in', transId);
        batch.delete(moneyInRef);
        
        // Delete money_out record if exists
        const moneyOutRef = doc(db, 'money_out', transId);
        batch.delete(moneyOutRef);
      });
      
      if (transactionsSnapshot.size > 0) {
        await batch.commit();
        console.log(`Deleted ${transactionsSnapshot.size} related transactions`);
      }
    } catch (error) {
      console.error('Error deleting related records:', error);
      // Don't fail the whole operation if this fails
    }
  };

  const handleDeleteAccount = async () => {
    const { accountId, accountName, bankName, accountBalance } = deleteDialog;
    
    if (!accountId) return;

    try {
      setLoading(true);
      
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }

      // 1. Get account data first
      const accountRef = doc(db, 'bank_accounts', accountId);
      const accountDoc = await getDoc(accountRef);
      
      if (!accountDoc.exists()) {
        throw new Error('Account not found');
      }

      const accountData = accountDoc.data();

      // 2. Create a deletion transaction (if there's balance)
      let transactionId = null;
      if (accountBalance > 0) {
        transactionId = await createDeletionTransaction(user.uid, accountId, accountData);
      }

      // 3. Delete related records (optional - you can comment this out if you want to keep history)
      // await deleteRelatedRecords(accountId, user.uid);

      // 4. Delete the bank account
      await deleteDoc(accountRef);

      // 5. Close dialog and refresh
      handleCloseDialog();
      await fetchBankAccounts();
      
      // Show success message
      setError(`✅ Account "${accountName}" deleted successfully. ${
        accountBalance > 0 
          ? `Transaction recorded for ₱${accountBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}.` 
          : ''
      }`);
      setTimeout(() => setError(''), 3000);

    } catch (error) {
      console.error('Error deleting account:', error);
      setError(`Failed to delete account: ${error.message}`);
    } finally {
      setLoading(false);
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

  if (loading && bankAccounts.length === 0) {
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

      {/* Error/Success Messages */}
      {error && (
        <Alert 
          severity={error.includes('✅') ? "success" : "error"} 
          sx={{ mb: 3 }}
          onClose={() => setError('')}
        >
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
                borderLeft: `4px solid ${account.isCash ? '#34a853' : '#1a73e8'}`,
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
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

                  {/* Actions */}
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
                        onClick={() => handleDeleteClick(
                          account.id, 
                          account.accountName, 
                          account.bankName, 
                          account.balance
                        )}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={handleCloseDialog}
      >
        <DialogTitle>Delete Bank Account</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteDialog.bankName} - {deleteDialog.accountName}</strong>?
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, color: 'black', bgcolor: 'warning.light', p: 2, borderRadius: 1 }}>
            ⚠️ <strong>Warning:</strong> This action will:
            <ul style={{ marginTop: '8px', marginBottom: '8px' }}>
              <li>Permanently delete this account</li>
              <li>
                {deleteDialog.accountBalance > 0 
                  ? `Record a final transaction for ₱${deleteDialog.accountBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                  : 'No transaction will be recorded (zero balance)'
                }
              </li>
              { /* <li>Remove all related transaction history</li> */ }
              <li><strong>This action cannot be undone</strong></li>
            </ul>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteAccount}
            color="error"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <Delete />}
          >
            {loading ? 'Deleting...' : 'Delete Account'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default BankAccountList;