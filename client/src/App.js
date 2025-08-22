import React, { useState, useEffect, useCallback } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Tabs,
  Tab,
  Paper
} from '@mui/material';
import { Toaster } from 'react-hot-toast';
import DataUpload from './components/DataUpload';
import InteractiveDashboard from './components/InteractiveDashboard';
import RecommendationEngine from './components/RecommendationEngine';
import OutreachGenerator from './components/OutreachGenerator';
import Settings from './components/Settings';

import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
});

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [dataSummary, setDataSummary] = useState(null);
  const [aiSettings, setAiSettings] = useState(() => {
    // Load AI settings from localStorage if available
    const savedSettings = localStorage.getItem('aiSettings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (error) {
        console.error('Error parsing saved AI settings:', error);
      }
    }
    return {
      provider: 'openai',
      apiKey: '',
      endpoint: '',
      enableAI: false
    };
  });
  const [authStatus, setAuthStatus] = useState(null);

  // Function to save AI settings to localStorage
  const saveAiSettings = useCallback((settings) => {
    try {
      localStorage.setItem('aiSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving AI settings to localStorage:', error);
    }
  }, []);

  // Function to update AI settings and save to localStorage
  const updateAiSettings = useCallback((newSettings) => {
    setAiSettings(newSettings);
    saveAiSettings(newSettings);
  }, [saveAiSettings]);

  // Handle authentication status from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const auth = urlParams.get('auth');
    const message = urlParams.get('message');
    
    if (auth && message) {
      setAuthStatus({ type: auth, message: decodeURIComponent(message) });
      
      // If authentication was successful, automatically set Vertex AI as the default provider
      if (auth === 'success' && message.includes('OAuth authentication successful')) {
        updateAiSettings({
          provider: 'vertex',
          apiKey: '',
          endpoint: '',
          model: 'gemini-1.5-pro',
          enableAI: true
        });
      }
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Auto-hide auth status after 5 seconds
      setTimeout(() => {
        setAuthStatus(null);
      }, 5000);
    }
  }, [updateAiSettings]);

  const handleTabChange = (event, newValue) => {
    console.log('Tab changed from', activeTab, 'to', newValue);
    setActiveTab(newValue);
    
    // Refresh data when switching to AI Trainee Recs tab (now index 2)
    if (newValue === 2) {
      console.log('Switching to AI Trainee Recs tab, refreshing data...');
      refreshDataSummary();
    }
  };

  const refreshDataSummary = async () => {
    try {
      console.log('Fetching data from /api/data...');
      const response = await fetch('/api/data');
      if (response.ok) {
        const data = await response.json();
        console.log('API response:', data);
        console.log('data.success:', data.success);
        console.log('data.data:', data.data);
        console.log('data.data.courses:', data.data?.courses);
        console.log('data.data.courses.length:', data.data?.courses?.length);
        
        if (data.success && data.data) {
          // Transform the data to match the expected structure
          const summary = {
            courses: { 
              total: data.data.courses ? data.data.courses.length : 0, 
              byStatus: data.data.courses ? data.data.courses.reduce((acc, course) => {
                const status = course.Status || course.status || 1;
                acc[status] = (acc[status] || 0) + 1;
                return acc;
              }, {}) : {}
            },
            trainees: { total: data.data.trainees ? data.data.trainees.length : 0 },
            enrollments: { total: data.data.enrollments ? data.data.enrollments.length : 0 }
          };
          console.log('Transformed summary:', summary);
          console.log('summary.courses.total:', summary.courses.total);
          setDataSummary(summary);
        } else {
          console.log('No data in response, setting dataSummary to null');
          setDataSummary(null);
        }
      } else {
        console.log('Response not ok, setting dataSummary to null');
        setDataSummary(null);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setDataSummary(null);
    }
  };

  useEffect(() => {
    console.log('App.js useEffect triggered');
    // Add a small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      refreshDataSummary();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Toaster position="top-right" />
      
      <AppBar position="static" elevation={2}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Training Center Recommendations
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            AI-Powered Sales Tool
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 2 }}>
        {/* Authentication Status Display */}
        {authStatus && (
          <Box sx={{ mb: 2 }}>
            <Paper 
              elevation={1} 
              sx={{ 
                p: 2, 
                backgroundColor: authStatus.type === 'success' ? '#e8f5e8' : '#ffebee',
                border: `1px solid ${authStatus.type === 'success' ? '#4caf50' : '#f44336'}`
              }}
            >
              <Typography 
                variant="body1" 
                color={authStatus.type === 'success' ? 'success.main' : 'error.main'}
                sx={{ fontWeight: 500 }}
              >
                {authStatus.message}
              </Typography>
            </Paper>
          </Box>
        )}
        <Paper elevation={1} sx={{ mb: 2 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Dashboard" />
            <Tab label="Data Upload" />
            <Tab label="Recommendation Engine" />
            <Tab label="Outreach" />
            <Tab label="Settings" />
          </Tabs>
        </Paper>

        <TabPanel value={activeTab} index={0}>
          <InteractiveDashboard 
            dataSummary={dataSummary}
            aiSettings={aiSettings}
            onRefresh={refreshDataSummary}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <DataUpload 
            onDataUploaded={refreshDataSummary}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <RecommendationEngine 
            dataSummary={dataSummary}
            aiSettings={aiSettings}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <OutreachGenerator 
            aiSettings={aiSettings}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <Settings 
            aiSettings={aiSettings}
            onAiSettingsChange={updateAiSettings}
          />
        </TabPanel>
      </Container>
    </ThemeProvider>
  );
}

export default App;