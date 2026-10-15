import { useTranslation } from 'react-i18next';
import { 
  Box, Typography, Paper, Button, Chip, Divider, Stack, Avatar, Link as MuiLink 
} from '@mui/material';
import { 
  Info as InfoIcon, 
  LinkedIn as LinkedInIcon, 
  GitHub as GitHubIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Update as UpdateIcon
} from '@mui/icons-material';

const DEV_LINKEDIN = 'https://www.linkedin.com/in/myatthurasoe';
const DEV_GITHUB = 'https://github.com/MyatThuraSoe';
const DEV_EMAIL = 'myatthu.dev@gmail.com';
const DEV_PHONE = '+959776697907';

const About = () => {
  const { t } = useTranslation('about');
  const appVersion = '1.0.0';
  const buildDate = 'August 2025';

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, md: 4 } }}>
      {/* Header Card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 5 },
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(19, 44, 78, 0.04) 0%, rgba(138, 28, 43, 0.04) 100%)',
        }}
      >
        <Box
          component="img"
          src="/DeShop.ico"
          alt="DeShop logo"
          sx={{
            width: 80,
            height: 80,
            mx: 'auto',
            mb: 3,
            display: 'block',
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(43, 110, 79, 0.3)',
          }}
        />

        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 600,
            mb: 1,
            background: 'linear-gradient(135deg, #132C4E 0%, #8A1C2B 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          DeShop
        </Typography>

        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>
          {t('tagline')}
        </Typography>

        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
          <Chip
            icon={<UpdateIcon />}
            label={t('version_chip', { version: appVersion })}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
          <Chip
            label={t('built_chip', { date: buildDate })}
            variant="outlined"
            sx={{ color: 'text.secondary' }}
          />
        </Stack>
      </Paper>

      {/* Developer Info Card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
          <Avatar sx={{ width: 44, height: 44, bgcolor: 'primary.main', fontWeight: 600 }}>
            MT
          </Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {t('dev_name')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('dev_role')}
            </Typography>
          </Box>
        </Stack>

        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8, color: 'text.primary' }}>
          {t('intro_1')}
        </Typography>

        <Typography variant="body1" sx={{ lineHeight: 1.8, color: 'text.primary' }}>
          {t('intro_2')}
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          {t('connect')}
        </Typography>

        <Stack spacing={2}>
          <Button
            component={MuiLink}
            href={`mailto:${DEV_EMAIL}`}
            variant="outlined"
            size="large"
            startIcon={<EmailIcon />}
            sx={{
              justifyContent: 'flex-start',
              py: 1.5,
              px: 3,
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'rgba(43, 110, 79, 0.04)',
              },
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 500, ml: 1 }}>
              {DEV_EMAIL}
            </Typography>
          </Button>

          <Button
            component={MuiLink}
            href={`tel:${DEV_PHONE}`}
            variant="outlined"
            size="large"
            startIcon={<PhoneIcon />}
            sx={{
              justifyContent: 'flex-start',
              py: 1.5,
              px: 3,
              borderColor: '#8A1C2B',
              color: '#8A1C2B',
              '&:hover': {
                borderColor: '#8A1C2B',
                bgcolor: 'rgba(138, 28, 43, 0.04)',
              },
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 500, ml: 1 }}>
              {DEV_PHONE}
            </Typography>
          </Button>

          <Button
            component={MuiLink}
            href={DEV_LINKEDIN}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            size="large"
            startIcon={<LinkedInIcon />}
            sx={{
              justifyContent: 'flex-start',
              py: 1.5,
              px: 3,
              borderColor: '#0A66C2',
              color: '#0A66C2',
              '&:hover': {
                borderColor: '#0A66C2',
                bgcolor: 'rgba(10, 102, 194, 0.04)',
              },
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 500, ml: 1 }}>
              linkedin.com/in/myatthurasoe
            </Typography>
          </Button>

          <Button
            component={MuiLink}
            href={DEV_GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            size="large"
            startIcon={<GitHubIcon />}
            sx={{
              justifyContent: 'flex-start',
              py: 1.5,
              px: 3,
              borderColor: '#181717',
              color: '#181717',
              '&:hover': {
                borderColor: '#181717',
                bgcolor: 'rgba(24, 23, 23, 0.04)',
              },
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 500, ml: 1 }}>
              github.com/MyatThuraSoe
            </Typography>
          </Button>
        </Stack>
      </Paper>

      {/* Features Card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          bgcolor: 'background.default',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <InfoIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {t('what_we_build')}
          </Typography>
        </Stack>

        <Stack spacing={1.5}>
          {[
            'feat_pos',
            'feat_inventory',
            'feat_erp',
            'feat_offline',
            'feat_mobile',
            'feat_web',
            'feat_db',
            'feat_network',
          ].map((feature, idx) => (
            <Stack key={idx} direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {t(feature)}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Typography
          variant="body2"
          color="text.secondary"
          textAlign="center"
          sx={{ fontStyle: 'italic' }}
        >
          {t('cta')}
        </Typography>
      </Paper>

      {/* Footer */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {t('copyright', { year: new Date().getFullYear() })}
        </Typography>
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('made_in')}
        </Typography>
      </Box>
    </Box>
  );
};

export default About;
