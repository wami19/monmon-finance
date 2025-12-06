// src/components/DebtList.jsx - UPDATED WITH TRANSACTION RECORDING
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
  LinearProgress,
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import { 
  ArrowBack,
  AccountBalanceWallet,
  Add,
  TrendingUp,
  TrendingDown,
  CalendarToday,
  AttachMoney,
  Edit,
  Delete
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

function DebtList() {
  const navigate = useNavigate();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalDebt, setTotalDebt] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    debtId: null,
    debtName: '',
    debtBalance: 0
  });

  useEffect(() => {
    fetchDebts();
  }, []);

  const fetchDebts = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }

      const debtsQuery = query(
        collection(db, 'debts'),
        where('userId', '==', user.uid)
      );
      const querySnapshot = await getDocs(debtsQuery);
      
      const debtsArray = [];
      let total = 0;
      let paid = 0;
      
      querySnapshot.forEach((doc) => {
        const debt = { id: doc.id, ...doc.data() };
        debtsArray.push(debt);
        total += debt.totalAmnt || 0;
        paid += (debt.totalAmnt || 0) - (debt.currentBal || 0);
      });
      
      // Sort by deadline (closest first)
      debtsArray.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
      
      setDebts(debtsArray);
      setTotalDebt(total);
      setTotalPaid(paid);
    } catch (error) {
      console.error('Error fetching debts:', error);
      setError('Failed to load debts');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (debtId, debtName, debtBalance) => {
    setDeleteDialog({
      open: true,
      debtId,
      debtName,
      debtBalance: debtBalance || 0
    });
  };

  const handleCloseDialog = () => {
    setDeleteDialog({
      open: false,
      debtId: null,
      debtName: '',
      debtBalance: 0
    });
  };

  const createDebtDeletionTransaction = async (userId, debtId, debtData) => {
    const debtBalance = debtData.currentBal || 0;
    const debtName = debtData.debtName || 'Unknown Debt';
    const totalAmount = debtData.totalAmnt || 0;
    
    // Only create transaction if there's a remaining balance
    if (debtBalance <= 0) return null;

    // Generate transaction ID (matches your pattern)
    const transactionId = `txn_deld_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 1. Create transaction document
    const transactionData = {
      transacID: transactionId,
      amount: debtBalance,
      description: `Debt Forgiveness: ${debtName}`,
      transacDate: serverTimestamp(),
      userId: userId,
      paymentMethodID: 'debt_forgiveness', // Special payment method for debt deletion
      bankAccountID: 'cash', // Default to cash since debt forgiveness doesn't affect bank accounts
      transactionType: 'IN', // Debt forgiveness is INCOME (money you don't have to pay anymore!)
      createdAt: serverTimestamp(),
      category: 'debt_forgiveness',
      tags: ['system', 'debt_deletion']
    };

    await addDoc(collection(db, 'transactions'), transactionData);

    // 2. Create money_in record (since debt forgiveness is positive)
    await addDoc(collection(db, 'money_in'), {
      transacID: transactionId,
      sourceType: 'debt_forgiveness',
      debtID: debtId,
      userId: userId,
      createdAt: serverTimestamp(),
      notes: `Debt ${debtName} was forgiven/removed. Original: ₱${totalAmount.toFixed(2)}, Remaining: ₱${debtBalance.toFixed(2)}`
    });

    // 3. Create debt_audit trail
    await addDoc(collection(db, 'debt_audits'), {
      debtID: debtId,
      previousBalance: debtBalance,
      newBalance: 0,
      transactionId: transactionId,
      changeAmount: debtBalance,
      changeType: 'DEBT_FORGIVENESS',
      userId: userId,
      updatedAt: serverTimestamp(),
      description: `Debt ${debtName} deleted/forgiven`
    });

    return transactionId;
  };

  const deleteRelatedDebtPayments = async (debtId, userId) => {
    try {
      // Optional: Delete related debt_payments
      const paymentsQuery = query(
        collection(db, 'debt_payments'),
        where('userId', '==', userId),
        where('debtID', '==', debtId)
      );
      
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      const batch = writeBatch(db);
      
      paymentsSnapshot.forEach((paymentDoc) => {
        batch.delete(paymentDoc.ref);
      });
      
      if (paymentsSnapshot.size > 0) {
        await batch.commit();
        console.log(`Deleted ${paymentsSnapshot.size} related debt payments`);
      }
    } catch (error) {
      console.error('Error deleting related debt payments:', error);
      // Don't fail the whole operation if this fails
    }
  };

  const handleDeleteDebt = async () => {
    const { debtId, debtName, debtBalance } = deleteDialog;
    
    if (!debtId) return;

    try {
      setLoading(true);
      
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }

      // 1. Get debt data first
      const debtRef = doc(db, 'debts', debtId);
      const debtDoc = await getDoc(debtRef);
      
      if (!debtDoc.exists()) {
        throw new Error('Debt not found');
      }

      const debtData = debtDoc.data();

      // 2. Create a deletion transaction (if there's remaining balance)
      let transactionId = null;
      if (debtBalance > 0) {
        transactionId = await createDebtDeletionTransaction(user.uid, debtId, debtData);
      }

      // 3. Delete related debt payments (optional - comment out to keep history)
      // await deleteRelatedDebtPayments(debtId, user.uid);

      // 4. Delete the debt
      await deleteDoc(debtRef);

      // 5. Close dialog and refresh
      handleCloseDialog();
      await fetchDebts();
      
      // Show success message
      setError(`✅ Debt "${debtName}" deleted successfully. ${
        debtBalance > 0 
          ? `Transaction recorded for ₱${debtBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}.` 
          : ''
      }`);
      setTimeout(() => setError(''), 3000);

    } catch (error) {
      console.error('Error deleting debt:', error);
      setError(`Failed to delete debt: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = (debt) => {
    if (!debt.totalAmnt) return 0;
    const paid = debt.totalAmnt - (debt.currentBal || 0);
    return (paid / debt.totalAmnt) * 100;
  };

  const getDaysRemaining = (deadline) => {
    const now = new Date();
    const dueDate = new Date(deadline);
    const diffTime = dueDate - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (debt) => {
    const daysRemaining = getDaysRemaining(debt.deadline);
    if (debt.currentBal <= 0) return 'success';
    if (daysRemaining < 0) return 'error';
    if (daysRemaining < 7) return 'warning';
    return 'primary';
  };

  const getStatusText = (debt) => {
    const daysRemaining = getDaysRemaining(debt.deadline);
    if (debt.currentBal <= 0) return 'Paid Off';
    if (daysRemaining < 0) return 'Overdue';
    if (daysRemaining < 7) return 'Due Soon';
    return 'Active';
  };

  // FIXED: Make payment navigation
  const handleMakePayment = (debt) => {
    navigate('/money-out', { 
      state: { 
        selectedDebtId: debt.id,
        presetCategory: 'debt_payment',
        presetAmount: Math.min(debt.currentBal, 1000) // Suggest smaller payment
      }
    });
  };

  if (loading && debts.length === 0) {
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
            <TrendingUp sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                My Debts
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Track and manage your debts
              </Typography>
            </Box>
          </Box>
          
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={() => navigate('/add-debt')}
            sx={{ borderRadius: 2 }}
          >
            Add New Debt
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

      {/* Summary Cards - FIXED GRID LAYOUT */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ borderRadius: 3, boxShadow: 2, borderTop: '4px solid #ea4335', height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Total Debt
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                    ₱{totalDebt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ borderRadius: 3, boxShadow: 2, borderTop: '4px solid #34a853', height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingDown sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Total Paid
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    ₱{totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ borderRadius: 3, boxShadow: 2, borderTop: '4px solid #1a73e8', height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountBalanceWallet sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Active Debts
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {debts.filter(d => d.currentBal > 0).length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Debts List */}
      {debts.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <TrendingUp sx={{ fontSize: 60, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Debts Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Add your first debt to start tracking
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/add-debt')}
            sx={{ borderRadius: 2 }}
          >
            Add Your First Debt
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {debts.map((debt) => {
            const progress = getProgressPercentage(debt);
            const daysRemaining = getDaysRemaining(debt.deadline);
            const statusColor = getStatusColor(debt);
            const statusText = getStatusText(debt);

            return (
              <Grid item xs={12} sm={6} md={4} key={debt.id}>
                <Card sx={{ 
                  borderRadius: 3, 
                  boxShadow: 2,
                  height: '100%',
                  borderTop: `4px solid ${statusColor === 'success' ? '#34a853' : statusColor === 'error' ? '#ea4335' : statusColor === 'warning' ? '#fbbc05' : '#1a73e8'}`,
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}>
                  <CardContent>
                    {/* Debt Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                          {debt.debtName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {debt.description || 'No description'}
                        </Typography>
                      </Box>
                      <Chip 
                        label={statusText}
                        color={statusColor}
                        size="small"
                      />
                    </Box>

                    {/* Amounts */}
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Total Amount:
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          ₱{(debt.totalAmnt || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Remaining:
                        </Typography>
                        <Typography variant="body2" fontWeight="bold" color="error.main">
                          ₱{(debt.currentBal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Paid:
                        </Typography>
                        <Typography variant="body2" fontWeight="bold" color="success.main">
                          ₱{((debt.totalAmnt || 0) - (debt.currentBal || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Progress Bar */}
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Progress
                        </Typography>
                        <Typography variant="caption" fontWeight="bold">
                          {progress.toFixed(1)}%
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={progress} 
                        sx={{ 
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: progress === 100 ? '#34a853' : '#1a73e8'
                          }
                        }}
                      />
                    </Box>

                    {/* Deadline & Interest */}
                    <Grid container spacing={1} sx={{ mb: 3 }}>
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CalendarToday sx={{ fontSize: 16, color: 'text.secondary', mr: 1 }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Deadline
                            </Typography>
                            <Typography variant="body2">
                              {new Date(debt.deadline).toLocaleDateString('en-PH')}
                            </Typography>
                            <Typography variant="caption" color={daysRemaining < 0 ? 'error.main' : 'text.secondary'}>
                              {daysRemaining < 0 ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days left`}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <AttachMoney sx={{ fontSize: 16, color: 'text.secondary', mr: 1 }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Interest Rate
                            </Typography>
                            <Typography variant="body2">
                              {(debt.interest || 0).toFixed(2)}%
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        onClick={() => handleMakePayment(debt)}
                        disabled={debt.currentBal <= 0}
                      >
                        Make Payment
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/edit-debt/${debt.id}`)}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(debt.id, debt.debtName, debt.currentBal)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Stats Summary */}
      {debts.length > 0 && (
        <Paper sx={{ p: 3, mt: 4, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Debt Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Total Debts
              </Typography>
              <Typography variant="h6">{debts.length}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Active Debts
              </Typography>
              <Typography variant="h6">{debts.filter(d => d.currentBal > 0).length}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Paid Off
              </Typography>
              <Typography variant="h6">{debts.filter(d => d.currentBal <= 0).length}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Overdue
              </Typography>
              <Typography variant="h6" color="error.main">
                {debts.filter(d => getDaysRemaining(d.deadline) < 0 && d.currentBal > 0).length}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={handleCloseDialog}
      >
        <DialogTitle>Delete Debt</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteDialog.debtName}</strong>?
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, color: 'black', bgcolor: 'warning.light', p: 2, borderRadius: 1 }}>
            ⚠️ <strong>Important:</strong> This action will:
            <ul style={{ marginTop: '8px', marginBottom: '8px' }}>
              <li>Permanently delete this debt record</li>
              <li>
                {deleteDialog.debtBalance > 0 
                  ? `Record a "debt forgiveness" transaction for ₱${deleteDialog.debtBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })} (treated as INCOME)`
                  : 'No transaction will be recorded (already paid off)'
                }
              </li>
              { /* <li>Remove all related payment history</li> */}
              <li><strong>This means the debt is forgiven/written off</strong></li>
            </ul>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteDebt}
            color="error"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <Delete />}
          >
            {loading ? 'Deleting...' : 'Delete Debt'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default DebtList;