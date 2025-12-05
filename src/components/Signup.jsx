// src/components/Signup.jsx
import { useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { 
  TextField, 
  Button, 
  Container, 
  Typography, 
  Box, 
  Alert,
  Paper,
  Link
} from '@mui/material';
import { 
  AccountCircle, 
  Lock, 
  Person, 
  Email,
  ArrowBack
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

function Signup() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    console.log('1. Starting signup with:', formData.email); // Debug

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
        console.log('2. Creating Firebase auth user...'); // Debug
        const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
        );
        
        const user = userCredential.user;
        console.log('3. Auth user created:', user.uid); // Debug
        
      // 2. Create user document in Firestore (matching your USER entity)
      console.log('4. Creating Firestore user document...'); // Debug
      await setDoc(doc(db, 'users', user.uid), {
        userId: user.uid,
        surName: formData.lastName,
        givName: formData.firstName,
        emailAd: formData.email,
        userName: formData.email.split('@')[0], // simple username from email
        userType: 'Regular', // Admin/Regular as per your design
        createdAt: new Date().toISOString()
      });

       console.log('5. User document created'); // Debug

      // 3. Create a default "Cash on Hand" bank account
      console.log('6. Creating Cash on Hand account...'); // Debug
      await setDoc(doc(db, 'bank_accounts', `cash_${user.uid}`), {
        bankAccountID: `cash_${user.uid}`,
        bankName: 'Cash',
        accountName: 'Cash on Hand',
        accountType: 'Cash',
        balance: 0,
        userId: user.uid,
        isCash: true,
        createdAt: new Date().toISOString()
      });
      console.log('7. Cash account created'); // Debug

      setSuccess('🎉 Account created successfully! Redirecting to login...');
      
      // Clear form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);

    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper 
        elevation={3}
        sx={{ 
          mt: 4, 
          p: 4, 
          borderRadius: 3,
          background: 'linear-gradient(145deg, #ffffff, #f8f9fa)'
        }}
      >
        {/* Back to Login Link */}
        <Box sx={{ mb: 3 }}>
          <Link 
            component={RouterLink} 
            to="/login" 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              textDecoration: 'none',
              color: 'primary.main'
            }}
          >
            <ArrowBack sx={{ mr: 1 }} />
            Back to Login
          </Link>
        </Box>

        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography 
            variant="h4" 
            component="h1"
            sx={{ 
              color: 'primary.main', 
              fontWeight: 'bold',
              mb: 1
            }}
          >
            Create MonMon Account
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Start tracking your finances today
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

        {/* Signup Form */}
        <form onSubmit={handleSignup}>
          {/* First & Last Name Row */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <Person sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
              <TextField
                fullWidth
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                variant="outlined"
                required
                size="small"
              />
            </Box>
            
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <Person sx={{ color: 'action.active', mr: 1, my: 0.5, opacity: 0 }} />
              <TextField
                fullWidth
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                variant="outlined"
                required
                size="small"
              />
            </Box>
          </Box>

          {/* Email */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 2 }}>
            <Email sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              variant="outlined"
              required
              size="small"
            />
          </Box>

          {/* Password */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 2 }}>
            <Lock sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
            <TextField
              fullWidth
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              variant="outlined"
              required
              size="small"
              helperText="At least 6 characters"
            />
          </Box>

          {/* Confirm Password */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 3 }}>
            <Lock sx={{ color: 'action.active', mr: 1, my: 0.5, opacity: 0 }} />
            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              variant="outlined"
              required
              size="small"
            />
          </Box>

          {/* Submit Button */}
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
              borderRadius: 2
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>

        {/* Already have account */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Already have an account?{' '}
            <Link 
              component={RouterLink} 
              to="/login"
              sx={{ fontWeight: 'bold' }}
            >
              Login here
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default Signup;