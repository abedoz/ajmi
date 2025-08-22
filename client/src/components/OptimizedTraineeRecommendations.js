import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Pagination,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Search as SearchIcon,
  Psychology as PsychologyIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  Speed as SpeedIcon,
  People as PeopleIcon
} from '@mui/icons-material';

const OptimizedTraineeRecommendations = ({ dataSummary, aiSettings }) => {
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  
  const [filters, setFilters] = useState({
    nameSearch: '',
    emailSearch: '',
    phoneSearch: '',
    hasEnrollments: '',
    minEnrollments: '',
    maxEnrollments: ''
  });
  
  const [nlpQuery, setNlpQuery] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);
  const [selectedTrainees, setSelectedTrainees] = useState(new Set());
  const [recommendations, setRecommendations] = useState(new Map());
  const [recommendationLoading, setRecommendationLoading] = useState(new Set());

  // Fetch trainees with current filters and pagination
  const fetchTrainees = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/filtered-trainees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            sortBy: 'member_id',
            sortOrder: 'ASC'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trainees');
      }

      const result = await response.json();
      
      if (result.success) {
        setTrainees(result.data);
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages
        }));
      } else {
        throw new Error(result.error || 'Failed to fetch trainees');
      }

    } catch (error) {
      console.error('Fetch trainees error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle NLP query
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
          setFilters(prev => ({ ...prev, ...result.traineeFilters }));
          // Reset to first page when filters change
          setPagination(prev => ({ ...prev, page: 1 }));
        }
        
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

  // Generate recommendations for selected trainees
  const generateRecommendationsForSelected = async () => {
    if (selectedTrainees.size === 0) {
      setError('Please select trainees first');
      return;
    }

    const traineeIds = Array.from(selectedTrainees);
    setRecommendationLoading(new Set(traineeIds));

    try {
      const promises = traineeIds.map(async (traineeId) => {
        const response = await fetch(`/api/trainee-recommendations/${traineeId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            maxRecommendations: 5,
            minProbability: 0.1,
            excludeEnrolled: true
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to get recommendations for trainee ${traineeId}`);
        }

        const result = await response.json();
        return { traineeId, result };
      });

      const results = await Promise.all(promises);
      
      const newRecommendations = new Map(recommendations);
      results.forEach(({ traineeId, result }) => {
        newRecommendations.set(traineeId, result);
      });
      
      setRecommendations(newRecommendations);
      setError(null);

    } catch (error) {
      console.error('Recommendation generation error:', error);
      setError(error.message);
    } finally {
      setRecommendationLoading(new Set());
    }
  };

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Handle trainee selection
  const handleTraineeSelect = (traineeId) => {
    const newSelected = new Set(selectedTrainees);
    if (newSelected.has(traineeId)) {
      newSelected.delete(traineeId);
    } else {
      newSelected.add(traineeId);
    }
    setSelectedTrainees(newSelected);
  };

  // Apply filters
  const handleApplyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchTrainees();
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilters({
      nameSearch: '',
      emailSearch: '',
      phoneSearch: '',
      hasEnrollments: '',
      minEnrollments: '',
      maxEnrollments: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Load initial data
  useEffect(() => {
    fetchTrainees();
  }, [pagination.page, pagination.limit]);

  // Auto-apply filters when they change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (Object.values(filters).some(value => value !== '')) {
        handleApplyFilters();
      }
    }, 500); // Debounce filter changes

    return () => clearTimeout(timeoutId);
  }, [filters]);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        🚀 High-Performance Trainee Recommendations
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        Optimized for handling {dataSummary?.trainees?.total?.toLocaleString() || 0} trainees with database-powered queries
      </Typography>

      {/* NLP Query Interface */}
      <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <AutoAwesomeIcon sx={{ mr: 1 }} />
            🗣️ Natural Language Search
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              value={nlpQuery}
              onChange={(e) => setNlpQuery(e.target.value)}
              placeholder="e.g., 'Find trainees from aljazeera with more than 2 courses'"
              onKeyPress={(e) => e.key === 'Enter' && handleNLPQuery()}
              disabled={nlpLoading}
            />
            <Button
              variant="contained"
              onClick={handleNLPQuery}
              disabled={nlpLoading || !nlpQuery.trim()}
              startIcon={nlpLoading ? <CircularProgress size={16} /> : <SearchIcon />}
              sx={{ minWidth: 120 }}
            >
              {nlpLoading ? 'Processing...' : 'Search'}
            </Button>
          </Box>

          {/* Quick Search Examples */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[
              "trainees from aljazeera",
              "active trainees with 3+ courses", 
              "trainees without enrollments",
              "random 10 trainees"
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

      {/* Advanced Filters */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <FilterIcon sx={{ mr: 1 }} />
            Advanced Filters
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search by Name"
                value={filters.nameSearch}
                onChange={(e) => setFilters(prev => ({ ...prev, nameSearch: e.target.value }))}
                placeholder="Enter trainee name..."
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search by Email"
                value={filters.emailSearch}
                onChange={(e) => setFilters(prev => ({ ...prev, emailSearch: e.target.value }))}
                placeholder="Enter email or domain..."
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search by Phone"
                value={filters.phoneSearch}
                onChange={(e) => setFilters(prev => ({ ...prev, phoneSearch: e.target.value }))}
                placeholder="Enter phone number..."
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Has Enrollments</InputLabel>
                <Select
                  value={filters.hasEnrollments}
                  onChange={(e) => setFilters(prev => ({ ...prev, hasEnrollments: e.target.value }))}
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
                value={filters.minEnrollments}
                onChange={(e) => setFilters(prev => ({ ...prev, minEnrollments: e.target.value }))}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Max Enrollments"
                type="number"
                value={filters.maxEnrollments}
                onChange={(e) => setFilters(prev => ({ ...prev, maxEnrollments: e.target.value }))}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="outlined" onClick={handleClearFilters} size="small">
                  Clear
                </Button>
                <Button variant="contained" onClick={handleApplyFilters} size="small">
                  Apply
                </Button>
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Results Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip 
                icon={<PeopleIcon />}
                label={`${pagination.total.toLocaleString()} trainees found`} 
                color="primary" 
              />
              <Chip 
                icon={<SpeedIcon />}
                label={`Page ${pagination.page}/${pagination.totalPages}`} 
                variant="outlined" 
              />
              {selectedTrainees.size > 0 && (
                <Chip 
                  label={`${selectedTrainees.size} selected`} 
                  color="success" 
                />
              )}
            </Box>
            
            <Button
              variant="contained"
              onClick={generateRecommendationsForSelected}
              disabled={selectedTrainees.size === 0 || recommendationLoading.size > 0}
              startIcon={recommendationLoading.size > 0 ? <CircularProgress size={16} /> : <PsychologyIcon />}
            >
              {recommendationLoading.size > 0 ? 'Generating...' : `Generate for ${selectedTrainees.size} Selected`}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Trainees Table */}
      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <FormControlLabel
                          control={
                            <Switch
                              checked={selectedTrainees.size === trainees.length && trainees.length > 0}
                              indeterminate={selectedTrainees.size > 0 && selectedTrainees.size < trainees.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTrainees(new Set(trainees.map(t => t.member_id)));
                                } else {
                                  setSelectedTrainees(new Set());
                                }
                              }}
                            />
                          }
                          label="Select All"
                        />
                      </TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Enrollments</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {trainees.map((trainee) => (
                      <TableRow 
                        key={trainee.member_id}
                        selected={selectedTrainees.has(trainee.member_id)}
                        hover
                      >
                        <TableCell padding="checkbox">
                          <Switch
                            checked={selectedTrainees.has(trainee.member_id)}
                            onChange={() => handleTraineeSelect(trainee.member_id)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {trainee.name || `Trainee ${trainee.member_id}`}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {trainee.email || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {trainee.phone || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={trainee.enrollment_count} 
                            size="small"
                            color={trainee.enrollment_count > 0 ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => generateRecommendationsForSelected()}
                            disabled={recommendationLoading.has(trainee.member_id)}
                            startIcon={recommendationLoading.has(trainee.member_id) ? <CircularProgress size={12} /> : <PsychologyIcon />}
                          >
                            {recommendationLoading.has(trainee.member_id) ? 'Loading...' : 'Recommend'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination
                  count={pagination.totalPages}
                  page={pagination.page}
                  onChange={handlePageChange}
                  color="primary"
                  size="large"
                  showFirstButton
                  showLastButton
                />
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recommendations Display */}
      {recommendations.size > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📋 Generated Recommendations
            </Typography>
            {Array.from(recommendations.entries()).map(([traineeId, rec]) => (
              <Accordion key={traineeId}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>
                    {trainees.find(t => t.member_id === traineeId)?.name || `Trainee ${traineeId}`} 
                    ({rec.recommendations?.length || 0} recommendations)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {rec.recommendations?.map((recommendation, index) => (
                    <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="subtitle2" color="primary">
                        {recommendation.courseName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Probability: {Math.round(recommendation.probability * 100)}%
                      </Typography>
                      <Typography variant="caption">
                        {recommendation.explanation}
                      </Typography>
                    </Box>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default OptimizedTraineeRecommendations;
