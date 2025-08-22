import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Paper,
  Badge,
  LinearProgress,
  Switch
} from '@mui/material';
import {
  Person as PersonIcon,
  School as SchoolIcon,
  Psychology as PsychologyIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  AutoAwesome as AutoAwesomeIcon,
  Insights as InsightsIcon,
  Star as StarIcon
} from '@mui/icons-material';

const TraineeRecommendations = ({ dataSummary, aiSettings }) => {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [processedTrainees, setProcessedTrainees] = useState(0);
  const [totalTrainees, setTotalTrainees] = useState(0);
  const [currentTrainee, setCurrentTrainee] = useState(null);
  const [streamingResults, setStreamingResults] = useState([]);
  const [filters, setFilters] = useState({
    minProbability: 0.3,
    maxProbability: 1.0,
    courseStatus: '',
    sortBy: 'probability',
    sortOrder: 'desc',
    maxRecommendations: 5,
    maxTrainees: 50  // Limit for performance
  });
  
  const [traineeFilters, setTraineeFilters] = useState({
    nameSearch: '',
    emailSearch: '',
    phoneSearch: '',
    hasEnrollments: '',
    minEnrollments: '',
    maxEnrollments: '',
    randomSample: false,
    randomSampleSize: 10
  });
  const [showFilters, setShowFilters] = useState(false);
  const [nlpQuery, setNlpQuery] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleGenerateRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      setProgress(0);
      setProgressMessage('Connecting to AI engine...');
      setCurrentStep('Initializing');
      setProcessedTrainees(0);
      setTotalTrainees(0);
      setCurrentTrainee(null);
      setStreamingResults([]);
      setRecommendations(null);

      // Direct EventSource connection for reliable streaming
      const params = new URLSearchParams({
        useAI: 'true',
        aiProvider: aiSettings?.provider || 'vertex',
        maxRecommendations: filters.maxRecommendations.toString(),
        minProbability: filters.minProbability.toString(),
        maxTrainees: filters.maxTrainees.toString(),
        // Trainee filters
        nameSearch: traineeFilters.nameSearch,
        emailSearch: traineeFilters.emailSearch,
        phoneSearch: traineeFilters.phoneSearch,
        hasEnrollments: traineeFilters.hasEnrollments,
        minEnrollments: traineeFilters.minEnrollments,
        maxEnrollments: traineeFilters.maxEnrollments,
        randomSample: traineeFilters.randomSample.toString(),
        randomSampleSize: traineeFilters.randomSampleSize.toString()
      });

      const eventSource = new EventSource(`/api/generate-trainee-recommendations-stream?${params}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Streaming data received:', data);
          
          switch (data.type) {
            case 'progress':
              setProgress(data.progress || 0);
              setProgressMessage(data.message || '');
              setCurrentStep(data.currentStep || '');
              setProcessedTrainees(data.processedTrainees || 0);
              setTotalTrainees(data.totalTrainees || 0);
              setCurrentTrainee(data.currentTrainee || null);
              console.log('📊 Progress:', data.message, `${data.progress}%`);
              break;
              
            case 'trainee_complete':
              // Add the completed trainee to streaming results with instant feedback
              setStreamingResults(prev => [...prev, data.traineeResult]);
              setProgress(data.progress || 0);
              setProgressMessage(data.message || '');
              setProcessedTrainees(data.processedTrainees || 0);
              console.log('✅ Completed:', data.traineeResult?.traineeName, `(${data.traineeResult?.recommendations?.length} recs)`);
              break;
              
            case 'complete':
              setProgress(100);
              setProgressMessage(data.message || 'Analysis completed!');
              setRecommendations(data.result);
              setLoading(false);
              eventSource.close();
              
              // Show browser notification if user is on different tab
              if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                new Notification('🎉 AI Analysis Complete!', {
                  body: `Trainee recommendations finished! ${data.result?.totalTrainees || 0} trainees analyzed with ${data.result?.recommendationsGenerated || 0} recommendations.`,
                  icon: '/favicon.ico'
                });
              }
              console.log('🎉 Analysis Complete!', data.result);
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
          console.error('Error parsing streaming data:', parseError, event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        setError('Connection error during streaming');
        setLoading(false);
        eventSource.close();
      };

      eventSource.onopen = () => {
        console.log('EventSource connection opened');
        setProgressMessage('Connected to AI engine successfully!');
      };

    } catch (error) {
      console.error('Error setting up streaming:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleNLPQuery = async () => {
    if (!nlpQuery.trim()) return;

    try {
      setNlpLoading(true);
      
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
      
      if (result.success && result.type === 'filter') {
        // Apply the AI-generated filters
        if (result.traineeFilters) {
          setTraineeFilters(prev => ({ ...prev, ...result.traineeFilters }));
        }
        if (result.courseFilters) {
          setFilters(prev => ({ ...prev, ...result.courseFilters }));
        }
        
        // Show success message
        setError(null);
        console.log('✅ NLP Filters Applied:', result.explanation);
      }
      
    } catch (error) {
      console.error('NLP query error:', error);
      setError(`NLP Error: ${error.message}`);
    } finally {
      setNlpLoading(false);
    }
  };

  const getProbabilityColor = (probability) => {
    if (probability >= 0.8) return 'success';
    if (probability >= 0.6) return 'info';
    if (probability >= 0.4) return 'warning';
    return 'default';
  };

  const getStatusLabel = (status) => {
    const statusLabels = {
      1: 'Created',
      2: 'Opened', 
      3: 'Running',
      4: 'Closed',
      5: 'Archived'
    };
    return statusLabels[status] || 'Unknown';
  };

  // Show loading state while data is being fetched
  if (!dataSummary) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Check if we have valid data
  if (dataSummary.courses?.total === 0) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          AI-Powered Trainee Recommendations
        </Typography>
        <Alert severity="info" sx={{ mb: 3 }}>
          No training data available. Please upload your course, trainee, and enrollment data first.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontWeight: 'bold'
      }}>
        <AutoAwesomeIcon sx={{ color: '#1976d2', fontSize: 40 }} />
        AI-Powered Trainee Recommendations
      </Typography>

      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        Personalized course recommendations for {(dataSummary?.trainees?.total || 0).toLocaleString()} trainees based on AI similarity analysis
      </Typography>

      {/* NLP Query Interface */}
      <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <AutoAwesomeIcon sx={{ mr: 1 }} />
            🗣️ Natural Language Filtering
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ask in plain English to filter trainees and generate recommendations
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              value={nlpQuery}
              onChange={(e) => setNlpQuery(e.target.value)}
              placeholder="e.g., 'Show me 5 random trainees from aljazeera' or 'Active trainees with more than 2 courses'"
              onKeyPress={(e) => e.key === 'Enter' && handleNLPQuery()}
              disabled={nlpLoading}
            />
            <Button
              variant="contained"
              onClick={handleNLPQuery}
              disabled={nlpLoading || !nlpQuery.trim()}
              startIcon={nlpLoading ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
              sx={{ minWidth: 120 }}
            >
              {nlpLoading ? 'Processing...' : 'Apply'}
            </Button>
          </Box>

          {/* Quick NLP Examples */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[
              "5 random trainees",
              "trainees from aljazeera", 
              "active trainees with 3+ courses",
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

      {/* Control Panel */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Configuration & Filters
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
              <Button
                variant="contained"
                onClick={handleGenerateRecommendations}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <PsychologyIcon />}
                size="large"
              >
                {loading ? 'Analyzing...' : 'Generate AI Recommendations'}
              </Button>
            </Box>
          </Box>

          {showFilters && (
            <Paper sx={{ p: 3, mt: 2, bgcolor: 'grey.50' }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                  <Typography gutterBottom>Minimum Probability</Typography>
                  <Slider
                    value={filters.minProbability}
                    onChange={(e, value) => handleFilterChange('minProbability', value)}
                    min={0}
                    max={1}
                    step={0.1}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 0.5, label: '50%' },
                      { value: 1, label: '100%' }
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Max Recommendations per Trainee"
                    type="number"
                    value={filters.maxRecommendations}
                    onChange={(e) => handleFilterChange('maxRecommendations', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 20 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Max Trainees to Analyze"
                    type="number"
                    value={filters.maxTrainees}
                    onChange={(e) => handleFilterChange('maxTrainees', parseInt(e.target.value))}
                    inputProps={{ min: 10, max: 1000 }}
                    helperText="Limit for performance"
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Sort By</InputLabel>
                    <Select
                      value={filters.sortBy}
                      onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                      label="Sort By"
                    >
                      <MenuItem value="probability">Probability</MenuItem>
                      <MenuItem value="courseName">Course Name</MenuItem>
                      <MenuItem value="courseStatus">Course Status</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Sort Order</InputLabel>
                    <Select
                      value={filters.sortOrder}
                      onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                      label="Sort Order"
                    >
                      <MenuItem value="desc">Highest First</MenuItem>
                      <MenuItem value="asc">Lowest First</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              
              {/* Trainee Selection Filters */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mt: 3, mb: 2, color: 'primary.main' }}>
                  👥 Trainee Selection Filters
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Filter trainees to process a specific group for testing and analysis
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Search by Name"
                  value={traineeFilters.nameSearch}
                  onChange={(e) => setTraineeFilters(prev => ({ ...prev, nameSearch: e.target.value }))}
                  placeholder="Enter trainee name..."
                  helperText="Partial name search"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Search by Email"
                  value={traineeFilters.emailSearch}
                  onChange={(e) => setTraineeFilters(prev => ({ ...prev, emailSearch: e.target.value }))}
                  placeholder="Enter email domain or address..."
                  helperText="e.g., @aljazeera.net"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Search by Phone"
                  value={traineeFilters.phoneSearch}
                  onChange={(e) => setTraineeFilters(prev => ({ ...prev, phoneSearch: e.target.value }))}
                  placeholder="Enter phone number..."
                  helperText="Partial phone search"
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Has Enrollments</InputLabel>
                  <Select
                    value={traineeFilters.hasEnrollments}
                    onChange={(e) => setTraineeFilters(prev => ({ ...prev, hasEnrollments: e.target.value }))}
                    label="Has Enrollments"
                  >
                    <MenuItem value="">All Trainees</MenuItem>
                    <MenuItem value="true">With Enrollments</MenuItem>
                    <MenuItem value="false">Without Enrollments</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Min Enrollments"
                  type="number"
                  value={traineeFilters.minEnrollments}
                  onChange={(e) => setTraineeFilters(prev => ({ ...prev, minEnrollments: e.target.value }))}
                  inputProps={{ min: 0, max: 50 }}
                  helperText="Minimum courses enrolled"
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Max Enrollments"
                  type="number"
                  value={traineeFilters.maxEnrollments}
                  onChange={(e) => setTraineeFilters(prev => ({ ...prev, maxEnrollments: e.target.value }))}
                  inputProps={{ min: 0, max: 50 }}
                  helperText="Maximum courses enrolled"
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Box>
                  <FormControl component="fieldset">
                    <Typography variant="body2" gutterBottom>Random Sample</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Switch
                        checked={traineeFilters.randomSample}
                        onChange={(e) => setTraineeFilters(prev => ({ ...prev, randomSample: e.target.checked }))}
                        size="small"
                      />
                      {traineeFilters.randomSample && (
                        <TextField
                          size="small"
                          type="number"
                          value={traineeFilters.randomSampleSize}
                          onChange={(e) => setTraineeFilters(prev => ({ ...prev, randomSampleSize: parseInt(e.target.value) || 10 }))}
                          inputProps={{ min: 1, max: 100 }}
                          sx={{ width: 80 }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {traineeFilters.randomSample ? `Select ${traineeFilters.randomSampleSize} random trainees` : 'Use all filtered trainees'}
                    </Typography>
                  </FormControl>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => setTraineeFilters({
                      nameSearch: '',
                      emailSearch: '',
                      phoneSearch: '',
                      hasEnrollments: '',
                      minEnrollments: '',
                      maxEnrollments: '',
                      randomSample: false,
                      randomSampleSize: 10
                    })}
                    size="small"
                  >
                    Clear Trainee Filters
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setTraineeFilters(prev => ({ ...prev, randomSample: true, randomSampleSize: 5 }))}
                    size="small"
                  >
                    Quick Test (5 Random)
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setTraineeFilters(prev => ({ ...prev, hasEnrollments: 'true', minEnrollments: '1' }))}
                    size="small"
                  >
                    Active Trainees Only
                  </Button>
                </Box>
              </Grid>

              {/* Filter Preview */}
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Filter Preview:</strong> With current filters, up to {Math.min(filters.maxTrainees, 
                    traineeFilters.randomSample ? traineeFilters.randomSampleSize : filters.maxTrainees).toLocaleString()} trainees will be processed
                    {traineeFilters.nameSearch && ` • Name contains "${traineeFilters.nameSearch}"`}
                    {traineeFilters.emailSearch && ` • Email contains "${traineeFilters.emailSearch}"`}
                    {traineeFilters.phoneSearch && ` • Phone contains "${traineeFilters.phoneSearch}"`}
                    {traineeFilters.hasEnrollments === 'true' && ` • With enrollments`}
                    {traineeFilters.hasEnrollments === 'false' && ` • Without enrollments`}
                    {traineeFilters.minEnrollments && ` • Min ${traineeFilters.minEnrollments} enrollments`}
                    {traineeFilters.maxEnrollments && ` • Max ${traineeFilters.maxEnrollments} enrollments`}
                    {traineeFilters.randomSample && ` • Random sample of ${traineeFilters.randomSampleSize}`}
                  </Typography>
                </Alert>
              </Grid>
            </Paper>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Final Results */}
      {(recommendations || streamingResults.length > 0) && !loading && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">
                {recommendations ? 'AI Recommendations Completed' : 'Partial Results Available'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Chip 
                  icon={<PersonIcon />}
                  label={`${recommendations?.totalTrainees || streamingResults.length} Trainees`} 
                  color="primary" 
                />
                <Chip 
                  icon={<InsightsIcon />}
                  label={`${recommendations?.recommendationsGenerated || streamingResults.reduce((sum, t) => sum + t.recommendations.length, 0)} Recommendations`} 
                  color="success" 
                />
              </Box>
            </Box>

            {/* Metadata */}
            {recommendations.metadata && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>AI Analysis:</strong> {recommendations.metadata.useAI ? 'Enabled' : 'Disabled'} | 
                  <strong> Provider:</strong> {recommendations.metadata.aiProvider} | 
                  <strong> Courses Analyzed:</strong> {recommendations.metadata.courseContextsAnalyzed} | 
                  <strong> Similarity Matrix:</strong> {recommendations.metadata.courseSimilarityMatrixSize} relationships
                </Typography>
              </Alert>
            )}

            {/* Trainee Recommendations List */}
            {(recommendations?.data || streamingResults).map((trainee, index) => (
              <Accordion key={trainee.traineeId} sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                      <PersonIcon />
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6">
                        {trainee.traineeName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {trainee.traineeEmail} | {trainee.currentCourses.length} enrolled courses
                      </Typography>
                    </Box>
                    <Badge 
                      badgeContent={trainee.recommendations.length} 
                      color="secondary"
                      sx={{ mr: 2 }}
                    >
                      <SchoolIcon color="primary" />
                    </Badge>
                  </Box>
                </AccordionSummary>
                
                <AccordionDetails>
                  <Grid container spacing={3}>
                    {/* Current Courses */}
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                        Current Enrollments
                      </Typography>
                      <List dense>
                        {trainee.currentCourses.map((course) => (
                          <ListItem key={course.courseId}>
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                                <SchoolIcon fontSize="small" />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={course.courseName}
                              secondary={getStatusLabel(course.courseStatus)}
                            />
                          </ListItem>
                        ))}
                        {trainee.currentCourses.length === 0 && (
                          <Typography variant="body2" color="text.secondary">
                            No current enrollments
                          </Typography>
                        )}
                      </List>
                    </Grid>

                    {/* Recommendations */}
                    <Grid item xs={12} md={8}>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                        AI-Powered Recommendations
                      </Typography>
                      {trainee.recommendations.length > 0 ? (
                        <List>
                          {trainee.recommendations.map((rec, recIndex) => (
                            <ListItem key={rec.courseId} sx={{ 
                              bgcolor: 'background.paper',
                              borderRadius: 2,
                              mb: 1,
                              border: '1px solid',
                              borderColor: 'divider'
                            }}>
                              <ListItemAvatar>
                                <Avatar sx={{ bgcolor: getProbabilityColor(rec.probability) + '.main' }}>
                                  <StarIcon />
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                                      {rec.courseName}
                                    </Typography>
                                    <Chip 
                                      label={`${Math.round(rec.probability * 100)}%`}
                                      color={getProbabilityColor(rec.probability)}
                                      size="small"
                                      sx={{ fontWeight: 'bold' }}
                                    />
                                  </Box>
                                }
                                secondary={
                                  <Box sx={{ mt: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                      Status: {getStatusLabel(rec.courseStatus)}
                                    </Typography>
                                    {rec.explanation && (
                                      <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                                        {rec.explanation}
                                      </Typography>
                                    )}
                                    {rec.similarCourses && rec.similarCourses.length > 0 && (
                                      <Box sx={{ mt: 1 }}>
                                        <Typography variant="caption" color="text.secondary">
                                          Similar to: {rec.similarCourses.map(sc => sc.courseName).join(', ')}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                }
                              />
                              <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={rec.probability * 100}
                                  color={getProbabilityColor(rec.probability)}
                                  sx={{ mb: 1, height: 8, borderRadius: 4 }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  Match Score
                                </Typography>
                              </Box>
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Alert severity="info">
                          No recommendations found for this trainee with current filters.
                        </Alert>
                      )}
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}

            {(recommendations?.data || streamingResults).length === 0 && (
              <Alert severity="info">
                No trainee recommendations generated. Try adjusting your filters.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Real-time Progress Display */}
      {loading && (
        <Card sx={{ mt: 3 }}>
          <CardContent sx={{ py: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                AI Analysis in Progress
              </Typography>
              <Typography variant="body1" color="primary" sx={{ fontWeight: 500, mb: 2 }}>
                {currentStep}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {progressMessage}
              </Typography>
              
              {/* Progress Bar */}
              <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Progress</Typography>
                  <Typography variant="body2">{Math.round(progress)}%</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={progress} 
                  sx={{ 
                    height: 10, 
                    borderRadius: 5,
                    backgroundColor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 5,
                      background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)'
                    }
                  }} 
                />
              </Box>

              {/* Current Trainee Info */}
              {currentTrainee && (
                <Alert severity="info" sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
                  <Typography variant="body2">
                    <strong>Currently analyzing:</strong> {currentTrainee.name}
                    {currentTrainee.email && ` (${currentTrainee.email})`}
                  </Typography>
                </Alert>
              )}

              {/* Statistics */}
              {totalTrainees > 0 && (
                <Grid container spacing={2} sx={{ maxWidth: 400, mx: 'auto' }}>
                  <Grid item xs={6}>
                    <Typography variant="h6" color="primary">
                      {processedTrainees}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Completed
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6" color="text.secondary">
                      {totalTrainees}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Trainees
                    </Typography>
                  </Grid>
                </Grid>
              )}
            </Box>

            {/* Real-time Results */}
            {streamingResults.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ textAlign: 'center', mb: 3 }}>
                  Live Results ({streamingResults.length} completed)
                </Typography>
                
                {streamingResults.slice(-3).map((trainee, index) => (
                  <Card key={trainee.traineeId} sx={{ mb: 2, border: '2px solid', borderColor: 'success.main' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                          <PersonIcon />
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {trainee.traineeName} ✅
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {trainee.recommendations.length} recommendations generated
                          </Typography>
                        </Box>
                        <Chip 
                          label="Just Completed" 
                          color="success" 
                          size="small"
                          sx={{ fontWeight: 'bold' }}
                        />
                      </Box>
                      
                      {/* Show top recommendation */}
                      {trainee.recommendations.length > 0 && (
                        <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Top Recommendation:
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SchoolIcon color="primary" fontSize="small" />
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                              {trainee.recommendations[0].courseName}
                            </Typography>
                            <Chip 
                              label={`${Math.round(trainee.recommendations[0].probability * 100)}%`}
                              color={getProbabilityColor(trainee.recommendations[0].probability)}
                              size="small"
                            />
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                {streamingResults.length > 3 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontStyle: 'italic' }}>
                    Showing latest 3 results... {streamingResults.length - 3} more completed
                  </Typography>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !recommendations && !error && (
        <Card sx={{ mt: 3 }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <PsychologyIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Ready to Generate AI Recommendations
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Click the button above to generate personalized course recommendations for all trainees using AI-powered similarity analysis.
            </Typography>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>AI Features:</strong> Course context analysis, similarity matrix calculation, 
                explainable probabilities, and personalized matching based on enrollment history.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default TraineeRecommendations;
