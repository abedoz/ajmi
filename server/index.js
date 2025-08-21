const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const recommendationEngine = require('./services/recommendationEngine');
const aiService = require('./services/aiService');
const dataProcessor = require('./services/dataProcessor');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// In-memory data storage (in production, you'd use a database)
let coursesData = [];
let traineesData = [];
let enrollmentsData = [];

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Training Recommendations API is running' });
});

// Upload CSV files
app.post('/api/upload/courses', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        coursesData = dataProcessor.processCourses(results);
        fs.unlinkSync(req.file.path); // Clean up uploaded file
        res.json({ 
          message: 'Courses data uploaded successfully', 
          count: coursesData.length,
          sample: coursesData.slice(0, 3)
        });
      });
  } catch (error) {
    console.error('Error uploading courses:', error);
    res.status(500).json({ error: 'Failed to process courses file' });
  }
});

app.post('/api/upload/trainees', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        traineesData = dataProcessor.processTrainees(results);
        fs.unlinkSync(req.file.path);
        res.json({ 
          message: 'Trainees data uploaded successfully', 
          count: traineesData.length,
          sample: traineesData.slice(0, 3)
        });
      });
  } catch (error) {
    console.error('Error uploading trainees:', error);
    res.status(500).json({ error: 'Failed to process trainees file' });
  }
});

app.post('/api/upload/enrollments', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        enrollmentsData = dataProcessor.processEnrollments(results);
        fs.unlinkSync(req.file.path);
        res.json({ 
          message: 'Enrollments data uploaded successfully', 
          count: enrollmentsData.length,
          sample: enrollmentsData.slice(0, 3)
        });
      });
  } catch (error) {
    console.error('Error uploading enrollments:', error);
    res.status(500).json({ error: 'Failed to process enrollments file' });
  }
});

// Get data summaries
app.get('/api/data/summary', (req, res) => {
  res.json({
    courses: {
      total: coursesData.length,
      byStatus: dataProcessor.getCourseStatusSummary(coursesData)
    },
    trainees: {
      total: traineesData.length
    },
    enrollments: {
      total: enrollmentsData.length
    }
  });
});

// Get recommendations
app.post('/api/recommendations', async (req, res) => {
  try {
    const { 
      recommendationStyle, 
      courseStatuses, 
      targetCourseId, 
      useAI = false,
      aiApiKey 
    } = req.body;

    if (!coursesData.length || !traineesData.length || !enrollmentsData.length) {
      return res.status(400).json({ 
        error: 'Please upload all required data files first' 
      });
    }

    // Filter courses by status
    const filteredCourses = coursesData.filter(course => 
      courseStatuses.includes(parseInt(course.Status))
    );

    let recommendations = [];

    switch (recommendationStyle) {
      case 'similar':
        recommendations = recommendationEngine.getSimilarCourseRecommendations(
          targetCourseId, coursesData, traineesData, enrollmentsData
        );
        break;
      case 'progression':
        recommendations = recommendationEngine.getSkillProgressionRecommendations(
          filteredCourses, traineesData, enrollmentsData
        );
        break;
      case 'popular':
        recommendations = recommendationEngine.getPopularCourseRecommendations(
          filteredCourses, traineesData, enrollmentsData
        );
        break;
      case 'gaps':
        recommendations = recommendationEngine.getSkillGapRecommendations(
          filteredCourses, traineesData, enrollmentsData
        );
        break;
      default:
        return res.status(400).json({ error: 'Invalid recommendation style' });
    }

    // Enhance with AI if requested
    if (useAI && aiApiKey) {
      recommendations = await aiService.enhanceRecommendations(
        recommendations, coursesData, aiApiKey
      );
    }

    res.json({
      recommendations,
      metadata: {
        style: recommendationStyle,
        totalProspects: recommendations.length,
        courseStatuses: courseStatuses
      }
    });

  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Generate outreach messages
app.post('/api/outreach/generate', async (req, res) => {
  try {
    const { prospects, courseId, messageType, aiApiKey } = req.body;

    if (!aiApiKey) {
      return res.status(400).json({ error: 'AI API key is required for message generation' });
    }

    const course = coursesData.find(c => c.CourseBasicDataId === courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const messages = await aiService.generateOutreachMessages(
      prospects, course, messageType, aiApiKey
    );

    res.json({ messages });

  } catch (error) {
    console.error('Error generating outreach messages:', error);
    res.status(500).json({ error: 'Failed to generate outreach messages' });
  }
});

// Export prospects
app.post('/api/export/prospects', (req, res) => {
  try {
    const { prospects, format = 'csv' } = req.body;
    
    const csvData = dataProcessor.exportProspects(prospects, format);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=prospects.csv');
    res.send(csvData);

  } catch (error) {
    console.error('Error exporting prospects:', error);
    res.status(500).json({ error: 'Failed to export prospects' });
  }
});

// Test OpenAI API key
app.post('/api/test-openai', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const testResult = await aiService.testApiKey(apiKey);
    
    if (testResult.success) {
      res.json({ success: true, message: 'API key is valid' });
    } else {
      res.status(400).json({ error: testResult.error });
    }

  } catch (error) {
    console.error('Error testing API key:', error);
    res.status(500).json({ error: 'Failed to test API key' });
  }
});

// Generate analytics insights
app.post('/api/analytics/insights', async (req, res) => {
  try {
    const { data, apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const insights = await aiService.generateAnalyticsInsights(data, apiKey);
    res.json({ insights });

  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});