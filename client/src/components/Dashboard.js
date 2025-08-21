import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  School,
  People,
  Assignment,
  Refresh,
  TrendingUp
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const STATUS_LABELS = {
  1: 'Created',
  2: 'Opened',
  3: 'Running',
  4: 'Closed',
  5: 'Archived'
};

function Dashboard({ dataSummary, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState('');
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    await onRefresh();
    setLoading(false);
  };

  const generateAIInsights = async () => {
    setAiInsightsLoading(true);
    try {
      // Get AI settings from localStorage
      const aiSettings = JSON.parse(localStorage.getItem('aiSettings') || '{}');
      
      if (!aiSettings.apiKey) {
        alert('Please configure your OpenAI API key in Settings first.');
        return;
      }

      const response = await fetch('/api/analytics/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: dataSummary,
          apiKey: aiSettings.apiKey
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setInsights(result.insights);
      } else {
        throw new Error('Failed to generate insights');
      }
    } catch (error) {
      console.error('Error generating AI insights:', error);
      alert('Failed to generate AI insights. Please check your API key and try again.');
    } finally {
      setAiInsightsLoading(false);
    }
  };

  const pieChartData = dataSummary.courses.byStatus.map(status => ({
    name: STATUS_LABELS[status.status] || 'Unknown',
    value: status.count,
    status: status.status
  }));

  const barChartData = [
    { name: 'Courses', value: dataSummary.courses.total },
    { name: 'Trainees', value: dataSummary.trainees.total },
    { name: 'Enrollments', value: dataSummary.enrollments.total }
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
          onClick={handleRefresh}
          disabled={loading}
        >
          Refresh Data
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <Card className="stats-card">
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <School color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Courses</Typography>
              </Box>
              <Typography className="stats-number">
                {dataSummary.courses.total}
              </Typography>
              <Typography className="stats-label">
                Total Courses
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card className="stats-card">
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <People color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Trainees</Typography>
              </Box>
              <Typography className="stats-number">
                {dataSummary.trainees.total}
              </Typography>
              <Typography className="stats-label">
                Total Trainees
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card className="stats-card">
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Assignment color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Enrollments</Typography>
              </Box>
              <Typography className="stats-number">
                {dataSummary.enrollments.total}
              </Typography>
              <Typography className="stats-label">
                Total Enrollments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>
              Course Status Distribution
            </Typography>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box textAlign="center" py={4}>
                <Typography color="text.secondary">
                  No course data available
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>
              Data Overview
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#1976d2" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* AI Insights */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            AI-Powered Insights
          </Typography>
          <Button
            variant="contained"
            startIcon={aiInsightsLoading ? <CircularProgress size={16} /> : <TrendingUp />}
            onClick={generateAIInsights}
            disabled={aiInsightsLoading}
          >
            Generate Insights
          </Button>
        </Box>
        
        {insights ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>
              {insights}
            </Typography>
          </Alert>
        ) : (
          <Typography color="text.secondary">
            Click "Generate Insights" to get AI-powered analysis of your training data.
            Make sure to configure your OpenAI API key in Settings first.
          </Typography>
        )}
      </Paper>

      {/* Quick Actions */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" mb={2}>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => window.location.hash = '#upload'}
            >
              Upload New Data
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => window.location.hash = '#recommendations'}
            >
              Generate Recommendations
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => window.location.hash = '#outreach'}
            >
              Create Outreach
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => window.location.hash = '#settings'}
            >
              Configure Settings
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

export default Dashboard;