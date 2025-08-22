import React, { useState } from 'react';
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
  Card,
  CardContent,
  CircularProgress,
  Alert,
  TextField,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Send,
  Email,
  Sms,
  WhatsApp,
  ExpandMore,
  ContentCopy,
  Download
} from '@mui/icons-material';
import toast from 'react-hot-toast';

const MESSAGE_TYPES = [
  { value: 'email', label: 'Email', icon: <Email />, description: 'Professional email with subject line' },
  { value: 'sms', label: 'SMS', icon: <Sms />, description: 'Brief text message (160 chars)' },
  { value: 'whatsapp', label: 'WhatsApp', icon: <WhatsApp />, description: 'Casual message with emojis' }
];

function MessageCard({ message, index }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success('Message copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy message');
    }
  };

  const getMessageTypeIcon = () => {
    const messageType = MESSAGE_TYPES.find(t => t.value === message.messageType);
    return messageType ? messageType.icon : <Send />;
  };

  const getMessageTypeColor = () => {
    switch (message.messageType) {
      case 'email': return '#1976d2';
      case 'sms': return '#4caf50';
      case 'whatsapp': return '#25d366';
      default: return '#666';
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {message.prospect.Name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {message.prospect.Email}
            </Typography>
            {message.prospect.Mobile && (
              <Typography variant="body2" color="text.secondary">
                {message.prospect.Mobile}
              </Typography>
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              icon={getMessageTypeIcon()}
              label={message.messageType.toUpperCase()}
              size="small"
              style={{ backgroundColor: getMessageTypeColor(), color: 'white' }}
            />
            {message.generated && (
              <Chip
                label="AI Generated"
                color="success"
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </Box>

        <Box className="message-preview" sx={{ mb: 2 }}>
          {message.content}
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Course: {message.prospect.recommendedCourse}
          </Typography>
          <Tooltip title={copied ? "Copied!" : "Copy message"}>
            <IconButton onClick={handleCopy} size="small">
              <ContentCopy />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
}

function OutreachGenerator({ aiSettings }) {
  const [loading, setLoading] = useState(false);
  const [prospects, setProspects] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [messageType, setMessageType] = useState('email');
  const [messages, setMessages] = useState([]);
  const [prospectInput, setProspectInput] = useState('');

  const handleLoadProspects = () => {
    try {
      const inputData = JSON.parse(prospectInput);
      if (Array.isArray(inputData)) {
        setProspects(inputData);
        toast.success(`Loaded ${inputData.length} prospects`);
      } else {
        toast.error('Input must be a JSON array');
      }
    } catch (error) {
      toast.error('Invalid JSON format');
    }
  };

  const handleGenerateMessages = async () => {
    if (prospects.length === 0) {
      toast.error('Please load prospects first');
      return;
    }

    if (!selectedCourse) {
      toast.error('Please enter a course ID');
      return;
    }

    if (!aiSettings.apiKey) {
      toast.error('Please configure your OpenAI API key in Settings');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/outreach/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prospects: prospects.slice(0, 20), // Limit to control costs
          courseId: selectedCourse,
          messageType,
          aiApiKey: aiSettings.apiKey,
          provider: aiSettings.provider || 'openai',
          endpoint: aiSettings.endpoint || ''
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessages(result.messages);
        toast.success(`Generated ${result.messages.length} messages`);
      } else {
        toast.error(result.error || 'Failed to generate messages');
      }
    } catch (error) {
      console.error('Error generating messages:', error);
      toast.error('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleExportMessages = () => {
    if (messages.length === 0) {
      toast.error('No messages to export');
      return;
    }

    const exportData = messages.map(msg => ({
      Name: msg.prospect.Name,
      Email: msg.prospect.Email,
      Mobile: msg.prospect.Mobile,
      Course: msg.prospect.recommendedCourse,
      MessageType: msg.messageType,
      Message: msg.content,
      AIGenerated: msg.generated
    }));

    const csvContent = [
      Object.keys(exportData[0]).join(','),
      ...exportData.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
        ).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outreach_messages_${messageType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Messages exported successfully');
  };

  const sampleProspects = [
    {
      Name: "John Doe",
      Email: "john@example.com",
      Mobile: "+1234567890",
      recommendedCourse: "Advanced Python Programming",
      reason: "Completed beginner Python course with high scores"
    },
    {
      Name: "Jane Smith", 
      Email: "jane@example.com",
      Mobile: "+1234567891",
      recommendedCourse: "Data Science Fundamentals",
      reason: "Shows interest in analytics and has programming background"
    }
  ];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Outreach Generator
      </Typography>

      <Grid container spacing={3}>
        {/* Configuration Panel */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Configuration
            </Typography>

            <Box mb={3}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Message Type</InputLabel>
                <Select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value)}
                  label="Message Type"
                >
                  {MESSAGE_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      <Box display="flex" alignItems="center">
                        {type.icon}
                        <Box ml={1}>
                          <Typography variant="body1">{type.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {type.description}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Course ID"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                placeholder="Enter the course ID for outreach"
                sx={{ mb: 2 }}
              />
            </Box>

            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                onClick={handleGenerateMessages}
                disabled={loading || prospects.length === 0}
                startIcon={loading ? <CircularProgress size={16} /> : <Send />}
              >
                {loading ? 'Generating...' : 'Generate Messages'}
              </Button>

              {messages.length > 0 && (
                <Button
                  variant="outlined"
                  onClick={handleExportMessages}
                  startIcon={<Download />}
                >
                  Export
                </Button>
              )}
            </Box>
          </Paper>

          {/* Prospects Input */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Load Prospects
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              Copy recommendations from the Recommendation Engine or paste your own JSON data
            </Alert>

            <TextField
              fullWidth
              multiline
              rows={8}
              label="Prospects JSON Data"
              value={prospectInput}
              onChange={(e) => setProspectInput(e.target.value)}
              placeholder={JSON.stringify(sampleProspects, null, 2)}
              sx={{ mb: 2 }}
            />

            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Button
                variant="outlined"
                onClick={handleLoadProspects}
                disabled={!prospectInput.trim()}
              >
                Load Prospects
              </Button>
              
              {prospects.length > 0 && (
                <Chip
                  label={`${prospects.length} prospects loaded`}
                  color="success"
                  variant="outlined"
                />
              )}
            </Box>

            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>Sample JSON Format</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box
                  component="pre"
                  sx={{
                    backgroundColor: 'grey.100',
                    p: 2,
                    borderRadius: 1,
                    fontSize: '0.875rem',
                    overflow: 'auto'
                  }}
                >
                  {JSON.stringify(sampleProspects, null, 2)}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Paper>
        </Grid>

        {/* Messages Display */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Generated Messages ({messages.length})
            </Typography>

            {!aiSettings.apiKey && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Configure your OpenAI API key in Settings to enable AI message generation
              </Alert>
            )}

            {messages.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Send sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Messages Generated Yet
                </Typography>
                <Typography color="text.secondary">
                  Load prospects and click "Generate Messages" to create personalized outreach
                </Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
                {messages.map((message, index) => (
                  <MessageCard key={index} message={message} index={index} />
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default OutreachGenerator;