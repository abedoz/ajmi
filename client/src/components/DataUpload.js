import React, { useState } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip
} from '@mui/material';
import {
  CloudUpload,
  CheckCircle,
  Error,
  Info
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

const uploadConfigs = [
  {
    key: 'courses',
    title: 'Courses Data',
    description: 'Upload CSV with CourseBasicDataId, CustomName, Status',
    endpoint: '/api/upload/courses',
    expectedColumns: ['CourseBasicDataId', 'CustomName', 'Status'],
    example: 'COURSE001,Introduction to Programming,2'
  },
  {
    key: 'trainees',
    title: 'Trainees Data',
    description: 'Upload CSV with MemberId, Name, Mobile, Email',
    endpoint: '/api/upload/trainees',
    expectedColumns: ['MemberId', 'Name', 'Mobile', 'Email'],
    example: 'MEMBER001,John Doe,+1234567890,john@example.com'
  },
  {
    key: 'enrollments',
    title: 'Enrollments Data',
    description: 'Upload CSV with MemberId, CourseId',
    endpoint: '/api/upload/enrollments',
    expectedColumns: ['MemberId', 'CourseId'],
    example: 'MEMBER001,COURSE001'
  }
];

function FileUploadCard({ config, onDataUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult({
          success: true,
          message: result.message,
          count: result.count,
          sample: result.sample
        });
        toast.success(`${config.title} uploaded successfully!`);
        onDataUploaded();
      } else {
        setUploadResult({
          success: false,
          message: result.error || 'Upload failed'
        });
        toast.error(result.error || 'Upload failed');
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: 'Network error occurred'
      });
      toast.error('Network error occurred');
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false
  });

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {config.title}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" mb={2}>
          {config.description}
        </Typography>

        <Box
          {...getRootProps()}
          className={`upload-area ${isDragActive ? 'dragover' : ''}`}
          sx={{ mb: 2 }}
        >
          <input {...getInputProps()} />
          <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body1" gutterBottom>
            {isDragActive ? 'Drop the file here' : 'Drag & drop CSV file here'}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            or click to select file
          </Typography>
          <Button variant="outlined" component="span">
            Select File
          </Button>
        </Box>

        {uploading && (
          <Box mb={2}>
            <LinearProgress />
            <Typography variant="body2" align="center" mt={1}>
              Uploading...
            </Typography>
          </Box>
        )}

        {uploadResult && (
          <Alert 
            severity={uploadResult.success ? 'success' : 'error'}
            icon={uploadResult.success ? <CheckCircle /> : <Error />}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2">
              {uploadResult.message}
            </Typography>
            {uploadResult.success && uploadResult.count && (
              <Typography variant="body2" mt={1}>
                Processed {uploadResult.count} records
              </Typography>
            )}
          </Alert>
        )}

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Expected Columns:
          </Typography>
          <Box mb={2}>
            {config.expectedColumns.map((column) => (
              <Chip
                key={column}
                label={column}
                size="small"
                sx={{ mr: 1, mb: 1 }}
              />
            ))}
          </Box>
          
          <Typography variant="subtitle2" gutterBottom>
            Example Row:
          </Typography>
          <Box
            sx={{
              backgroundColor: 'grey.100',
              p: 1,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.875rem'
            }}
          >
            {config.example}
          </Box>
        </Box>

        {uploadResult?.success && uploadResult.sample && (
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              Sample Data:
            </Typography>
            <Box
              sx={{
                backgroundColor: 'success.50',
                p: 2,
                borderRadius: 1,
                maxHeight: 150,
                overflow: 'auto'
              }}
            >
              <pre style={{ fontSize: '0.75rem', margin: 0 }}>
                {JSON.stringify(uploadResult.sample, null, 2)}
              </pre>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function DataUpload({ onDataUploaded }) {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Data Upload
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body1" gutterBottom>
          <strong>Upload Instructions:</strong>
        </Typography>
        <List dense>
          <ListItem>
            <ListItemText primary="1. Upload your CSV files in the correct format" />
          </ListItem>
          <ListItem>
            <ListItemText primary="2. Ensure column headers match the expected format" />
          </ListItem>
          <ListItem>
            <ListItemText primary="3. Files will be processed immediately after upload" />
          </ListItem>
          <ListItem>
            <ListItemText primary="4. You can re-upload files to update the data" />
          </ListItem>
        </List>
      </Alert>

      <Grid container spacing={3}>
        {uploadConfigs.map((config) => (
          <Grid item xs={12} md={4} key={config.key}>
            <FileUploadCard 
              config={config}
              onDataUploaded={onDataUploaded}
            />
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3, mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Data Format Guidelines
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              Course Status Values:
            </Typography>
            <List dense>
              <ListItem><ListItemText primary="1 - Created" /></ListItem>
              <ListItem><ListItemText primary="2 - Opened" /></ListItem>
              <ListItem><ListItemText primary="3 - Running" /></ListItem>
              <ListItem><ListItemText primary="4 - Closed" /></ListItem>
              <ListItem><ListItemText primary="5 - Archived" /></ListItem>
            </List>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              File Requirements:
            </Typography>
            <List dense>
              <ListItem><ListItemText primary="• CSV format only" /></ListItem>
              <ListItem><ListItemText primary="• UTF-8 encoding recommended" /></ListItem>
              <ListItem><ListItemText primary="• First row should contain headers" /></ListItem>
              <ListItem><ListItemText primary="• No empty rows or columns" /></ListItem>
            </List>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              Data Quality Tips:
            </Typography>
            <List dense>
              <ListItem><ListItemText primary="• Use consistent ID formats" /></ListItem>
              <ListItem><ListItemText primary="• Avoid special characters in IDs" /></ListItem>
              <ListItem><ListItemText primary="• Ensure email formats are valid" /></ListItem>
              <ListItem><ListItemText primary="• Include country codes for phones" /></ListItem>
            </List>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

export default DataUpload;