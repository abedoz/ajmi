import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  LinearProgress,
  Badge,
  Divider,
  CardActionArea,
  Fade,
  Zoom
} from '@mui/material';
import {
  School as SchoolIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Star as StarIcon,
  Insights as InsightsIcon,
  Analytics as AnalyticsIcon,
  AutoAwesome as AutoAwesomeIcon,
  Speed as SpeedIcon,
  EmojiEvents as TrophyIcon,
  Timeline as TimelineIcon,
  Psychology as PsychologyIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

const Dashboard = ({ dataSummary, onRefresh }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInsight, setSelectedInsight] = useState('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/data');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setData(result.data);
          setError(null);
        } else {
          setError('No data available');
          setData(null);
        }
      } else {
        setError('Failed to fetch data');
        setData(null);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Error fetching data');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Fade in={true}>
        <Box sx={{ p: 3 }}>
          <Alert 
            severity="warning" 
            action={
              <Button color="inherit" size="small" onClick={fetchData}>
                Try Again
              </Button>
            }
          >
            <Typography variant="body1">
              {error}
            </Typography>
          </Alert>
        </Box>
      </Fade>
    );
  }

  if (!data) {
    return (
      <Fade in={true}>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <AutoAwesomeIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom color="primary">
            Welcome to Training Center Recommendations
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
            AI-Powered Analytics for Training Centers
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body1">
              No training data available. Please go to the <strong>Data Upload</strong> section to upload your training data file.
            </Typography>
          </Alert>
          <Button 
            variant="contained" 
            size="large" 
            onClick={() => window.location.hash = '#upload'}
            sx={{ mt: 2 }}
          >
            Upload Training Data
          </Button>
        </Box>
      </Fade>
    );
  }

  const { courses, trainees, enrollments } = data;

  // Calculate statistics
  const totalCourses = courses?.length || 0;
  const totalTrainees = trainees?.length || 0;
  const totalEnrollments = enrollments?.length || 0;
  const avgEnrollments = totalCourses > 0 ? Math.round(totalEnrollments / totalCourses) : 0;

  // Course status summary
  const courseStatusSummary = courses ? getCourseStatusSummary(courses) : [];

  // Course enrollment statistics
  const courseStats = courses && enrollments ? getCourseStats(courses, enrollments) : [];

  // Top courses by enrollment
  const topCourses = courseStats
    .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
    .slice(0, 5);

  // Key insights
  const insights = [
    {
      id: 'overview',
      title: 'Data Overview',
      icon: <AnalyticsIcon />,
      color: 'primary',
      value: `${totalCourses} Courses`,
      description: 'Complete training portfolio analysis'
    },
    {
      id: 'popular',
      title: 'Most Popular',
      icon: <TrophyIcon />,
      color: 'success',
      value: topCourses[0]?.CustomName || 'N/A',
      description: `${topCourses[0]?.enrollmentCount || 0} enrollments`
    },
    {
      id: 'engagement',
      title: 'Engagement Rate',
      icon: <SpeedIcon />,
      color: 'info',
      value: `${avgEnrollments}`,
      description: 'Average enrollments per course'
    },
    {
      id: 'opportunities',
      title: 'Growth Opportunities',
      icon: <InsightsIcon />,
      color: 'warning',
      value: `${courseStats.filter(c => c.enrollmentCount === 0).length}`,
      description: 'Courses with zero enrollments'
    }
  ];

  const handleInsightClick = (insightId) => {
    setSelectedInsight(insightId);
  };

  const getInsightDetails = (insightId) => {
    switch (insightId) {
      case 'overview':
        return {
          title: 'Training Portfolio Overview',
          content: (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="h6" color="primary">{totalCourses}</Typography>
                <Typography variant="body2">Total Courses</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="h6" color="success.main">{totalTrainees}</Typography>
                <Typography variant="body2">Active Trainees</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="h6" color="info.main">{totalEnrollments}</Typography>
                <Typography variant="body2">Total Enrollments</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="h6" color="warning.main">{avgEnrollments}</Typography>
                <Typography variant="body2">Avg per Course</Typography>
              </Grid>
            </Grid>
          )
        };
      case 'popular':
        return {
          title: 'Top Performing Courses',
          content: (
            <List dense>
              {topCourses.slice(0, 3).map((course, index) => (
                <ListItem key={course.CourseBasicDataId}>
                  <ListItemIcon>
                    <Badge badgeContent={index + 1} color="primary">
                      <StarIcon color="warning" />
                    </Badge>
                  </ListItemIcon>
                  <ListItemText
                    primary={course.CustomName}
                    secondary={`${course.enrollmentCount} enrollments`}
                  />
                </ListItem>
              ))}
            </List>
          )
        };
      case 'engagement':
        return {
          title: 'Engagement Metrics',
          content: (
            <Box>
              <Typography variant="body2" gutterBottom>Course Performance Distribution</Typography>
              {courseStats.slice(0, 5).map((course) => (
                <Box key={course.CourseBasicDataId} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">{course.CustomName}</Typography>
                    <Typography variant="body2">{course.enrollmentCount}</Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(course.enrollmentCount / Math.max(...courseStats.map(c => c.enrollmentCount))) * 100} 
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
              ))}
            </Box>
          )
        };
      case 'opportunities':
        return {
          title: 'Growth Opportunities',
          content: (
            <Box>
              <Typography variant="body2" gutterBottom color="text.secondary">
                Courses with potential for growth
              </Typography>
              {courseStats.filter(c => c.enrollmentCount < 3).slice(0, 5).map((course) => (
                <Chip
                  key={course.CourseBasicDataId}
                  label={`${course.CustomName} (${course.enrollmentCount})`}
                  variant="outlined"
                  color="warning"
                  sx={{ m: 0.5 }}
                />
              ))}
            </Box>
          )
        };
      default:
        return { title: 'Select an insight', content: null };
    }
  };

  const selectedInsightData = getInsightDetails(selectedInsight);

  return (
    <Box sx={{ p: 3 }}>
      {/* Hero Section */}
      <Fade in={true} timeout={800}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <PsychologyIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold', background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Training Analytics Dashboard
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
            AI-Powered Insights for Your Training Center
          </Typography>
          <Tooltip title="Refresh all data">
            <IconButton onClick={onRefresh} color="primary" size="large">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Fade>

      {/* Clickable Insight Cards */}
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
        🔍 Key Insights
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {insights.map((insight, index) => (
          <Grid item xs={12} sm={6} md={3} key={insight.id}>
            <Zoom in={true} timeout={500 + index * 100}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6,
                    '& .insight-icon': {
                      transform: 'scale(1.1)',
                    }
                  },
                  border: selectedInsight === insight.id ? 2 : 0,
                  borderColor: selectedInsight === insight.id ? `${insight.color}.main` : 'transparent',
                  background: selectedInsight === insight.id 
                    ? `linear-gradient(135deg, ${insight.color === 'primary' ? '#e3f2fd' : insight.color === 'success' ? '#e8f5e8' : insight.color === 'info' ? '#e1f5fe' : '#fff3e0'} 0%, white 100%)`
                    : 'white'
                }}
                onClick={() => handleInsightClick(insight.id)}
              >
                <CardActionArea>
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Avatar 
                      sx={{ 
                        bgcolor: `${insight.color}.main`, 
                        width: 56, 
                        height: 56, 
                        mx: 'auto', 
                        mb: 2,
                        transition: 'transform 0.3s ease'
                      }}
                      className="insight-icon"
                    >
                      {insight.icon}
                    </Avatar>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      {insight.title}
                    </Typography>
                    <Typography variant="h4" color={`${insight.color}.main`} sx={{ fontWeight: 'bold', mb: 1 }}>
                      {insight.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {insight.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Zoom>
          </Grid>
        ))}
      </Grid>

      {/* Detailed Insight Panel */}
      <Fade in={true} timeout={600}>
        <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <TimelineIcon color="primary" sx={{ mr: 2, fontSize: 32 }} />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {selectedInsightData.title}
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            {selectedInsightData.content}
          </CardContent>
        </Card>
      </Fade>

      {/* Summary Statistics */}
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
        📊 Performance Metrics
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Zoom in={true} timeout={700}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              color: 'white',
              '&:hover': { transform: 'scale(1.02)', transition: 'transform 0.2s' }
            }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <SchoolIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                  {totalCourses}
                </Typography>
                <Typography variant="h6">
                  Training Courses
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Available in portfolio
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Zoom in={true} timeout={800}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
              color: 'white',
              '&:hover': { transform: 'scale(1.02)', transition: 'transform 0.2s' }
            }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <PeopleIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                  {totalTrainees}
                </Typography>
                <Typography variant="h6">
                  Active Trainees
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Registered learners
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Zoom in={true} timeout={900}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 
              color: 'white',
              '&:hover': { transform: 'scale(1.02)', transition: 'transform 0.2s' }
            }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <DescriptionIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                  {totalEnrollments}
                </Typography>
                <Typography variant="h6">
                  Total Enrollments
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Course registrations
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Zoom in={true} timeout={1000}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', 
              color: 'white',
              '&:hover': { transform: 'scale(1.02)', transition: 'transform 0.2s' }
            }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                  {avgEnrollments}
                </Typography>
                <Typography variant="h6">
                  Avg. Engagement
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Enrollments per course
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>
      </Grid>

      {/* Course Status and Top Courses */}
      <Grid container spacing={3}>
        {courseStatusSummary.length > 0 && (
          <Grid item xs={12} md={6}>
            <Fade in={true} timeout={1100}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AssessmentIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Course Status Distribution
                    </Typography>
                  </Box>
                  <List>
                    {courseStatusSummary.map((status) => (
                      <ListItem key={status.status} sx={{ 
                        borderRadius: 2, 
                        mb: 1,
                        '&:hover': { bgcolor: 'action.hover' }
                      }}>
                        <ListItemIcon>
                          <Chip 
                            label={status.status} 
                            color="primary" 
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                              {status.label}
                            </Typography>
                          }
                          secondary={`${status.count} courses`}
                        />
                        <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
                          {status.count}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        )}

        <Grid item xs={12} md={6}>
          <Fade in={true} timeout={1200}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TrophyIcon color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Top Performing Courses
                  </Typography>
                </Box>
                <List>
                  {topCourses.map((course, index) => (
                    <ListItem key={course.CourseBasicDataId} sx={{ 
                      borderRadius: 2, 
                      mb: 1,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}>
                      <ListItemIcon>
                        <Avatar 
                          sx={{ 
                            bgcolor: index === 0 ? 'gold' : index === 1 ? 'silver' : '#cd7f32',
                            color: 'white',
                            width: 32,
                            height: 32,
                            fontSize: '0.875rem'
                          }}
                        >
                          #{index + 1}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                            {course.CustomName}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            <Chip 
                              label={getStatusLabel(course.Status)} 
                              size="small" 
                              variant="outlined"
                            />
                            <Chip 
                              label={`${course.enrollmentCount} enrollments`} 
                              size="small" 
                              color="primary"
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      </Grid>
    </Box>
  );
};

// Helper functions
function getCourseStatusSummary(courses) {
  const statusLabels = {
    1: 'Created',
    2: 'Opened', 
    3: 'Running',
    4: 'Closed',
    5: 'Archived'
  };

  const summary = {};
  courses.forEach(course => {
    const status = course.Status || 1;
    summary[status] = (summary[status] || 0) + 1;
  });
  
  return Object.keys(summary).map(status => ({
    status: parseInt(status),
    label: statusLabels[status] || 'Unknown',
    count: summary[status]
  }));
}

function getCourseStats(courses, enrollments) {
  return courses.map(course => {
    const courseEnrollments = enrollments.filter(e => e.CourseId === course.CourseBasicDataId);
    
    return {
      ...course,
      enrollmentCount: courseEnrollments.length,
      uniqueTrainees: new Set(courseEnrollments.map(e => e.MemberId)).size
    };
  });
}

function getStatusLabel(status) {
  const statusLabels = {
    1: 'Created',
    2: 'Opened', 
    3: 'Running',
    4: 'Closed',
    5: 'Archived'
  };
  return statusLabels[status] || 'Unknown';
}

export default Dashboard;