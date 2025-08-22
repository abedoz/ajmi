import React, { useState } from 'react';
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
  Paper,
  Badge,
  LinearProgress
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  Search as SearchIcon,
  People as PeopleIcon,
  School as SchoolIcon,
  Speed as SpeedIcon,
  PlayArrow as PlayIcon,
  TrendingUp as TrendingUpIcon,
  Star as StarIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

const RecommendationEngine = ({ dataSummary, aiSettings }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [streamingResults, setStreamingResults] = useState([]);
  
  // Quick Setup
  const [quickSetup, setQuickSetup] = useState({
    mode: 'quick_test',
    sampleSize: 10
  });
  
  // NLP Query
  const [nlpQuery, setNlpQuery] = useState('10 random trainees');
  const [nlpLoading, setNlpLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState([]);

  const quickSetupOptions = [
    {
      id: 'quick_test',
      title: 'Quick Test',
      description: 'Test with 10 random trainees for fast results',
      icon: <SpeedIcon />,
      color: 'success',
      defaultSize: 10,
      emoji: '⚡'
    },
    {
      id: 'aljazeera_group',
      title: 'Al Jazeera Team',
      description: 'Focus on Al Jazeera trainees',
      icon: <PeopleIcon />,
      color: 'primary',
      defaultSize: 20,
      emoji: '🏢'
    },
    {
      id: 'active_learners',
      title: 'Active Learners',
      description: 'Trainees with existing enrollments',
      icon: <TrendingUpIcon />,
      color: 'info',
      defaultSize: 30,
      emoji: '🎯'
    },
    {
      id: 'new_trainees',
      title: 'New Trainees',
      description: 'Trainees without enrollments',
      icon: <StarIcon />,
      color: 'warning',
      defaultSize: 25,
      emoji: '🆕'
    }
  ];

  const handleQuickSetup = (setupId) => {
    const setup = quickSetupOptions.find(opt => opt.id === setupId);
    setQuickSetup({
      mode: setupId,
      sampleSize: setup.defaultSize
    });
    
    // Auto-set NLP query
    switch (setupId) {
      case 'quick_test':
        setNlpQuery(`${setup.defaultSize} random trainees`);
        break;
      case 'aljazeera_group':
        setNlpQuery(`${setup.defaultSize} trainees from aljazeera`);
        break;
      case 'active_learners':
        setNlpQuery(`active trainees with enrollments`);
        break;
      case 'new_trainees':
        setNlpQuery(`trainees without enrollments`);
        break;
    }
  };

  const handlePreviewQuery = async () => {
    if (!nlpQuery.trim()) return;

    try {
      setNlpLoading(true);
      setError(null);
      
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
      console.log('NLP Response received:', result);
      console.log('Results data:', result.results?.data);
      console.log('Results length:', result.results?.data?.length);
      
      if (result.success) {
        if (result.results && result.results.data && result.results.data.length > 0) {
          // Filter results have data
          setPreviewResults(result.results.data.slice(0, 6)); // Show first 6 for preview
          setError(null);
          console.log('✅ Preview loaded:', result.explanation, `(${result.results.data.length} results)`);
        } else if (result.insights && result.insights.length > 0) {
          // Insight results - show a message
          setPreviewResults([]);
          setError(null);
          console.log('✅ Insights generated:', result.query);
        } else {
          // No data found
          setPreviewResults([]);
          setError(`Query processed but no trainees found. Try: "5 random trainees" or "trainees from aljazeera"`);
        }
      } else {
        setPreviewResults([]);
        setError(result.error || 'Failed to process query');
      }
      
    } catch (error) {
      console.error('Preview error:', error);
      setError(`Preview Error: ${error.message}`);
      setPreviewResults([]);
    } finally {
      setNlpLoading(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      setProgress(0);
      setProgressMessage('');
      setStreamingResults([]);

      // Build parameters based on NLP query
      const params = new URLSearchParams({
        useAI: 'false',
        maxRecommendations: '5',
        minProbability: '0.3',
        maxTrainees: quickSetup.sampleSize.toString()
      });

      // Parse NLP query for filters
      if (nlpQuery.includes('aljazeera')) {
        params.append('emailSearch', 'aljazeera');
      }
      if (nlpQuery.includes('without enrollment')) {
        params.append('hasEnrollments', 'false');
      }
      if (nlpQuery.includes('active') || nlpQuery.includes('with enrollment')) {
        params.append('hasEnrollments', 'true');
      }
      if (nlpQuery.includes('random')) {
        params.append('randomSample', 'true');
        params.append('randomSampleSize', quickSetup.sampleSize.toString());
      }

      const eventSource = new EventSource(`/api/generate-trainee-recommendations-stream?${params}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'progress':
              setProgress(data.progress || 0);
              setProgressMessage(data.message || '');
              break;
              
            case 'trainee_complete':
              setStreamingResults(prev => [...prev, data.traineeResult]);
              setProgress(data.progress || 0);
              break;
              
            case 'complete':
              setProgress(100);
              setProgressMessage('Analysis completed!');
              setLoading(false);
              eventSource.close();
              break;
              
            case 'error':
              setError(data.message || 'An error occurred');
              setLoading(false);
              eventSource.close();
              break;
              
            default:
              console.log('Unknown event type:', data.type);
              break;
          }
        } catch (parseError) {
          console.error('Error parsing streaming data:', parseError);
        }
      };

      eventSource.onerror = () => {
        setError('Connection error occurred');
        setLoading(false);
        eventSource.close();
      };

    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
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
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom
          sx={{
            background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <PsychologyIcon sx={{ color: '#1976d2', fontSize: 40 }} />
          Recommendation Engine
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          AI-powered course recommendations for {(dataSummary?.trainees?.total || 0).toLocaleString()} trainees
        </Typography>
      </Box>

      {/* Quick Setup Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <SpeedIcon sx={{ mr: 1 }} />
            Quick Start - Choose Your Analysis Type
          </Typography>
        </Grid>

        {quickSetupOptions.map((option) => (
          <Grid item xs={12} sm={6} md={3} key={option.id}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                bgcolor: quickSetup.mode === option.id ? `${option.color}.100` : 'background.paper',
                border: quickSetup.mode === option.id ? 2 : 1,
                borderColor: quickSetup.mode === option.id ? `${option.color}.main` : 'divider',
                transition: 'all 0.3s ease',
                position: 'relative',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 3
                }
              }}
              onClick={() => handleQuickSetup(option.id)}
            >
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: `${option.color}.main`, 
                    width: 60, 
                    height: 60, 
                    mx: 'auto', 
                    mb: 2 
                  }}
                >
                  {option.icon}
                </Avatar>
                <Typography variant="h6" gutterBottom color={`${option.color}.main`}>
                  {option.emoji} {option.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {option.description}
                </Typography>
                <Chip 
                  label={`${option.defaultSize.toLocaleString()} trainees`}
                  size="small"
                  color={option.color}
                  variant={quickSetup.mode === option.id ? 'filled' : 'outlined'}
                />
                {quickSetup.mode === option.id && (
                  <CheckCircleIcon 
                    sx={{ 
                      position: 'absolute', 
                      top: 10, 
                      right: 10, 
                      color: `${option.color}.main` 
                    }} 
                  />
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* NLP Interface */}
      <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <AutoAwesomeIcon sx={{ mr: 1 }} />
            Natural Language Search
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Describe what you are looking for in plain English
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              value={nlpQuery}
              onChange={(e) => setNlpQuery(e.target.value)}
              placeholder="e.g., 'Find 10 trainees from aljazeera' or 'Show me active learners'"
              disabled={nlpLoading}
            />
            <Button
              variant="outlined"
              onClick={handlePreviewQuery}
              disabled={nlpLoading || !nlpQuery.trim()}
              startIcon={nlpLoading ? <CircularProgress size={16} /> : <SearchIcon />}
              sx={{ minWidth: 120 }}
            >
              {nlpLoading ? 'Processing...' : 'Preview'}
            </Button>
          </Box>

          {/* Quick Examples */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[
              "10 random trainees",
              "trainees from aljazeera", 
              "active trainees",
              "trainees without enrollments"
            ].map((example, index) => (
              <Chip
                key={index}
                label={example}
                onClick={() => setNlpQuery(example)}
                variant="outlined"
                size="small"
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Preview Results */}
      {previewResults.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <SearchIcon sx={{ mr: 1 }} />
              Query Preview Results
            </Typography>
            <Alert severity="success" sx={{ mb: 2 }}>
              Found trainees matching your query. Showing first {previewResults.length} results.
            </Alert>
            
            <Grid container spacing={2}>
              {previewResults.map((trainee, index) => (
                <Grid item xs={12} sm={6} md={4} key={trainee.member_id || index}>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {trainee.name || `Trainee ${trainee.member_id}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      {trainee.email || 'No email'}
                    </Typography>
                    <Chip 
                      label={`${trainee.enrollment_count || 0} enrollments`}
                      size="small"
                      color={(trainee.enrollment_count || 0) > 0 ? 'success' : 'default'}
                      sx={{ mt: 1 }}
                    />
                  </Paper>
                </Grid>
              ))}
            </Grid>
            
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Ready to generate recommendations for these trainees?
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Generate Button */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Ready to Generate?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Selected: {quickSetupOptions.find(opt => opt.id === quickSetup.mode)?.emoji} {quickSetupOptions.find(opt => opt.id === quickSetup.mode)?.title}
                ({quickSetup.sampleSize.toLocaleString()} trainees)
              </Typography>
              <Typography variant="body2" color="primary.main" sx={{ mt: 1 }}>
                Query: "{nlpQuery}"
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              onClick={handleGenerateRecommendations}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <PlayIcon />}
              sx={{ minWidth: 250 }}
            >
              {loading ? 'Generating...' : 'Generate Recommendations'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Progress Display */}
      {loading && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                AI Analysis in Progress
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {progressMessage || 'Processing your request...'}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ 
                  mb: 2, 
                  maxWidth: 400, 
                  mx: 'auto', 
                  height: 8, 
                  borderRadius: 4,
                  bgcolor: 'grey.300'
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {progress}% Complete
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {streamingResults.length > 0 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">
                Generated Recommendations
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Chip 
                  icon={<PeopleIcon />}
                  label={`${streamingResults.length.toLocaleString()} trainees analyzed`} 
                  color="primary" 
                />
                <Chip 
                  icon={<SchoolIcon />}
                  label={`${streamingResults.reduce((sum, t) => sum + (t.recommendations?.length || 0), 0).toLocaleString()} recommendations`} 
                  color="success" 
                />
              </Box>
            </Box>
            
            <Grid container spacing={2}>
              {streamingResults.slice(0, 12).map((trainee, index) => (
                <Grid item xs={12} sm={6} md={4} key={trainee.traineeId || index}>
                  <Paper sx={{ p: 2, transition: 'all 0.3s ease', '&:hover': { boxShadow: 3 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        {trainee.traineeName || `Trainee ${trainee.traineeId}`}
                      </Typography>
                      <Badge 
                        badgeContent={trainee.recommendations?.length || 0} 
                        color="success"
                      >
                        <SchoolIcon color="action" />
                      </Badge>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 1 }}>
                      {trainee.traineeEmail || 'No email'}
                    </Typography>
                    
                    {/* Show top recommendation */}
                    {trainee.recommendations && trainee.recommendations.length > 0 && (
                      <Paper sx={{ p: 1, bgcolor: 'success.50', mt: 1 }}>
                        <Typography variant="caption" color="success.main" fontWeight="bold">
                          Top Recommendation:
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {trainee.recommendations[0].courseName}
                        </Typography>
                        <Chip 
                          label={`${Math.round(trainee.recommendations[0].probability * 100)}% match`}
                          size="small"
                          color="success"
                          sx={{ mt: 0.5 }}
                        />
                      </Paper>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {streamingResults.length > 12 && (
              <Alert severity="info" sx={{ mt: 3 }}>
                Showing first 12 of {streamingResults.length.toLocaleString()} results. 
                Full results are available for export.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default RecommendationEngine;
