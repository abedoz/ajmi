import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  FormControlLabel,
  Switch,
  Divider,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip
} from '@mui/material';
import {
  Save,
  VpnKey,
  Security,
  Info,
  CheckCircle,
  Error
} from '@mui/icons-material';
import toast from 'react-hot-toast';

function Settings({ aiSettings, onSettingsChange }) {
  const [apiKey, setApiKey] = useState(aiSettings.apiKey || '');
  const [enableAI, setEnableAI] = useState(aiSettings.enableAI || false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  useEffect(() => {
    // Load settings from localStorage on component mount
    const savedSettings = localStorage.getItem('aiSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setApiKey(settings.apiKey || '');
      setEnableAI(settings.enableAI || false);
      onSettingsChange(settings);
    }
  }, [onSettingsChange]);

  const handleSaveSettings = () => {
    const newSettings = {
      apiKey: apiKey.trim(),
      enableAI: enableAI && apiKey.trim().length > 0
    };

    // Save to localStorage
    localStorage.setItem('aiSettings', JSON.stringify(newSettings));
    
    // Update parent component
    onSettingsChange(newSettings);
    
    toast.success('Settings saved successfully');
    
    // Reset connection status when settings change
    setConnectionStatus(null);
  };

  const testConnection = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key first');
      return;
    }

    setTestingConnection(true);
    setConnectionStatus(null);

    try {
      // Test the API key by making a simple request
      const response = await fetch('/api/test-openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: apiKey.trim()
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setConnectionStatus('success');
        toast.success('API connection successful!');
      } else {
        setConnectionStatus('error');
        toast.error(result.error || 'API connection failed');
      }
    } catch (error) {
      setConnectionStatus('error');
      toast.error('Network error occurred');
    } finally {
      setTestingConnection(false);
    }
  };

  const maskApiKey = (key) => {
    if (!key || key.length < 8) return key;
    return key.substring(0, 7) + '...' + key.substring(key.length - 4);
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      {/* API Configuration */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          <VpnKey sx={{ mr: 1, verticalAlign: 'middle' }} />
          OpenAI API Configuration
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            An OpenAI API key is required for AI-enhanced features including:
            course descriptions, personalized insights, and automated message generation.
          </Typography>
        </Alert>

        <TextField
          fullWidth
          type="password"
          label="OpenAI API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          sx={{ mb: 2 }}
          helperText="Your API key is stored locally and never sent to our servers"
        />

        {apiKey && (
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary">
              Current key: {maskApiKey(apiKey)}
            </Typography>
          </Box>
        )}

        <FormControlLabel
          control={
            <Switch
              checked={enableAI}
              onChange={(e) => setEnableAI(e.target.checked)}
              disabled={!apiKey.trim()}
            />
          }
          label="Enable AI Features"
          sx={{ mb: 2 }}
        />

        <Box display="flex" gap={2} mb={2}>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            startIcon={<Save />}
          >
            Save Settings
          </Button>

          <Button
            variant="outlined"
            onClick={testConnection}
            disabled={!apiKey.trim() || testingConnection}
            startIcon={testingConnection ? null : <Security />}
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </Button>
        </Box>

        {connectionStatus && (
          <Alert 
            severity={connectionStatus}
            icon={connectionStatus === 'success' ? <CheckCircle /> : <Error />}
          >
            {connectionStatus === 'success' 
              ? 'API key is valid and connection successful'
              : 'API key validation failed. Please check your key and try again.'
            }
          </Alert>
        )}
      </Paper>

      {/* Features Overview */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          AI Features Overview
        </Typography>

        <List>
          <ListItem>
            <ListItemIcon>
              <CheckCircle color={enableAI ? 'success' : 'disabled'} />
            </ListItemIcon>
            <ListItemText
              primary="Enhanced Course Descriptions"
              secondary="AI-generated compelling descriptions for your courses"
            />
            <Chip 
              label={enableAI ? 'Enabled' : 'Disabled'} 
              color={enableAI ? 'success' : 'default'}
              size="small"
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <CheckCircle color={enableAI ? 'success' : 'disabled'} />
            </ListItemIcon>
            <ListItemText
              primary="Personalized Insights"
              secondary="Customized recommendations for each trainee"
            />
            <Chip 
              label={enableAI ? 'Enabled' : 'Disabled'} 
              color={enableAI ? 'success' : 'default'}
              size="small"
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <CheckCircle color={enableAI ? 'success' : 'disabled'} />
            </ListItemIcon>
            <ListItemText
              primary="Automated Outreach Messages"
              secondary="Generate personalized emails, SMS, and WhatsApp messages"
            />
            <Chip 
              label={enableAI ? 'Enabled' : 'Disabled'} 
              color={enableAI ? 'success' : 'default'}
              size="small"
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <CheckCircle color={enableAI ? 'success' : 'disabled'} />
            </ListItemIcon>
            <ListItemText
              primary="Predictive Analytics"
              secondary="AI-powered insights for improving sales and enrollment"
            />
            <Chip 
              label={enableAI ? 'Enabled' : 'Disabled'} 
              color={enableAI ? 'success' : 'default'}
              size="small"
            />
          </ListItem>
        </List>
      </Paper>

      {/* Usage Guidelines */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          <Info sx={{ mr: 1, verticalAlign: 'middle' }} />
          Usage Guidelines & Pricing
        </Typography>

        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Important:</strong> AI features use the OpenAI API which incurs costs based on usage.
            Monitor your API usage in the OpenAI dashboard to avoid unexpected charges.
          </Typography>
        </Alert>

        <Typography variant="body2" paragraph>
          <strong>Cost Optimization Tips:</strong>
        </Typography>

        <List dense>
          <ListItem>
            <ListItemText
              primary="• Limit the number of prospects when generating recommendations"
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="• Use AI enhancement selectively for high-priority prospects"
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="• Test with small batches before processing large datasets"
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="• Monitor your OpenAI API usage dashboard regularly"
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
        </List>

        <Divider sx={{ my: 2 }} />

        <Typography variant="body2" color="text.secondary">
          <strong>Security:</strong> Your API key is stored locally in your browser and is never transmitted to our servers.
          It's only used to make direct requests to OpenAI's API from your browser.
        </Typography>
      </Paper>
    </Box>
  );
}

export default Settings;