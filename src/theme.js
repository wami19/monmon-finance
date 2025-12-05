// src/theme.js
import { createTheme } from '@mui/material/styles';

const monMonTheme = createTheme({
  palette: {
    primary: {
      main: '#1a73e8', // Google blue - represents trust/security
      light: '#4285f4',
      dark: '#0d47a1',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#34a853', // Google green - represents money/growth
      light: '#5bb974',
      dark: '#0d652d',
      contrastText: '#ffffff',
    },
    success: {
      main: '#34a853', // Green for positive
      light: '#5bb974',
      dark: '#0d652d',
    },
    error: {
      main: '#ea4335', // Red for negative
    },
    warning: {
      main: '#fbbc05', // Yellow/orange
    },
    info: {
      main: '#4285f4', // Blue for info
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#202124',
      secondary: '#5f6368',
    },
  },
  typography: {
    fontFamily: '"Google Sans", "Roboto", "Inter", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      color: '#1a73e8',
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)', // Blue gradient
          '&:hover': {
            background: 'linear-gradient(135deg, #0d47a1 0%, #1a73e8 100%)',
            boxShadow: '0 4px 12px rgba(26, 115, 232, 0.3)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #34a853 0%, #5bb974 100%)', // Green gradient
          '&:hover': {
            background: 'linear-gradient(135deg, #0d652d 0%, #34a853 100%)',
            boxShadow: '0 4px 12px rgba(52, 168, 83, 0.3)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #1a73e8 0%, #34a853 100%)', // Blue to Green!
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e8eaed',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '&.Mui-focused fieldset': {
              borderColor: '#1a73e8',
            },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
        standardSuccess: {
          backgroundColor: 'rgba(52, 168, 83, 0.1)',
          border: '1px solid #34a853',
        },
        standardError: {
          backgroundColor: 'rgba(234, 67, 53, 0.1)',
          border: '1px solid #ea4335',
        },
      },
    },
  },
});

export default monMonTheme;