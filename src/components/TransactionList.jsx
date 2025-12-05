// src/components/TransactionList.jsx
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  TablePagination,
  Chip,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';
import { 
  ArrowBack,
  Search,
  FilterList,
  ArrowUpward,
  ArrowDownward,
  AccountBalanceWallet,
  CalendarToday
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

function TransactionList() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'IN', 'OUT'
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, searchTerm, filterType, dateFilter]);

  const fetchTransactions = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }

      // Fetch transactions
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      // Fetch money_in and money_out records
      const moneyInQuery = query(
        collection(db, 'money_in'),
        where('userId', '==', user.uid)
      );
      const moneyOutQuery = query(
        collection(db, 'money_out'),
        where('userId', '==', user.uid)
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
      const allTransactions = [];
      
      for (const transactionDoc of transactionsSnapshot.docs) {
        const transaction = transactionDoc.data();
        
        // Get transaction date
        let transacDate;
        if (transaction.createdAt) {
          transacDate = transaction.createdAt.toDate();
        } else if (transaction.transacDate) {
          if (typeof transaction.transacDate === 'string') {
            transacDate = new Date(transaction.transacDate);
          } else if (transaction.transacDate.toDate) {
            transacDate = transaction.transacDate.toDate();
          } else {
            transacDate = new Date();
          }
        } else {
          transacDate = new Date();
        }
        
        // Get category
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
        }
        
        allTransactions.push({
          id: transactionDoc.id,
          description: transaction.description,
          amount: transaction.amount,
          type: transaction.transactionType,
          date: transacDate,
          formattedDate: transacDate.toLocaleDateString('en-PH'),
          formattedTime: transacDate.toLocaleTimeString('en-PH', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }),
          category: category,
          paymentMethod: paymentMethod,
          bankAccountID: transaction.bankAccountID,
          timestamp: transacDate.getTime()
        });
      }
      
      setTransactions(allTransactions);
      setFilteredTransactions(allTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    let filtered = [...transactions];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }
    
    // Apply date filter (YYYY-MM format)
    if (dateFilter) {
      filtered = filtered.filter(t => {
        const transactionDate = t.date;
        const filterDate = new Date(dateFilter);
        return transactionDate.getFullYear() === filterDate.getFullYear() &&
               transactionDate.getMonth() === filterDate.getMonth();
      });
    }
    
    setFilteredTransactions(filtered);
    setPage(0); // Reset to first page when filtering
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getTypeColor = (type) => {
    return type === 'IN' ? 'success' : 'error';
  };

  const getTypeIcon = (type) => {
    return type === 'IN' ? 
      <ArrowUpward sx={{ fontSize: 16, color: 'success.main' }} /> : 
      <ArrowDownward sx={{ fontSize: 16, color: 'error.main' }} />;
  };

  const getTypeText = (type) => {
    return type === 'IN' ? 'Income' : 'Expense';
  };

  const formatAmount = (amount, type) => {
    const formatted = `₱${Math.abs(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    return type === 'IN' ? `+${formatted}` : `-${formatted}`;
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
                All Transactions
              </Typography>
              <Typography variant="body1" color="text.secondary">
                View and filter your transaction history
              </Typography>
            </Box>
          </Box>
          
          <Button
            variant="contained"
            onClick={() => navigate('/dashboard')}
            sx={{ borderRadius: 2 }}
          >
            Back to Dashboard
          </Button>
        </Box>
      </Box>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Summary Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Total Transactions
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {transactions.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Income Transactions
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
              {transactions.filter(t => t.type === 'IN').length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Expense Transactions
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'error.main' }}>
              {transactions.filter(t => t.type === 'OUT').length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Filtered
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              {filteredTransactions.length}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          <FilterList sx={{ mr: 1, verticalAlign: 'middle' }} />
          Filters
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search Transactions"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              placeholder="Search by description or category"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Transaction Type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              SelectProps={{
                native: true,
              }}
            >
              <option value="all">All Transactions</option>
              <option value="IN">Income Only</option>
              <option value="OUT">Expenses Only</option>
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Filter by Month"
              type="month"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarToday />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            size="small"
            onClick={() => {
              setSearchTerm('');
              setFilterType('all');
              setDateFilter('');
            }}
          >
            Clear Filters
          </Button>
          <Button 
            variant="contained" 
            size="small"
            onClick={fetchTransactions}
          >
            Refresh
          </Button>
        </Box>
      </Paper>

      {/* Transactions Table */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.light' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date & Time</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Description</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Category</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Payment Method</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <AccountBalanceWallet sx={{ fontSize: 60, color: 'grey.300', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      No transactions found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {searchTerm || filterType !== 'all' || dateFilter 
                        ? 'Try changing your filters' 
                        : 'Add your first transaction to get started'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((transaction) => (
                    <TableRow 
                      key={transaction.id}
                      hover
                      sx={{ 
                        '&:last-child td, &:last-child th': { border: 0 },
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}
                      onClick={() => {
                        // You could add a transaction detail view later
                        console.log('View transaction:', transaction.id);
                      }}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {transaction.formattedDate}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {transaction.formattedTime}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {transaction.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={transaction.category}
                          size="small"
                          sx={{ 
                            backgroundColor: transaction.type === 'IN' 
                              ? 'rgba(52, 168, 83, 0.1)' 
                              : 'rgba(234, 67, 53, 0.1)',
                            color: transaction.type === 'IN' 
                              ? 'success.main' 
                              : 'error.main'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getTypeIcon(transaction.type)}
                          <Typography variant="body2">
                            {getTypeText(transaction.type)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={transaction.paymentMethod}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontWeight: 'bold',
                            color: getTypeColor(transaction.type)
                          }}
                        >
                          {formatAmount(transaction.amount, transaction.type)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredTransactions.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{ borderTop: '1px solid #e8eaed' }}
        />
      </Paper>

      {/* Quick Stats */}
      {filteredTransactions.length > 0 && (
        <Paper sx={{ p: 3, mt: 4, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Transaction Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Total Income
              </Typography>
              <Typography variant="h6" color="success.main" fontWeight="bold">
                ₱{filteredTransactions
                  .filter(t => t.type === 'IN')
                  .reduce((sum, t) => sum + t.amount, 0)
                  .toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Total Expenses
              </Typography>
              <Typography variant="h6" color="error.main" fontWeight="bold">
                ₱{filteredTransactions
                  .filter(t => t.type === 'OUT')
                  .reduce((sum, t) => sum + t.amount, 0)
                  .toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Net Balance
              </Typography>
              <Typography 
                variant="h6" 
                fontWeight="bold"
                color={
                  filteredTransactions
                    .filter(t => t.type === 'IN')
                    .reduce((sum, t) => sum + t.amount, 0) -
                  filteredTransactions
                    .filter(t => t.type === 'OUT')
                    .reduce((sum, t) => sum + t.amount, 0) >= 0
                    ? 'success.main'
                    : 'error.main'
                }
              >
                ₱{(filteredTransactions
                  .filter(t => t.type === 'IN')
                  .reduce((sum, t) => sum + t.amount, 0) -
                  filteredTransactions
                    .filter(t => t.type === 'OUT')
                    .reduce((sum, t) => sum + t.amount, 0))
                  .toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                Average per Transaction
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                ₱{(filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / filteredTransactions.length)
                  .toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Container>
  );
}

export default TransactionList;