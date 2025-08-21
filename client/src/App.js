import React, { useState, useEffect } from 'react';
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
import Dashboard from './components/Dashboard';
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
  const [dataSummary, setDataSummary] = useState({
    courses: { total: 0, byStatus: [] },
    trainees: { total: 0 },
    enrollments: { total: 0 }
  });
  const [aiSettings, setAiSettings] = useState({
    apiKey: '',
    enableAI: false
  });

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const refreshDataSummary = async () => {
    try {
      const response = await fetch('/api/data/summary');
      if (response.ok) {
        const summary = await response.json();
        setDataSummary(summary);
      }
    } catch (error) {
      console.error('Error fetching data summary:', error);
    }
  };

  useEffect(() => {
    refreshDataSummary();
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
        <Paper elevation={1} sx={{ mb: 2 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Dashboard" />
            <Tab label="Data Upload" />
            <Tab label="Recommendations" />
            <Tab label="Outreach" />
            <Tab label="Settings" />
          </Tabs>
        </Paper>

        <TabPanel value={activeTab} index={0}>
          <Dashboard 
            dataSummary={dataSummary}
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
            onSettingsChange={setAiSettings}
          />
        </TabPanel>
      </Container>
    </ThemeProvider>
  );
}

export default App;