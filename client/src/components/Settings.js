import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Settings as SettingsIcon,
  CheckCircle,
  Error
} from '@mui/icons-material';

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', description: 'GPT-4, GPT-3.5 Turbo' },
  { value: 'azure', label: 'Azure OpenAI', description: 'Enterprise OpenAI service' },
  { value: 'gemini', label: 'Google Gemini (AI Studio)', description: 'Gemini Pro, Gemini 1.5' },
  { value: 'claude', label: 'Anthropic Claude', description: 'Claude 3 Sonnet, Opus, Haiku' },
  { value: 'vertex', label: 'Google Cloud Vertex AI', description: 'Gemini 2.0 Pro, Flash' }
];

const Settings = ({ aiSettings, onAiSettingsChange }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [authStatus, setAuthStatus] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(false);

  // Check OAuth status on component mount
  useEffect(() => {
    if (aiSettings.provider === 'vertex') {
      checkAuthStatus();
    }
  }, [aiSettings.provider]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      setAuthStatus(data);
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  const handleProviderChange = (event) => {
    const newProvider = event.target.value;
    onAiSettingsChange({
      ...aiSettings,
      provider: newProvider,
      apiKey: '',
      endpoint: '',
      model: ''
    });
    setTestResult(null);
  };

  const handleInputChange = (field, value) => {
    onAiSettingsChange({
      ...aiSettings,
      [field]: value
    });
    setTestResult(null);
  };

  const handleTestApiKey = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/test-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: aiSettings.provider,
          apiKey: aiSettings.apiKey,
          endpoint: aiSettings.endpoint,
          model: aiSettings.model
        })
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: `Test failed: ${error.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoadingAuth(true);
    try {
      const response = await fetch('/api/auth/google');
      const data = await response.json();
      
      // Open Google OAuth in a new window
      const authWindow = window.open(data.authUrl, 'google-auth', 'width=500,height=600');
      
      if (!authWindow) {
        setLoadingAuth(false);
        setTestResult({ success: false, message: 'Popup blocked. Please allow popups and try again.' });
        return;
      }
      
      // Poll for authentication completion
      const checkAuth = setInterval(async () => {
        try {
          if (authWindow.closed) {
            clearInterval(checkAuth);
            setLoadingAuth(false);
            await checkAuthStatus();
            
            // Show success message
            setTestResult({ success: true, message: 'OAuth authentication completed. Please check the authentication status.' });
          }
        } catch (error) {
          // Handle cross-origin errors when checking window status
          clearInterval(checkAuth);
          setLoadingAuth(false);
          await checkAuthStatus();
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error starting OAuth flow:', error);
      setLoadingAuth(false);
      setTestResult({ success: false, message: `OAuth flow failed: ${error.message}` });
    }
  };

  const handleRefreshToken = async () => {
    setLoadingAuth(true);
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        await checkAuthStatus();
        setTestResult({ success: true, message: 'Token refreshed successfully' });
      } else {
        setTestResult({ success: false, message: data.error });
      }
    } catch (error) {
      setTestResult({ success: false, message: `Token refresh failed: ${error.message}` });
    } finally {
      setLoadingAuth(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <SettingsIcon sx={{ mr: 2 }} />
        AI Settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                AI Provider Configuration
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>AI Provider</InputLabel>
                <Select
                  value={aiSettings.provider}
                  onChange={handleProviderChange}
                  label="AI Provider"
                >
                  {AI_PROVIDERS.map((provider) => (
                    <MenuItem key={provider.value} value={provider.value}>
                      <Box>
                        <Typography variant="body1">{provider.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {provider.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Show success indicator when Vertex AI is selected and authenticated */}
              {aiSettings.provider === 'vertex' && authStatus?.authenticated && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>✅ Vertex AI Ready!</strong> You are authenticated and ready to use Google Cloud Vertex AI for recommendations.
                  </Typography>
                </Alert>
              )}

              {aiSettings.provider !== 'vertex' && (
                <TextField
                  fullWidth
                  label="API Key"
                  type="password"
                  value={aiSettings.apiKey}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  sx={{ mb: 2 }}
                />
              )}

              {aiSettings.provider === 'azure' && (
                <TextField
                  fullWidth
                  label="Endpoint URL"
                  value={aiSettings.endpoint}
                  onChange={(e) => handleInputChange('endpoint', e.target.value)}
                  placeholder="https://your-resource.openai.azure.com/"
                  sx={{ mb: 2 }}
                />
              )}

              <TextField
                fullWidth
                label="Model"
                value={aiSettings.model}
                onChange={(e) => handleInputChange('model', e.target.value)}
                placeholder="Leave empty for default"
                sx={{ mb: 2 }}
              />

              {aiSettings.provider !== 'vertex' && (
                <Button
                  variant="contained"
                  onClick={handleTestApiKey}
                  disabled={testing || !aiSettings.apiKey}
                  startIcon={testing ? <CircularProgress size={20} /> : null}
                  fullWidth
                >
                  {testing ? 'Testing...' : 'Test API Key'}
                </Button>
              )}

              {testResult && (
                <Alert 
                  severity={testResult.success ? 'success' : 'error'} 
                  sx={{ mt: 2 }}
                  icon={testResult.success ? <CheckCircle /> : <Error />}
                >
                  {testResult.message}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Vertex AI OAuth Authentication
              </Typography>
              
              {aiSettings.provider === 'vertex' && (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Vertex AI OAuth Setup:</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Vertex AI requires OAuth 2.0 authentication. Click the button below to authenticate with Google.
                    </Typography>
                  </Alert>

                  {authStatus && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        Authentication Status:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip 
                          label={authStatus.authenticated ? 'Authenticated' : 'Not Authenticated'}
                          color={authStatus.authenticated ? 'success' : 'error'}
                          size="small"
                        />
                        {authStatus.hasRefreshToken && (
                          <Chip 
                            label="Refresh Token Available"
                            color="info"
                            size="small"
                          />
                        )}
                      </Box>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      onClick={handleGoogleAuth}
                      disabled={loadingAuth}
                      startIcon={loadingAuth ? <CircularProgress size={20} /> : null}
                    >
                      {loadingAuth ? 'Authenticating...' : 'Authenticate with Google'}
                    </Button>

                    {authStatus?.hasRefreshToken && (
                      <Button
                        variant="outlined"
                        onClick={handleRefreshToken}
                        disabled={loadingAuth}
                      >
                        Refresh Token
                      </Button>
                    )}
                  </Box>

                  {authStatus?.authenticated && (
                    <Button
                      variant="contained"
                      onClick={handleTestApiKey}
                      disabled={testing}
                      startIcon={testing ? <CircularProgress size={20} /> : null}
                      sx={{ mt: 2 }}
                      fullWidth
                    >
                      {testing ? 'Testing...' : 'Test Vertex AI Connection'}
                    </Button>
                  )}

                  {testResult && (
                    <Alert 
                      severity={testResult.success ? 'success' : 'error'} 
                      sx={{ mt: 2 }}
                      icon={testResult.success ? <CheckCircle /> : <Error />}
                    >
                      {testResult.message}
                    </Alert>
                  )}
                </>
              )}

              {aiSettings.provider !== 'vertex' && (
                <Alert severity="info">
                  <Typography variant="body2">
                    Select "Google Cloud Vertex AI" to configure OAuth 2.0 authentication.
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;