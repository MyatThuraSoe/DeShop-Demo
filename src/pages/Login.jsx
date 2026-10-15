import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  AdminPanelSettings as AdminIcon,
  ManageAccounts as ManagerIcon,
  PointOfSale as CashierIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const ROLE_BUTTONS = [
  {
    role: 'ADMIN',
    labelKey: 'auth:login_as_admin',
    username: 'admin',
    password: 'admin123',
    icon: <AdminIcon />,
    color: 'primary',
    variant: 'contained',
    buttonSize: 'large',
    py: 1.8,
    fontSize: '1.05rem',
  },
  {
    role: 'MANAGER',
    labelKey: 'auth:login_as_manager',
    username: 'manager',
    password: 'manager123',
    icon: <ManagerIcon />,
    color: 'secondary',
    variant: 'contained',
    buttonSize: 'medium',
    py: 1.25,
    fontSize: '1rem',
  },
  {
    role: 'CASHIER',
    labelKey: 'auth:login_as_cashier',
    username: 'cashier',
    password: 'cashier123',
    icon: <CashierIcon />,
    color: 'primary',
    variant: 'outlined',
    buttonSize: 'small',
    py: 0.9,
    fontSize: '0.9rem',
  },
];

const Login = () => {
  const [error, setError] = useState('');
  const [loadingRole, setLoadingRole] = useState(null);
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleQuickLogin = async (account) => {
    setError('');
    setLoadingRole(account.role);
    try {
      const response = await login(account.username, account.password);
      const user = response?.data?.user;
      const roles = user?.roles?.map((r) => r?.name).filter(Boolean) || [];
      const isOnlyCashier = roles.includes('CASHIER') && !roles.some((r) => r === 'ADMIN' || r === 'MANAGER');
      navigate(isOnlyCashier ? '/pos' : '/dashboard');
    } catch (err) {
      const backendMessage = err?.response?.data?.message || err?.response?.data?.error?.message;
      setError(backendMessage || err.message || t('auth:login_failed'));
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(28,38,32,0.06) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageSwitcher compact />
      </Box>
      <Container maxWidth="xs">
        <Paper
          elevation={0}
          sx={{
            p: 4,
            width: '100%',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Box
              sx={{
                width: 56, height: 56, borderRadius: 2, bgcolor: 'primary.main',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                mx: 'auto', mb: 2, fontFamily: '"Fraunces", serif', fontSize: '1.75rem', fontWeight: 700,
              }}
            >
              S
            </Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              {t('auth:sign_in_title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('auth:select_role')}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Alert severity="info" sx={{ width: '100%', mb: 2, borderRadius: 2 }}>
            {t('auth:demo_hint')}
          </Alert>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {ROLE_BUTTONS.map((btn) => {
              const isLoading = loadingRole === btn.role;
              return (
                <Button
                  key={btn.role}
                  fullWidth
                  variant={btn.variant}
                  color={btn.color}
                  size={btn.buttonSize}
                  startIcon={isLoading ? undefined : btn.icon}
                  onClick={() => handleQuickLogin(btn)}
                  disabled={loadingRole !== null}
                  sx={{
                    py: btn.py,
                    fontSize: btn.fontSize,
                    fontWeight: btn.role === 'ADMIN' ? 700 : 600,
                    borderRadius: 2,
                  }}
                >
                  {isLoading ? <CircularProgress size={22} color="inherit" /> : t(btn.labelKey)}
                </Button>
              );
            })}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;