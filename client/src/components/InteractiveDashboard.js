import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  Fade,
  Zoom,
  LinearProgress
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpIcon,
  Insights as InsightsIcon,
  Analytics as AnalyticsIcon,
  AutoAwesome as AutoAwesomeIcon,
  Send as SendIcon,
  Lightbulb as LightbulbIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  School as SchoolIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

const InteractiveDashboard = ({ dataSummary, aiSettings, onRefresh }) => {
  const [nlpQuery, setNlpQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);
  const [suggestedQueries] = useState([
    "Show me enrollment trends",
    "Find 5 random active trainees",
    "Trainees from aljazeera with more than 2 courses",
    "Most popular courses this year",
    "Engagement patterns and statistics",
    "Show completion rates by course status"
  ]);

  const handleNLPQuery = async () => {
    if (!nlpQuery.trim()) return;

    try {
      setLoading(true);
      
      // Add to query history
      setQueryHistory(prev => [nlpQuery, ...prev.slice(0, 4)]);

      const response = await fetch('/api/nlp-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: nlpQuery,
          dataContext: {
            totalCourses: dataSummary?.courses?.total || 0,
            totalTrainees: dataSummary?.trainees?.total || 0,
            totalEnrollments: dataSummary?.enrollments?.total || 0
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process natural language query');
      }

      const result = await response.json();
      setInsights(result);
      
    } catch (error) {
      console.error('NLP query error:', error);
      setInsights({
        success: false,
        error: error.message,
        query: nlpQuery
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedQuery = (query) => {
    setNlpQuery(query);
    // Auto-execute the suggested query
    setTimeout(() => {
      handleNLPQuery();
    }, 100);
  };

  const generateRandomInsight = async () => {
    const randomQueries = [
      "Show me enrollment trends",
      "Find 5 random trainees from aljazeera",
      "Show trainees without enrollments", 
      "Active trainees with more than 3 courses",
      "Show completion statistics",
      "Find 10 random active trainees"
    ];
    
    const randomQuery = randomQueries[Math.floor(Math.random() * randomQueries.length)];
    setNlpQuery(randomQuery);
    
    // Add to history and execute
    setQueryHistory(prev => [randomQuery, ...prev.slice(0, 4)]);
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/nlp-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: randomQuery,
          dataContext: {
            totalCourses: dataSummary?.courses?.total || 0,
            totalTrainees: dataSummary?.trainees?.total || 0,
            totalEnrollments: dataSummary?.enrollments?.total || 0
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate random insight');
      }

      const result = await response.json();
      setInsights(result);
      
    } catch (error) {
      console.error('Random insight error:', error);
      setInsights({
        success: false,
        error: error.message,
        query: randomQuery
      });
    } finally {
      setLoading(false);
    }
  };

  const renderInsightCard = (insight, index) => {
    const getInsightIcon = (type) => {
      switch (type) {
        case 'popularity': return <TrendingUpIcon />;
        case 'engagement': return <PeopleIcon />;
        case 'completion': return <AssessmentIcon />;
        case 'ai_insights': return <AutoAwesomeIcon />;
        default: return <InsightsIcon />;
      }
    };

    const getInsightColor = (type) => {
      switch (type) {
        case 'popularity': return 'success';
        case 'engagement': return 'primary';
        case 'completion': return 'warning';
        case 'ai_insights': return 'secondary';
        default: return 'info';
      }
    };

    return (
      <Zoom in={true} style={{ transitionDelay: `${index * 100}ms` }} key={index}>
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <CardContent sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar sx={{ bgcolor: `${getInsightColor(insight.type)}.main`, mr: 2 }}>
                {getInsightIcon(insight.type)}
              </Avatar>
              <Typography variant="h6" component="h3">
                {insight.title}
              </Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {insight.description}
            </Typography>

            {/* Render different visualizations based on type */}
            {insight.type === 'popularity' && insight.data && (
              <List dense>
                {insight.data.map((course, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>
                      <SchoolIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={course.courseName}
                      secondary={`${course.enrollmentCount} enrollments`}
                    />
                  </ListItem>
                ))}
              </List>
            )}

            {insight.type === 'engagement' && insight.data && (
              <Grid container spacing={2}>
                {Object.entries(insight.data).map(([level, count]) => (
                  <Grid item xs={6} key={level}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6" color="primary">
                        {count}
                      </Typography>
                      <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                        {level} Engagement
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}

            {insight.type === 'completion' && insight.data && (
              <List dense>
                {insight.data.map((status, idx) => (
                  <ListItem key={idx}>
                    <ListItemText
                      primary={status.statusLabel}
                      secondary={`${status.count} courses`}
                    />
                    <Chip 
                      label={status.count} 
                      size="small" 
                      color={status.status === 3 ? 'success' : 'default'} 
                    />
                  </ListItem>
                ))}
              </List>
            )}

            {insight.type === 'ai_insights' && insight.insights && (
              <List>
                {insight.insights.map((aiInsight, idx) => (
                  <ListItem key={idx} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      {aiInsight.title}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {aiInsight.description}
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      💡 {aiInsight.recommendation}
                    </Typography>
                    <Chip 
                      label={aiInsight.impact} 
                      size="small" 
                      color={aiInsight.impact === 'high' ? 'error' : aiInsight.impact === 'medium' ? 'warning' : 'info'}
                      sx={{ mt: 1 }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Zoom>
    );
  };

  // Show loading state while data is being fetched
  if (!dataSummary) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            🤖 Interactive AI Dashboard
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Ask questions in natural language to get personalized insights
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRefresh}
        >
          Refresh Data
        </Button>
      </Box>

      {/* NLP Query Interface */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            💬 Ask Me Anything
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Type your question in natural language to get AI-powered insights and filtered results
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              value={nlpQuery}
              onChange={(e) => setNlpQuery(e.target.value)}
              placeholder="e.g., 'Show me 5 random trainees from aljazeera' or 'What are the enrollment trends?'"
              onKeyPress={(e) => e.key === 'Enter' && handleNLPQuery()}
              disabled={loading}
            />
            <Button
              variant="contained"
              onClick={handleNLPQuery}
              disabled={loading || !nlpQuery.trim()}
              startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
              sx={{ minWidth: 120 }}
            >
              {loading ? 'Analyzing...' : 'Ask AI'}
            </Button>
          </Box>

          {/* Suggested Queries */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              💡 Try these examples:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {suggestedQueries.map((query, index) => (
                <Chip
                  key={index}
                  label={query}
                  onClick={() => handleSuggestedQuery(query)}
                  variant="outlined"
                  size="small"
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          {/* Query History */}
          {queryHistory.length > 0 && (
            <Box>
              <Typography variant="body2" gutterBottom>
                📝 Recent queries:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {queryHistory.map((query, index) => (
                  <Chip
                    key={index}
                    label={query}
                    onClick={() => handleSuggestedQuery(query)}
                    variant="filled"
                    size="small"
                    color="primary"
                    sx={{ cursor: 'pointer', opacity: 0.8 }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Generated Insights */}
      {insights && (
        <Fade in={true}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <LightbulbIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">
                  Generated Insights
                </Typography>
                <Chip 
                  label={insights.success ? 'Success' : 'Error'} 
                  color={insights.success ? 'success' : 'error'} 
                  size="small" 
                  sx={{ ml: 2 }}
                />
              </Box>

              {insights.success ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Query: "{insights.query}"
                  </Typography>
                  
                  {insights.explanation && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      {insights.explanation}
                    </Alert>
                  )}

                  {insights.insights && insights.insights.length > 0 && (
                    <Grid container spacing={3}>
                      {insights.insights.map((insight, index) => (
                        <Grid item xs={12} md={6} lg={4} key={index}>
                          {renderInsightCard(insight, index)}
                        </Grid>
                      ))}
                    </Grid>
                  )}

                  {/* Show NLP Filter Results */}
                  {insights.results && insights.results.data && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" gutterBottom color="primary">
                        📋 Query Results ({insights.results.pagination?.total?.toLocaleString() || 0} total)
                      </Typography>
                      <Grid container spacing={2}>
                        {insights.results.data.slice(0, 6).map((trainee, index) => (
                          <Grid item xs={12} sm={6} md={4} key={trainee.member_id}>
                            <Card variant="outlined">
                              <CardContent sx={{ p: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  {trainee.name || `Trainee ${trainee.member_id}`}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                  {trainee.email || 'No email'}
                                </Typography>
                                <Chip 
                                  label={`${trainee.enrollment_count} enrollments`}
                                  size="small"
                                  color={trainee.enrollment_count > 0 ? 'success' : 'default'}
                                  sx={{ mt: 1 }}
                                />
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                      
                      {insights.results.pagination?.total > 6 && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                          Showing first 6 of {insights.results.pagination.total.toLocaleString()} results. 
                          Use the AI Trainee Recs tab for full pagination and recommendations.
                        </Alert>
                      )}
                    </Box>
                  )}

                  {insights.suggestedActions && insights.suggestedActions.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="body2" gutterBottom>
                        🎯 Suggested actions:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {insights.suggestedActions.map((action, index) => (
                          <Chip
                            key={index}
                            label={action}
                            variant="outlined"
                            size="small"
                            color="secondary"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              ) : (
                <Alert severity="error">
                  Error processing query: {insights.error}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Fade>
      )}

      {/* Quick Stats Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', bgcolor: 'primary.50' }}>
            <CardContent>
              <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 1 }}>
                <SchoolIcon />
              </Avatar>
              <Typography variant="h4" color="primary">
                {(dataSummary?.courses?.total || 0).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Courses
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', bgcolor: 'success.50' }}>
            <CardContent>
              <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 1 }}>
                <PeopleIcon />
              </Avatar>
              <Typography variant="h4" color="success.main">
                {(dataSummary?.trainees?.total || 0).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Trainees
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', bgcolor: 'warning.50' }}>
            <CardContent>
              <Avatar sx={{ bgcolor: 'warning.main', mx: 'auto', mb: 1 }}>
                <AssessmentIcon />
              </Avatar>
              <Typography variant="h4" color="warning.main">
                {(dataSummary?.enrollments?.total || 0).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Enrollments
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ textAlign: 'center', bgcolor: 'info.50' }}>
            <CardContent>
              <Avatar sx={{ bgcolor: 'info.main', mx: 'auto', mb: 1 }}>
                <SpeedIcon />
              </Avatar>
              <Typography variant="h4" color="info.main">
                {dataSummary?.enrollments?.total && dataSummary?.trainees?.total ? 
                  Math.round((dataSummary.enrollments.total / dataSummary.trainees.total) * 10) / 10 : 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg Enrollments/Trainee
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Random Insights by AI */}
      <Card sx={{ mb: 3, bgcolor: 'gradient.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AutoAwesomeIcon sx={{ mr: 1, color: 'secondary.main' }} />
              <Typography variant="h6">
                🎲 Random Insights by AI
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<AutoAwesomeIcon />}
              onClick={() => generateRandomInsight()}
              disabled={loading}
            >
              Generate Random Insight
            </Button>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'info.50', cursor: 'pointer' }} onClick={() => handleSuggestedQuery("Show me enrollment trends")}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <TrendingUpIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                  <Typography variant="h6" color="info.main">
                    📈 Enrollment Trends
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Discover patterns in course enrollments
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'success.50', cursor: 'pointer' }} onClick={() => handleSuggestedQuery("Find 10 random active trainees")}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <PeopleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                  <Typography variant="h6" color="success.main">
                    👥 Active Trainees
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Explore engaged learners and their patterns
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'warning.50', cursor: 'pointer' }} onClick={() => handleSuggestedQuery("Show completion statistics")}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <AssessmentIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                  <Typography variant="h6" color="warning.main">
                    📊 Course Analytics
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Analyze course performance and completion
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* AI-Powered Insights Section */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AnalyticsIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">
              📊 Advanced Analytics
            </Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
                <Typography variant="h6" gutterBottom color="primary">
                  📊 Quick Insights
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <TrendingUpIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Engagement Rate"
                      secondary={`${Math.round((dataSummary?.enrollments?.total / dataSummary?.trainees?.total) * 100) || 0}% of trainees are enrolled`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <AnalyticsIcon color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Course Utilization"
                      secondary={`${Math.round((dataSummary?.enrollments?.total / dataSummary?.courses?.total) * 100) / 100 || 0} avg enrollments per course`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <InsightsIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Data Quality"
                      secondary="AI-powered data validation and cleaning active"
                    />
                  </ListItem>
                </List>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
                <Typography variant="h6" gutterBottom color="secondary">
                  🎯 Recommendations
                </Typography>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="💡 Try Natural Language Queries"
                      secondary="Ask questions like 'Show me active trainees' or 'What are the trends?'"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="🔍 Use Smart Filters"
                      secondary="Filter by name, email, enrollment status, or random sampling"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="⚡ Optimize Performance"
                      secondary="Start with small samples (5-20 trainees) for faster results"
                    />
                  </ListItem>
                </List>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default InteractiveDashboard;
