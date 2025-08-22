import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  People as PeopleIcon,
  School as SchoolIcon
} from '@mui/icons-material';

const DataUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      const fileType = selectedFile.name.split('.').pop().toLowerCase();
      if (['xlsx', 'xls', 'csv'].includes(fileType)) {
        setFile(selectedFile);
        setError(null);
        setUploadResult(null);
      } else {
        setError('Please select a valid Excel (.xlsx, .xls) or CSV file.');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult(result);
      } else {
        setError(result.error || 'Upload failed');
      }
    } catch (error) {
      setError('Network error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (fileName) => {
    const fileType = fileName.split('.').pop().toLowerCase();
    if (['xlsx', 'xls'].includes(fileType)) {
      return <DescriptionIcon color="primary" />;
    }
    return <DescriptionIcon />;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Data Upload
      </Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Upload Training Data
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Upload a single Excel file with three sheets:</strong>
          </Typography>
          <List dense sx={{ mt: 1 }}>
            <ListItem sx={{ py: 0 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <SchoolIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Courses Sheet" 
                secondary="CourseBasicDatald, CustomName, Status (1-5)" 
              />
            </ListItem>
            <ListItem sx={{ py: 0 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <PeopleIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Trainees Sheet" 
                secondary="Memberld, Name, Email, Phone" 
              />
            </ListItem>
            <ListItem sx={{ py: 0 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <DescriptionIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Enrollments Sheet" 
                secondary="Memberld, Courseld" 
              />
            </ListItem>
          </List>
          
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => window.open('/api/template', '_blank')}
              sx={{ mt: 1 }}
            >
              Download Excel Template
            </Button>
          </Box>
        </Alert>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={8}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
              sx={{ height: 56 }}
            >
              {file ? file.name : 'Choose Excel File (.xlsx, .xls) or CSV'}
              <input
                type="file"
                hidden
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
              />
            </Button>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={!file || uploading}
              fullWidth
              sx={{ height: 56 }}
            >
              {uploading ? <CircularProgress size={24} /> : 'Upload'}
            </Button>
          </Grid>
        </Grid>

        {file && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            {getFileIcon(file.name)}
            <Typography variant="body2" color="text.secondary">
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </Typography>
          </Box>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {uploadResult && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CheckCircleIcon color="success" />
            <Typography variant="h6" color="success.main">
              Upload Successful!
            </Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <SchoolIcon color="primary" />
                    <Typography variant="h6">Courses</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {uploadResult.summary.courses}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total courses uploaded
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <PeopleIcon color="primary" />
                    <Typography variant="h6">Trainees</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {uploadResult.summary.trainees}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total trainees uploaded
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <DescriptionIcon color="primary" />
                    <Typography variant="h6">Enrollments</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {uploadResult.summary.enrollments}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total enrollments uploaded
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Data Structure Summary
          </Typography>
          
          <Grid container spacing={2}>
            {uploadResult.sheets.courses.length > 0 && (
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Courses Sheet Columns
                    </Typography>
                    <List dense>
                      {uploadResult.sheets.courses.map((header, index) => (
                        <ListItem key={index} sx={{ py: 0 }}>
                          <ListItemText primary={header} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {uploadResult.sheets.trainees.length > 0 && (
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Trainees Sheet Columns
                    </Typography>
                    <List dense>
                      {uploadResult.sheets.trainees.map((header, index) => (
                        <ListItem key={index} sx={{ py: 0 }}>
                          <ListItemText primary={header} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {uploadResult.sheets.enrollments.length > 0 && (
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Enrollments Sheet Columns
                    </Typography>
                    <List dense>
                      {uploadResult.sheets.enrollments.map((header, index) => (
                        <ListItem key={index} sx={{ py: 0 }}>
                          <ListItemText primary={header} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default DataUpload;