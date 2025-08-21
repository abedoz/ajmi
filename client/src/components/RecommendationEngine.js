import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  TextField,
  Switch,
  FormControlLabel,
  Pagination,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Psychology,
  Download,
  FilterList,
  Star,
  TrendingUp,
  Group,
  School
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import toast from 'react-hot-toast';

const RECOMMENDATION_STYLES = [
  { value: 'similar', label: 'Similar Courses', icon: <School />, description: 'Based on past enrollment patterns' },
  { value: 'progression', label: 'Skill Progression', icon: <TrendingUp />, description: 'Next steps in learning path' },
  { value: 'popular', label: 'Popular Courses', icon: <Star />, description: 'Trending among similar trainees' },
  { value: 'gaps', label: 'Skill Gaps', icon: <Group />, description: 'Fill missing competencies' }
];

const COURSE_STATUSES = [
  { value: 1, label: 'Created', color: '#2196f3' },
  { value: 2, label: 'Opened', color: '#4caf50' },
  { value: 3, label: 'Running', color: '#ff9800' },
  { value: 4, label: 'Closed', color: '#e91e63' },
  { value: 5, label: 'Archived', color: '#9c27b0' }
];

function RecommendationEngine({ dataSummary, aiSettings }) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState([2, 3]); // Default to opened and running
  const [targetCourseId, setTargetCourseId] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [metadata, setMetadata] = useState(null);

  const handleGenerateRecommendations = async () => {
    if (!selectedStyle) {
      toast.error('Please select a recommendation style');
      return;
    }

    if (selectedStatuses.length === 0) {
      toast.error('Please select at least one course status');
      return;
    }

    if (selectedStyle === 'similar' && !targetCourseId) {
      toast.error('Please enter a target course ID for similar course recommendations');
      return;
    }

    if (useAI && !aiSettings.apiKey) {
      toast.error('Please configure your OpenAI API key in Settings to use AI features');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recommendationStyle: selectedStyle,
          courseStatuses: selectedStatuses,
          targetCourseId: selectedStyle === 'similar' ? targetCourseId : undefined,
          useAI,
          aiApiKey: useAI ? aiSettings.apiKey : undefined
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setRecommendations(result.recommendations);
        setMetadata(result.metadata);
        setPage(1);
        toast.success(`Generated ${result.recommendations.length} recommendations`);
      } else {
        toast.error(result.error || 'Failed to generate recommendations');
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
      toast.error('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (recommendations.length === 0) {
      toast.error('No recommendations to export');
      return;
    }

    try {
      const response = await fetch('/api/export/prospects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prospects: recommendations,
          format: 'csv'
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recommendations_${selectedStyle}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Recommendations exported successfully');
      } else {
        toast.error('Failed to export recommendations');
      }
    } catch (error) {
      console.error('Error exporting recommendations:', error);
      toast.error('Network error occurred');
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.7) return 'success';
    if (score >= 0.5) return 'warning';
    return 'error';
  };

  const getConfidenceLabel = (score) => {
    if (score >= 0.7) return 'High';
    if (score >= 0.5) return 'Medium';
    return 'Low';
  };

  const paginatedRecommendations = recommendations.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const totalPages = Math.ceil(recommendations.length / pageSize);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Recommendation Engine
      </Typography>

      {/* Configuration Panel */}
      <Paper className="filter-section" sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          <FilterList sx={{ mr: 1, verticalAlign: 'middle' }} />
          Configuration
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Recommendation Style</InputLabel>
              <Select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                label="Recommendation Style"
              >
                {RECOMMENDATION_STYLES.map((style) => (
                  <MenuItem key={style.value} value={style.value}>
                    <Box display="flex" alignItems="center">
                      {style.icon}
                      <Box ml={1}>
                        <Typography variant="body1">{style.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {style.description}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Course Statuses</InputLabel>
              <Select
                multiple
                value={selectedStatuses}
                onChange={(e) => setSelectedStatuses(e.target.value)}
                label="Course Statuses"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const status = COURSE_STATUSES.find(s => s.value === value);
                      return (
                        <Chip
                          key={value}
                          label={status?.label}
                          size="small"
                          style={{ backgroundColor: status?.color, color: 'white' }}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {COURSE_STATUSES.map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    <Chip
                      label={status.label}
                      size="small"
                      style={{ backgroundColor: status.color, color: 'white', marginRight: 8 }}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {selectedStyle === 'similar' && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Target Course ID"
                value={targetCourseId}
                onChange={(e) => setTargetCourseId(e.target.value)}
                placeholder="Enter course ID for similarity analysis"
                helperText="Required for similar course recommendations"
              />
            </Grid>
          )}

          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                  disabled={!aiSettings.apiKey}
                />
              }
              label="Use AI Enhancement"
            />
            {!aiSettings.apiKey && (
              <Typography variant="caption" color="error" display="block">
                Configure OpenAI API key in Settings to enable AI features
              </Typography>
            )}
          </Grid>
        </Grid>

        <Box mt={3} display="flex" gap={2}>
          <Button
            variant="contained"
            onClick={handleGenerateRecommendations}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <Psychology />}
            size="large"
          >
            {loading ? 'Generating...' : 'Generate Recommendations'}
          </Button>

          {recommendations.length > 0 && (
            <Button
              variant="outlined"
              onClick={handleExport}
              startIcon={<Download />}
              className="export-button"
            >
              Export CSV
            </Button>
          )}
        </Box>
      </Paper>

      {/* Results Summary */}
      {metadata && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body1">
            <strong>{metadata.totalProspects}</strong> prospects found using{' '}
            <strong>{RECOMMENDATION_STYLES.find(s => s.value === metadata.style)?.label}</strong>{' '}
            strategy for courses with status:{' '}
            {metadata.courseStatuses.map(status => 
              COURSE_STATUSES.find(s => s.value === status)?.label
            ).join(', ')}
          </Typography>
        </Alert>
      )}

      {/* Recommendations Grid */}
      {recommendations.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              Recommendations ({recommendations.length})
            </Typography>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(e, value) => setPage(value)}
              color="primary"
            />
          </Box>

          <Grid container spacing={2}>
            {paginatedRecommendations.map((rec, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Card 
                  className={`recommendation-card ${rec.enhanced ? 'ai-enhanced' : ''}`}
                  sx={{ height: '100%' }}
                >
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="h6" component="div">
                        {rec.Name}
                      </Typography>
                      <Chip
                        label={`${(rec.confidenceScore * 100).toFixed(0)}%`}
                        color={getConfidenceColor(rec.confidenceScore)}
                        size="small"
                        className={`confidence-score confidence-${getConfidenceLabel(rec.confidenceScore).toLowerCase()}`}
                      />
                    </Box>

                    <Typography color="text.secondary" gutterBottom>
                      {rec.Email}
                    </Typography>
                    
                    {rec.Mobile && (
                      <Typography color="text.secondary" gutterBottom>
                        {rec.Mobile}
                      </Typography>
                    )}

                    <Box my={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Recommended Course:
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {rec.recommendedCourse}
                      </Typography>
                    </Box>

                    <Box my={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Reason:
                      </Typography>
                      <Typography variant="body2">
                        {rec.reason}
                      </Typography>
                    </Box>

                    {rec.aiDescription && (
                      <Box my={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          AI Course Description:
                        </Typography>
                        <Typography variant="body2" style={{ fontStyle: 'italic' }}>
                          {rec.aiDescription}
                        </Typography>
                      </Box>
                    )}

                    {rec.personalizedInsight && (
                      <Box my={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          Personalized Insight:
                        </Typography>
                        <Typography variant="body2" color="primary">
                          {rec.personalizedInsight}
                        </Typography>
                      </Box>
                    )}

                    <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                      <Typography variant="caption" color="text.secondary">
                        Confidence: {getConfidenceLabel(rec.confidenceScore)}
                      </Typography>
                      {rec.enhanced && (
                        <Chip
                          label="AI Enhanced"
                          color="success"
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, value) => setPage(value)}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </Paper>
      )}

      {/* Empty State */}
      {!loading && recommendations.length === 0 && metadata === null && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Psychology sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Recommendations Generated Yet
          </Typography>
          <Typography color="text.secondary" mb={3}>
            Configure your preferences above and click "Generate Recommendations" to start
          </Typography>
          {dataSummary.courses.total === 0 && (
            <Alert severity="warning">
              Please upload your course, trainee, and enrollment data first
            </Alert>
          )}
        </Paper>
      )}
    </Box>
  );
}

export default RecommendationEngine;