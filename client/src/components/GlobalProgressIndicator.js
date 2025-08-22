import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Paper,
  Chip,
  Collapse,
  IconButton,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

const GlobalProgressIndicator = ({ backgroundTasks, onClearCompleted }) => {
  const [expanded, setExpanded] = React.useState(true);
  
  const runningTasks = backgroundTasks.filter(task => task.status === 'running');
  const completedTasks = backgroundTasks.filter(task => task.status === 'completed');
  const errorTasks = backgroundTasks.filter(task => task.status === 'error');

  if (backgroundTasks.length === 0) {
    return null;
  }

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        position: 'fixed', 
        bottom: 20, 
        right: 20, 
        width: 400, 
        zIndex: 1300,
        borderRadius: 3,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box 
        sx={{ 
          p: 2, 
          bgcolor: runningTasks.length > 0 ? 'primary.main' : 'success.main', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {runningTasks.length > 0 ? (
            <PsychologyIcon />
          ) : completedTasks.length > 0 ? (
            <CheckCircleIcon />
          ) : (
            <ErrorIcon />
          )}
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {runningTasks.length > 0 ? 'AI Analysis Running' : 
             completedTasks.length > 0 ? 'Analysis Completed' : 'Analysis Failed'}
          </Typography>
        </Box>
        
        <IconButton 
          size="small" 
          onClick={() => setExpanded(!expanded)}
          sx={{ color: 'white' }}
        >
          <ExpandMoreIcon 
            sx={{ 
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s'
            }} 
          />
        </IconButton>
      </Box>

      {/* Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {/* Running Tasks */}
          {runningTasks.map(task => (
            <Box key={task.id} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {task.currentStep || 'Processing...'}
                </Typography>
                <Typography variant="body2">
                  {Math.round(task.progress)}%
                </Typography>
              </Box>
              
              <LinearProgress 
                variant="determinate" 
                value={task.progress} 
                sx={{ 
                  height: 6, 
                  borderRadius: 3,
                  mb: 1,
                  backgroundColor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)'
                  }
                }} 
              />
              
              <Typography variant="caption" color="text.secondary">
                {task.message}
              </Typography>
            </Box>
          ))}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                Completed Tasks
              </Typography>
              {completedTasks.map(task => (
                <Chip
                  key={task.id}
                  label={`Task completed (${Math.round((Date.now() - task.startTime) / 1000)}s)`}
                  color="success"
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
          )}

          {/* Error Tasks */}
          {errorTasks.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="error" size="small">
                <Typography variant="caption">
                  {errorTasks.length} task(s) failed
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Clear Button */}
          {(completedTasks.length > 0 || errorTasks.length > 0) && runningTasks.length === 0 && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Chip
                label="Clear Completed"
                onClick={onClearCompleted}
                color="primary"
                variant="outlined"
                size="small"
              />
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default GlobalProgressIndicator;
