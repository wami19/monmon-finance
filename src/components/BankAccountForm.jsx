// src/components/BankAccountForm.jsx - COMPLETE FIXED VERSION
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
  Grid
} from '@mui/material';
import { 
  ArrowBack,
  AccountBalance,
  Business,
  Badge,
  AccountBalanceWallet
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  updateDoc,
  setDoc 
} from 'firebase/firestore';

function BankAccountForm() {
  const navigate = useNavigate();
  const { accountId } = useParams();
  const isEditing = !!accountId;
  
  const [formData, setFormData] = useState({
    bankName: '',
    accountName: '',
    accountType: 'savings',
    initialBalance: '0'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);

  // Fetch account data if editing
  useEffect(() => {
    if (isEditing) {
      fetchAccountData();
    }
  }, [isEditing, accountId]);

  const fetchAccountData = async () => {
    try {
      const accountDoc = await getDoc(doc(db, 'bank_accounts', accountId));
      if (accountDoc.exists()) {
        const account = accountDoc.data();
        setFormData({
          bankName: account.bankName || '',
          accountName: account.accountName || '',
          accountType: account.accountType || 'savings',
          initialBalance: account.balance?.toString() || '0'
        });
        setCurrentBalance(account.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching account:', error);
      setError('Failed to load account data');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const createTransactionForBalanceChange = async (userId, bankAccountID, accountName, oldBalance, newBalance, isInitial = false) => {
    const difference = newBalance - oldBalance;
    
    if (Math.abs(difference) < 0.01) {
      return null; // No significant change
    }

    const transactionID = isInitial 
      ? `txn_init_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      : `txn_adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const description = isInitial
      ? `Initial deposit for ${accountName}`
      : `Balance adjustment for ${accountName}`;
    
    const transactionType = difference > 0 ? 'IN' : 'OUT';
    const amount = Math.abs(difference);

    // Create transaction document
    const transactionData = {
      transacID: transactionID,
      amount: amount,
      description: description,
      transacDate: serverTimestamp(),
      userId: userId,
      paymentMethodID: isInitial ? 'bank_transfer' : 'balance_adjustment',
      bankAccountID: bankAccountID,
      transactionType: transactionType,
      createdAt: serverTimestamp()
    };

    const transactionRef = await addDoc(collection(db, 'transactions'), transactionData);

    // Create subtype document
    if (transactionType === 'IN') {
      await addDoc(collection(db, 'money_in'), {
        transacID: transactionRef.id,
        sourceType: isInitial ? 'initial_deposit' : 'balance_adjustment',
        debtID: null,
        createdAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, 'money_out'), {
        transacID: transactionRef.id,
        spendingCategory: 'balance_adjustment',
        debtID: null,
        createdAt: serverTimestamp()
      });
    }

    // Create audit trail
    await addDoc(collection(db, 'bank_account_updates'), {
      bankAccountID: bankAccountID,
      previousBalance: oldBalance,
      newBalance: newBalance,
      transactionId: transactionRef.id,
      changeAmount: amount,
      changeType: isInitial ? 'INITIAL_DEPOSIT' : 'BALANCE_ADJUSTMENT',
      updatedAt: serverTimestamp()
    });

    return transactionRef.id;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }

      if (!formData.bankName.trim()) {
        throw new Error('Please enter bank name');
      }

      if (!formData.accountName.trim()) {
        throw new Error('Please enter account name');
      }

      const newBalance = parseFloat(formData.initialBalance) || 0;
      
      if (newBalance < 0) {
        throw new Error('Balance cannot be negative');
      }

      const bankAccountData = {
        bankName: formData.bankName,
        accountName: formData.accountName,
        accountType: formData.accountType,
        balance: newBalance,
        userId: user.uid,
        isCash: formData.bankName === 'Cash', // Auto-detect cash accounts
        lastUpdated: serverTimestamp()
      };

      if (isEditing) {
        // UPDATE EXISTING ACCOUNT
        const oldBalance = currentBalance;
        
        // Update the account
        await updateDoc(doc(db, 'bank_accounts', accountId), bankAccountData);
        
        // Create adjustment transaction if balance changed
        if (Math.abs(newBalance - oldBalance) >= 0.01) {
          await createTransactionForBalanceChange(
            user.uid,
            accountId,
            formData.accountName,
            oldBalance,
            newBalance,
            false // not initial
          );
        }

        setSuccess(`✅ ${formData.bankName} - ${formData.accountName} updated successfully! ${
          Math.abs(newBalance - oldBalance) >= 0.01 
            ? `Balance adjusted by ₱${Math.abs(newBalance - oldBalance).toFixed(2)}` 
            : ''
        }`);

      } else {
        // CREATE NEW ACCOUNT
        const bankAccountID = `bank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create the bank account
        const bankAccountRef = doc(db, 'bank_accounts', bankAccountID);
        await setDoc(bankAccountRef, {
          bankAccountID: bankAccountID,
          ...bankAccountData,
          createdAt: serverTimestamp()
        });

        // Create initial deposit transaction if balance > 0
        if (newBalance > 0) {
          await createTransactionForBalanceChange(
            user.uid,
            bankAccountID,
            formData.accountName,
            0, // Starting from 0
            newBalance,
            true // initial deposit
          );
        }

        setSuccess(`✅ ${formData.bankName} - ${formData.accountName} added successfully! ${
          newBalance > 0 
            ? `Initial balance of ₱${newBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })} recorded.` 
            : ''
        }`);
      }
      
      // Clear form if not editing
      if (!isEditing) {
        setFormData({
          bankName: '',
          accountName: '',
          accountType: 'savings',
          initialBalance: '0'
        });
      }

      // Auto-redirect after 2 seconds
      setTimeout(() => {
        navigate('/bank-accounts');
      }, 2000);

    } catch (err) {
      console.error('Error saving bank account:', err);
      setError(err.message || `Failed to ${isEditing ? 'update' : 'add'} bank account.`);
    } finally {
      setLoading(false);
    }
  };

  const accountTypes = [
    { value: 'savings', label: 'Savings Account' },
    { value: 'checking', label: 'Checking Account' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'ewallet', label: 'E-Wallet (GCash, Maya)' },
    { value: 'investment', label: 'Investment Account' },
    { value: 'other', label: 'Other' }
  ];

  const popularBanks = [
    'BDO',
    'BPI', 
    'Metrobank',
    'Security Bank',
    'UnionBank',
    'Landbank',
    'GCash',
    'Maya',
    'CIMB',
    'Tonik',
    'Cash'  // Added cash option
  ];

  return (
    <Container maxWidth="md">
      {/* Back Button */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(isEditing ? '/bank-accounts' : '/dashboard')}
          sx={{ color: 'primary.main' }}
        >
          Back to {isEditing ? 'Bank Accounts' : 'Dashboard'}
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
              background: 'linear-gradient(45deg, #1a73e8 30%, #34a853 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1
            }}
          >
            <AccountBalanceWallet sx={{ mr: 1, verticalAlign: 'middle' }} />
            {isEditing ? 'Edit Bank Account' : 'Add Bank Account'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {isEditing ? 'Update your account details' : 'Add your bank accounts, e-wallets, or credit cards'}
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
          <Grid container spacing={3}>
            {/* Bank Name */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Business sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Bank Name</InputLabel>
                  <Select
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    label="Bank Name"
                    required
                  >
                    <MenuItem value="">
                      <em>Select a bank</em>
                    </MenuItem>
                    {popularBanks.map((bank) => (
                      <MenuItem key={bank} value={bank}>
                        {bank}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Grid>

            {/* Account Name */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Badge sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <TextField
                  fullWidth
                  label="Account Name"
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleChange}
                  variant="outlined"
                  required
                  placeholder="e.g., Main Savings, Payroll, Credit Card"
                  autoFocus={!isEditing}
                />
              </Box>
            </Grid>

            {/* Account Type */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <AccountBalance sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Account Type</InputLabel>
                  <Select
                    name="accountType"
                    value={formData.accountType}
                    onChange={handleChange}
                    label="Account Type"
                  >
                    {accountTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Grid>

            {/* Initial/Balance */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={isEditing ? "Current Balance (₱)" : "Initial Balance (₱)"}
                name="initialBalance"
                type="number"
                value={formData.initialBalance}
                onChange={handleChange}
                variant="outlined"
                InputProps={{
                  inputProps: { 
                    min: 0,
                    step: 0.01 
                  }
                }}
                placeholder="0.00"
                helperText={
                  isEditing 
                    ? "Changing balance will create adjustment transaction" 
                    : "Opening balance > ₱0 will create initial deposit transaction"
                }
              />
            </Grid>

            {/* Submit Button */}
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
                {loading ? (isEditing ? 'Updating...' : 'Adding Account...') : (isEditing ? 'Update Account' : 'Add Bank Account')}
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
            💡 <strong>Important:</strong> {isEditing 
              ? 'Updating the balance will create a balance adjustment transaction in your history.'
              : 'If you enter an initial balance > ₱0, an "initial deposit" transaction will be automatically created.'}
          </Typography>
          {!isEditing && (
            <Typography variant="body2" color="info.contrastText" sx={{ mt: 1 }}>
              For cash accounts, select "Cash" as the bank name.
            </Typography>
          )}
        </Box>
      </Paper>
    </Container>
  );
}

export default BankAccountForm;