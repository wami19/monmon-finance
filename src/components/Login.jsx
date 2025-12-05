// src/components/Login.jsx
import { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { 
  TextField, 
  Button, 
  Container, 
  Typography, 
  Box, 
  Alert,
  Paper 
} from '@mui/material';
import { AccountCircle, Lock } from '@mui/icons-material';
import monMonLogo from '../assets/MonMon-logo-v2.png';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = '/dashboard';
    } catch (err) {
        setError(err.message);
        console.error('Login error:', err);
    } finally {
        setLoading(false);
    }
    };

  return (
    <Container maxWidth="sm">
      <Paper 
        elevation={3}
        sx={{ 
          mt: 8, 
          p: 4, 
          borderRadius: 3,
          background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
          border: '1px solid #e8eaed'
        }}
      >
        {/* Logo Image */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <img 
            src={monMonLogo}
            alt="MonMon Logo" 
            style={{ 
              width: '120px', 
              height: 'auto',
              borderRadius: '12px'
            }}
          />
        </Box>
        
        {/* Title with Blue-Green Gradient */}
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom 
          align="center"
          sx={{ 
            fontWeight: 'bold',
            background: 'linear-gradient(45deg, #1a73e8 30%, #34a853 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            mb: 1
          }}
        >
          MonMon Login
        </Typography>
        
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3 }}>
          Secure Money Monitoring • Blue for Trust, Green for Growth
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <form onSubmit={handleLogin}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 2 }}>
            <AccountCircle sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              variant="outlined"
              required
              placeholder="you@example.com"
            />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 3 }}>
            <Lock sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              variant="outlined"
              required
              placeholder="Enter your password"
            />
          </Box>
          
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ 
              mt: 2, 
              py: 1.5,
              fontWeight: 'bold',
              borderRadius: 2
            }}
          >
            {loading ? 'Logging in...' : 'Login to Dashboard'}
          </Button>
        </form>
        
        {/* Signup Link */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{' '}
            <a 
              href="/signup" 
              style={{ 
                color: '#1a73e8', 
                fontWeight: 'bold',
                textDecoration: 'none'
              }}
            >
              Sign up here
            </a>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default Login;