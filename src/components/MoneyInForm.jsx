// src/components/MoneyInForm.jsx - COMPLETE FIXED VERSION
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
  AttachMoney,
  Description,
  CalendarToday,
  AccountBalance,
  Category
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDocs, query, where, updateDoc, getDoc } from 'firebase/firestore';

function MoneyInForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    sourceType: 'salary',
    bankAccountId: '',
    transacDate: new Date().toISOString().split('T')[0],
    debtName: ''
  });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDebtFields, setShowDebtFields] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState('');
  const [debts, setDebts] = useState([]);

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
    if (formData.sourceType === 'loan' || formData.sourceType === 'existing_loan') {
      fetchDebts();
      setShowDebtFields(true);
    } else {
      setShowDebtFields(false);
    }
  }, [formData.sourceType]);

  const fetchDebts = async () => {
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

      // Calculate new balance - ADD for money in
      const newBalance = (selectedAccount.balance || 0) + parseFloat(formData.amount);

      // 1. Create transaction document
      const transactionData = {
        transacID: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount: parseFloat(formData.amount),
        description: formData.description,
        transacDate: serverTimestamp(), // FIXED: Use server timestamp
        userId: user.uid,
        paymentMethodID: selectedAccount.isCash ? 'cash' : 'bank',
        bankAccountID: formData.bankAccountId,
        transactionType: 'IN',
        createdAt: serverTimestamp() // ADDED: For sorting
      };

      const transactionRef = await addDoc(collection(db, 'transactions'), transactionData);

      // 2. Create money_in subtype document
      const moneyInRef = await addDoc(collection(db, 'money_in'), {
        transacID: transactionRef.id,
        sourceType: formData.sourceType,
        debtID: null,
        userId: user.uid, // ADDED: For querying
        createdAt: serverTimestamp()
      });

      // If this is a new loan, create a debt
      if (formData.sourceType === 'loan') {
        const debtId = `debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await addDoc(collection(db, 'debts'), {
          debtID: debtId,
          debtName: `Loan: ${formData.description}`,
          description: formData.description,
          totalAmnt: parseFloat(formData.amount),
          currentBal: parseFloat(formData.amount),
          interest: 0,
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          userId: user.uid,
          originatingTransacID: transactionRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // If adding to existing debt
      if (formData.sourceType === 'existing_loan' && selectedDebtId) {
        // Update existing debt balance
        const debtRef = doc(db, 'debts', selectedDebtId);
        const debtDoc = await getDoc(debtRef);
        
        if (debtDoc.exists()) {
          const debt = debtDoc.data();
          const newTotal = (debt.totalAmnt || 0) + parseFloat(formData.amount);
          const newBalance = (debt.currentBal || 0) + parseFloat(formData.amount);
          
          await updateDoc(debtRef, {
            totalAmnt: newTotal,
            currentBal: newBalance,
            updatedAt: serverTimestamp()
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
        changeType: 'IN',
        updatedAt: serverTimestamp()
      });

      setSuccess(`✅ ₱${formData.amount} added successfully!`);
      
      // Clear form
      setFormData({
        amount: '',
        description: '',
        sourceType: 'salary',
        bankAccountId: selectedAccount.id,
        transacDate: new Date().toISOString().split('T')[0],
        debtName: ''
      });

      // Auto-redirect after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (err) {
      console.error('Error adding money in:', err);
      setError(err.message || 'Failed to add money in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sourceTypes = [
    { value: 'salary', label: 'Salary' },
    { value: 'freelance', label: 'Freelance Work' },
    { value: 'business', label: 'Business Income' },
    { value: 'investment', label: 'Investment Return' },
    { value: 'gift', label: 'Gift' },
    { value: 'loan', label: 'Loan - Create New Debt' },
    { value: 'existing_loan', label: 'Loan - Add to Existing Debt' },
    { value: 'refund', label: 'Refund' },
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
            border: '1px solid #e8eaed',
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography 
            variant="h4" 
            component="h1"
            sx={{ 
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #1a73e8 30%, #34a853 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1
            }}
          >
            <AttachMoney sx={{ mr: 1, verticalAlign: 'middle' }} />
            Add Money In
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Record your income, gifts, loans, or any money coming in
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
                <AttachMoney sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
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

          {/* Row 2: Description */}
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
                  placeholder="e.g., December Salary, Birthday Gift, etc."
                />
              </Box>
            </Grid>

            {/* Source Type */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Category sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Source Type</InputLabel>
                  <Select
                    name="sourceType"
                    value={formData.sourceType}
                    onChange={handleChange}
                    label="Source Type"
                  >
                    {sourceTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Grid>
          </Grid>

            {/* Row 3: */}
            {/* Bank Account */}
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

            {/* Debt Selection Fields (shown only for loans) */}
            {showDebtFields && (
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12}>
                  {formData.sourceType === 'loan' ? (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                      <AccountBalance sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                      <TextField
                        fullWidth
                        label="New Debt Name"
                        name="debtName"
                        value={formData.debtName || ''}
                        onChange={handleChange}
                        variant="outlined"
                        required
                        placeholder="e.g., Car Loan, Personal Loan"
                        autoFocus
                        helperText="This will create a new debt record"
                      />
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                      <AccountBalance sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                      <FormControl fullWidth variant="outlined">
                        <InputLabel>Select Existing Debt</InputLabel>
                        <Select
                          value={selectedDebtId}
                          onChange={(e) => setSelectedDebtId(e.target.value)}
                          label="Select Existing Debt"
                          required
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
                    </Box>
                  )}
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
                {loading ? 'Adding Money...' : 'Add Money In'}
              </Button>
            </Grid>
          </Grid>
        </form>

        {/* Info Box */}
        <Box sx={{ 
          mt: 4, 
          p: 3, 
          bgcolor: 'info.light', 
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'info.main'
        }}>
          <Typography variant="body2" color="info.contrastText">
            💡 <strong>Note:</strong> This will increase the balance of your selected account.
            Loans should be recorded here and will be linked to debts later.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default MoneyInForm;