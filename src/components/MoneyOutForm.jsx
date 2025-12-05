// src/components/MoneyOutForm.jsx - COMPLETE FIXED VERSION
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  TextField, 
  Button, 
  Container, 
  Typography, 
  Box, 
  Alert,
  Paper,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Divider
} from '@mui/material';
import { 
  ArrowBack,
  MoneyOff,
  Description,
  CalendarToday,
  AccountBalance,
  Category
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, getDocs, query, where, updateDoc, doc, getDoc } from 'firebase/firestore';

function MoneyOutForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    spendingCategory: 'food',
    bankAccountId: '',
    transacDate: new Date().toISOString().split('T')[0]
  });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDebtSelection, setShowDebtSelection] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState('');
  const [debts, setDebts] = useState([]);

  // Check for preset values from navigation (e.g., from debt list)
  useEffect(() => {
    if (location.state) {
      const { selectedDebtId, presetCategory, presetAmount } = location.state;
      if (selectedDebtId) {
        setSelectedDebtId(selectedDebtId);
      }
      if (presetCategory) {
        setFormData(prev => ({ ...prev, spendingCategory: presetCategory }));
      }
      if (presetAmount) {
        setFormData(prev => ({ ...prev, amount: presetAmount.toString() }));
      }
    }
  }, [location.state]);

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
      
      setBankAccounts(accounts);
      
      // Auto-select cash account if available
      const cashAccount = accounts.find(acc => acc.isCash);
      if (cashAccount) {
        setFormData(prev => ({ ...prev, bankAccountId: cashAccount.id }));
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  useEffect(() => {
    if (formData.spendingCategory === 'debt_payment') {
      fetchActiveDebts();
      setShowDebtSelection(true);
    } else {
      setShowDebtSelection(false);
    }
  }, [formData.spendingCategory]);

  const fetchActiveDebts = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const debtsQuery = query(
        collection(db, 'debts'),
        where('userId', '==', user.uid),
        where('currentBal', '>', 0)
      );
      const querySnapshot = await getDocs(debtsQuery);
      
      const debtsArray = [];
      querySnapshot.forEach((doc) => {
        debtsArray.push({ id: doc.id, ...doc.data() });
      });
      
      setDebts(debtsArray);
    } catch (error) {
      console.error('Error fetching debts:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in');
      }

      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        throw new Error('Please enter a valid amount');
      }

      if (!formData.bankAccountId) {
        throw new Error('Please select a bank account');
      }

      // Get selected bank account
      const selectedAccount = bankAccounts.find(acc => acc.id === formData.bankAccountId);
      if (!selectedAccount) {
        throw new Error('Selected bank account not found');
      }

      // Check if enough balance - ONLY FOR MONEY OUT!
      if ((selectedAccount.balance || 0) < parseFloat(formData.amount)) {
        throw new Error(`Insufficient balance. Available: ₱${selectedAccount.balance?.toLocaleString() || '0'}`);
      }

      // Calculate new balance - SUBTRACT for money out
      const newBalance = (selectedAccount.balance || 0) - parseFloat(formData.amount);

      // 1. Create transaction document
      const transactionData = {
        transacID: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount: parseFloat(formData.amount),
        description: formData.description,
        transacDate: serverTimestamp(), // FIXED: Use server timestamp
        userId: user.uid,
        paymentMethodID: selectedAccount.isCash ? 'cash' : 'bank',
        bankAccountID: formData.bankAccountId,
        transactionType: 'OUT',
        createdAt: serverTimestamp() // ADDED: For sorting
      };

      const transactionRef = await addDoc(collection(db, 'transactions'), transactionData);

      // 2. Create money_out subtype document
      const moneyOutRef = await addDoc(collection(db, 'money_out'), {
        transacID: transactionRef.id,
        spendingCategory: formData.spendingCategory,
        debtID: selectedDebtId || null,
        userId: user.uid, // ADDED: For querying
        createdAt: serverTimestamp()
      });

      // If this is a debt payment, update the debt
      if (formData.spendingCategory === 'debt_payment' && selectedDebtId) {
        const debtRef = doc(db, 'debts', selectedDebtId);
        const debtDoc = await getDoc(debtRef);
        
        if (debtDoc.exists()) {
          const debt = debtDoc.data();
          const newDebtBalance = Math.max(0, (debt.currentBal || 0) - parseFloat(formData.amount));
          
          await updateDoc(debtRef, {
            currentBal: newDebtBalance,
            updatedAt: serverTimestamp()
          });

          // Record the payment in debt_payments collection
          await addDoc(collection(db, 'debt_payments'), {
            debtID: selectedDebtId,
            transactionID: transactionRef.id,
            amount: parseFloat(formData.amount),
            paymentDate: serverTimestamp(),
            userId: user.uid
          });
        }
      }

      // 3. Update bank account balance
      const bankAccountRef = doc(db, 'bank_accounts', formData.bankAccountId);
      await updateDoc(bankAccountRef, {
        balance: newBalance,
        lastUpdated: serverTimestamp()
      });

      // 4. Create audit trail
      await addDoc(collection(db, 'bank_account_updates'), {
        bankAccountID: formData.bankAccountId,
        previousBalance: selectedAccount.balance || 0,
        newBalance: newBalance,
        transactionId: transactionRef.id,
        changeAmount: parseFloat(formData.amount),
        changeType: 'OUT',
        updatedAt: serverTimestamp()
      });

      setSuccess(`✅ ₱${formData.amount} spent recorded!`);
      
      // Clear form
      setFormData({
        amount: '',
        description: '',
        spendingCategory: formData.spendingCategory,
        bankAccountId: formData.bankAccountId,
        transacDate: new Date().toISOString().split('T')[0]
      });
      setSelectedDebtId('');

      // Auto-redirect after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (err) {
      console.error('Error adding money out:', err);
      setError(err.message || 'Failed to record spending. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const spendingCategories = [
    { value: 'food', label: 'Food & Dining' },
    { value: 'transport', label: 'Transportation' },
    { value: 'housing', label: 'Housing & Rent' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'shopping', label: 'Shopping' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'health', label: 'Health & Medical' },
    { value: 'education', label: 'Education' },
    { value: 'debt_payment', label: 'Debt Payment' },
    { value: 'savings', label: 'Savings & Investment' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <Container maxWidth="md">
      {/* Back Button */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          sx={{ color: 'primary.main' }}
        >
          Back to Dashboard
        </Button>
      </Box>

      <Paper 
        elevation={3}
        sx={{ 
          p: 4, 
          borderRadius: 3,
          background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
          border: '1px solid #e8eaed'
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography 
            variant="h4" 
            component="h1"
            sx={{ 
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #1a73e8 30%, #ea4335 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1
            }}
          >
            <MoneyOff sx={{ mr: 1, verticalAlign: 'middle' }} />
            Add Money Out
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Record your expenses, bills, or any money going out
          </Typography>
        </Box>

        {/* Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Row 1: Amount and Date */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <MoneyOff sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <TextField
                  fullWidth
                  label="Amount (₱)"
                  name="amount"
                  type="number"
                  value={formData.amount}
                  onChange={handleChange}
                  variant="outlined"
                  required
                  InputProps={{
                    inputProps: { 
                      min: 0.01,
                      step: 0.01 
                    }
                  }}
                  placeholder="0.00"
                />
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <CalendarToday sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <TextField
                  fullWidth
                  label="Date"
                  name="transacDate"
                  type="date"
                  value={formData.transacDate}
                  onChange={handleChange}
                  variant="outlined"
                  required
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Box>
            </Grid>
          </Grid>

          {/* Row 2: Description and Category */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Description sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  variant="outlined"
                  required
                  placeholder="e.g., Grocery shopping, Electric bill, etc."
                />
              </Box>
            </Grid>

            {/* Spending Category */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Category sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Category</InputLabel>
                  <Select
                    name="spendingCategory"
                    value={formData.spendingCategory}
                    onChange={handleChange}
                    label="Category"
                  >
                    {spendingCategories.map((category) => (
                      <MenuItem key={category.value} value={category.value}>
                        {category.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Grid>
          </Grid>

          {/* Row 3: Bank Account */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <AccountBalance sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Select Account</InputLabel>
                    <Select
                      name="bankAccountId"
                      value={formData.bankAccountId}
                      onChange={handleChange}
                      label="Select Account"
                      required
                    >
                      {/* Cash Account First */}
                      {bankAccounts
                        .filter(account => account.isCash)
                        .map((account) => (
                          <MenuItem key={account.id} value={account.id}>
                            💵 {account.accountName} - ₱{account.balance?.toLocaleString() || '0'}
                          </MenuItem>
                        ))}
                      
                      {/* Separator */}
                      <MenuItem disabled sx={{ py: 0 }}>
                        <Divider sx={{ width: '100%' }} />
                      </MenuItem>
                      
                      {/* Bank Accounts (non-cash) */}
                      {bankAccounts
                        .filter(account => !account.isCash)
                        .map((account) => (
                          <MenuItem key={account.id} value={account.id}>
                            🏦 {account.accountName} ({account.bankName}) - ₱{account.balance?.toLocaleString() || '0'}
                          </MenuItem>
                        ))}
                    </Select>
                </FormControl>
              </Box>
            </Grid>

          {/* Debt Selection for Debt Payments */}
          {showDebtSelection && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Select Debt to Pay</InputLabel>
                  <Select
                    value={selectedDebtId}
                    onChange={(e) => setSelectedDebtId(e.target.value)}
                    label="Select Debt to Pay"
                    required={formData.spendingCategory === 'debt_payment'}
                  >
                    <MenuItem value="">
                      <em>Select a debt</em>
                    </MenuItem>
                    {debts.map((debt) => (
                      <MenuItem key={debt.id} value={debt.id}>
                        {debt.debtName} - Remaining: ₱{debt.currentBal?.toLocaleString() || '0'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}

          </Grid>

          {/* Row 4: Submit Button */}
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ 
                  py: 1.5,
                  fontWeight: 'bold',
                  borderRadius: 2,
                  mt: 2
                }}
              >
                {loading ? 'Recording Expense...' : 'Record Money Out'}
              </Button>
            </Grid>
          </Grid>
        </form>

        {/* Info Box */}
        <Box sx={{ 
          mt: 4, 
          p: 3, 
          bgcolor: 'warning.light', 
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'warning.main'
        }}>
          <Typography variant="body2" color="warning.contrastText">
            ⚠️ <strong>Warning:</strong> This will decrease the balance of your selected account.
            Make sure you have sufficient funds before recording.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default MoneyOutForm;