// src/components/DebtForm.jsx - COMPLETE FIXED VERSION
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
  Grid,
  InputAdornment
} from '@mui/material';
import { 
  ArrowBack,
  TrendingUp,
  Description,
  CalendarToday,
  AttachMoney,
  Percent
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';

function DebtForm() {
  const navigate = useNavigate();
  const { debtId } = useParams();
  const isEditing = !!debtId;

  const [formData, setFormData] = useState({
    debtName: '',
    description: '',
    totalAmnt: '',
    currentBal: '',
    interest: '0',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // FIXED: Use useEffect to fetch data when component mounts
  useEffect(() => {
    if (isEditing) {
      fetchDebtData();
    }
  }, [isEditing, debtId]);

  const fetchDebtData = async () => {
    try {
      const debtDoc = await getDoc(doc(db, 'debts', debtId));
      if (debtDoc.exists()) {
        const debt = debtDoc.data();
        setFormData({
          debtName: debt.debtName || '',
          description: debt.description || '',
          totalAmnt: debt.totalAmnt || '',
          currentBal: debt.currentBal || '',
          interest: debt.interest || '0',
          deadline: debt.deadline ? new Date(debt.deadline).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
      }
    } catch (error) {
      console.error('Error fetching debt:', error);
      setError('Failed to load debt data');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // If editing total amount and current balance is empty, auto-set current balance
    if (name === 'totalAmnt' && !isEditing && !formData.currentBal && value) {
      setFormData(prev => ({
        ...prev,
        currentBal: value
      }));
    }
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

      // Validation
      if (!formData.debtName.trim()) {
        throw new Error('Please enter debt name');
      }

      if (!formData.totalAmnt || parseFloat(formData.totalAmnt) <= 0) {
        throw new Error('Please enter a valid total amount');
      }

      if (!formData.currentBal || parseFloat(formData.currentBal) < 0) {
        throw new Error('Please enter a valid current balance');
      }

      if (parseFloat(formData.currentBal) > parseFloat(formData.totalAmnt)) {
        throw new Error('Current balance cannot exceed total amount');
      }

      // Create base debt data
      const debtData = {
        debtName: formData.debtName,
        description: formData.description,
        totalAmnt: parseFloat(formData.totalAmnt),
        currentBal: parseFloat(formData.currentBal),
        interest: parseFloat(formData.interest) || 0,
        deadline: new Date(formData.deadline).toISOString(),
        userId: user.uid,
        updatedAt: serverTimestamp()
      };

      if (isEditing) {
        // Update existing debt - DON'T include createdAt
        await updateDoc(doc(db, 'debts', debtId), debtData);
        setSuccess('✅ Debt updated successfully!');
      } else {
        // Create new debt - include createdAt
        const newDebtId = `debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await addDoc(collection(db, 'debts'), {
          debtID: newDebtId,
          ...debtData,
          createdAt: serverTimestamp()
        });
        setSuccess('✅ Debt created successfully!');
      }

      // Auto-redirect after 2 seconds
      setTimeout(() => {
        navigate('/debts');
      }, 2000);

    } catch (err) {
      console.error('Error saving debt:', err);
      setError(err.message || `Failed to ${isEditing ? 'update' : 'create'} debt`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      {/* Back Button */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/debts')}
          sx={{ color: 'primary.main' }}
        >
          Back to Debts
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
            <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
            {isEditing ? 'Edit Debt' : 'Add New Debt'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {isEditing ? 'Update your debt details' : 'Track loans, credit card debt, or any money you owe'}
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
            {/* Debt Name */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Debt Name"
                name="debtName"
                value={formData.debtName}
                onChange={handleChange}
                variant="outlined"
                required
                placeholder="e.g., Car Loan, Credit Card, Personal Loan"
                autoFocus={!isEditing}
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Description sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <TextField
                  fullWidth
                  label="Description (Optional)"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  variant="outlined"
                  multiline
                  rows={2}
                  placeholder="Add any notes about this debt"
                />
              </Box>
            </Grid>

            {/* Total Amount */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <AttachMoney sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <TextField
                  fullWidth
                  label="Total Amount (₱)"
                  name="totalAmnt"
                  type="number"
                  value={formData.totalAmnt}
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

            {/* Current Balance */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Current Balance (₱)"
                name="currentBal"
                type="number"
                value={formData.currentBal}
                onChange={handleChange}
                variant="outlined"
                required
                InputProps={{
                  inputProps: { 
                    min: 0,
                    step: 0.01 
                  }
                }}
                placeholder="0.00"
                helperText="Amount still owed"
              />
            </Grid>

            {/* Interest Rate */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Percent sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <TextField
                  fullWidth
                  label="Interest Rate (%)"
                  name="interest"
                  type="number"
                  value={formData.interest}
                  onChange={handleChange}
                  variant="outlined"
                  InputProps={{
                    inputProps: { 
                      min: 0,
                      step: 0.01,
                      max: 100
                    },
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  }}
                  placeholder="0.00"
                />
              </Box>
            </Grid>

            {/* Deadline */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <CalendarToday sx={{ color: 'action.active', mr: 1, mt: 2.5 }} />
                <TextField
                  fullWidth
                  label="Deadline"
                  name="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={handleChange}
                  variant="outlined"
                  required
                  InputLabelProps={{
                    shrink: true,
                  }}
                  InputProps={{
                    inputProps: {
                      min: new Date().toISOString().split('T')[0]
                    }
                  }}
                />
              </Box>
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
                  mt: 2,
                  background: 'linear-gradient(135deg, #1a73e8 0%, #ea4335 100%)'
                }}
              >
                {loading ? 'Saving...' : (isEditing ? 'Update Debt' : 'Create Debt')}
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
            💡 <strong>Note:</strong> This debt will appear in your debt list. 
            You can make payments by selecting "debt_payment" category in Money Out form.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default DebtForm;