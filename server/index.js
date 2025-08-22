const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AIService = require('./services/aiService');
const dataProcessor = require('./services/dataProcessor');
const RecommendationEngine = require('./services/recommendationEngine');
const ChunkedRecommendationEngine = require('./services/chunkedRecommendationEngine');
const GeminiNLPProcessor = require('./services/geminiNLPProcessor');
const DatabaseManager = require('./services/databaseManager');
const SimpleDatabaseManager = require('./services/simpleDatabaseManager');
const TokenManager = require('./services/tokenManager');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Initialize services
const aiService = new AIService();
const recommendationEngine = new RecommendationEngine();
const chunkedRecommendationEngine = new ChunkedRecommendationEngine();
const geminiNLPProcessor = new GeminiNLPProcessor();
const dbManager = new DatabaseManager();
const simpleDB = new SimpleDatabaseManager();

// OAuth 2.0 client for Vertex AI
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const tokenManager = new TokenManager(oauth2Client);

// Make token manager globally accessible
global.tokenManager = tokenManager;

// Global variable to store processed data
global.processedData = null;

// Data persistence file paths
const DATA_FILE_PATH = path.join(__dirname, 'data', 'processed_data.json');
const TOKENS_FILE_PATH = path.join(__dirname, 'data', 'oauth_tokens.json');

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load persisted data on startup
function loadPersistedData() {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE_PATH, 'utf8'));
      global.processedData = data;
      console.log('Loaded persisted data from file');
    }
  } catch (error) {
    console.error('Error loading persisted data:', error);
  }
}

// Load persisted OAuth tokens on startup
function loadPersistedTokens() {
  try {
    if (fs.existsSync(TOKENS_FILE_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE_PATH, 'utf8'));
      global.oauthTokens = tokens;
      oauth2Client.setCredentials(tokens);
      console.log('Loaded persisted OAuth tokens from file');
    }
  } catch (error) {
    console.error('Error loading persisted tokens:', error);
  }
}

// Save OAuth tokens to file
function saveTokensToFile(tokens) {
  try {
    fs.writeFileSync(TOKENS_FILE_PATH, JSON.stringify(tokens, null, 2));
    console.log('OAuth tokens saved to file');
  } catch (error) {
    console.error('Error saving tokens to file:', error);
  }
}

// Save data to file
function saveDataToFile(data) {
  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
    console.log('Data saved to file');
  } catch (error) {
    console.error('Error saving data to file:', error);
  }
}

// Clear persisted data
function clearPersistedData() {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      fs.unlinkSync(DATA_FILE_PATH);
    }
    global.processedData = null;
    console.log('Persisted data cleared');
  } catch (error) {
    console.error('Error clearing persisted data:', error);
  }
}

// Initialize database and load data on startup
async function initializeApp() {
  try {
    await dbManager.initialize();
    console.log('Database initialized successfully');
    
    loadPersistedData();
    loadPersistedTokens();
    
    // Import data to database if available
    if (global.processedData) {
      console.log('Importing existing data to database...');
      try {
        await dbManager.importData(global.processedData);
        console.log('Data import to database completed');
      } catch (dbError) {
        console.log('Database import failed, continuing with in-memory data');
      }
    }
    
    // Start automatic token refresh
    tokenManager.startAutoRefresh();
  } catch (error) {
    console.error('App initialization error:', error);
  }
}

initializeApp();

// OAuth 2.0 endpoints
app.get('/api/auth/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/cloud-platform.read-only'
  ];
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  
  res.json({ authUrl });
});

app.get('/api/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code not provided' });
  }
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Store tokens globally and persist to file
    global.oauthTokens = tokens;
    saveTokensToFile(tokens);
    
    // Redirect to frontend with success message
    res.redirect(`http://localhost:3000?auth=success&message=${encodeURIComponent('OAuth authentication successful! Google Cloud Vertex AI has been set as your default AI provider.')}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    // Redirect to frontend with error message
    res.redirect(`http://localhost:3000?auth=error&message=${encodeURIComponent('OAuth authentication failed')}`);
  }
});

app.get('/api/auth/status', (req, res) => {
  const tokenStatus = tokenManager.getTokenStatus();
  res.json(tokenStatus);
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const refreshed = await tokenManager.refreshToken();
    
    if (refreshed) {
      res.json({ 
        success: true, 
        message: 'Token refreshed successfully',
        accessToken: global.oauthTokens.access_token,
        expiresAt: new Date(global.oauthTokens.expiry_date).toLocaleString()
      });
    } else {
      res.status(400).json({ 
        success: false,
        error: 'Token refresh failed. Re-authentication may be required.' 
      });
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Token refresh failed' 
    });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Routes
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileType = path.extname(req.file.originalname).toLowerCase();

    let processedData;
    if (fileType === '.xlsx') {
      processedData = await dataProcessor.processExcelFile(filePath);
    } else if (fileType === '.csv') {
      processedData = await dataProcessor.processCSVFile(filePath);
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload .xlsx or .csv files.' });
    }

    // Store processed data globally and save to file
    global.processedData = processedData;
    saveDataToFile(processedData);

    // Clean up uploaded file
    dataProcessor.cleanupFile(filePath);

        res.json({ 
      success: true,
      message: 'File processed successfully',
      data: {
        courses: processedData.coursesRowCount,
        trainees: processedData.traineesRowCount,
        enrollments: processedData.enrollmentsRowCount,
        coursesHeaders: processedData.coursesHeaders,
        traineesHeaders: processedData.traineesHeaders,
        enrollmentsHeaders: processedData.enrollmentsHeaders
      }
      });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get processed data endpoint
app.get('/api/data', (req, res) => {
  if (!global.processedData) {
    return res.status(404).json({ error: 'No data available. Please upload a file first.' });
  }
  res.json({
    success: true,
    data: global.processedData
  });
});

// Clear data endpoint
app.delete('/api/data', (req, res) => {
  clearPersistedData();
  res.json({ success: true, message: 'Data cleared successfully' });
});

// Serve sample Excel template
app.get('/api/template', (req, res) => {
  try {
    const XLSX = require('xlsx');
    // Create sample data for each sheet with exact format specified
    const coursesData = [
      ['CourseBasicDatald', 'CustomName', 'Status'],
      ['COURSE001', 'Introduction to Programming', 1],
      ['COURSE002', 'Advanced JavaScript', 2],
      ['COURSE003', 'Data Science Fundamentals', 1]
    ];
    const traineesData = [
      ['Memberld', 'Name', 'Email', 'Phone'],
      ['MEMBER001', 'John Doe', 'john@example.com', '+1234567890'],
      ['MEMBER002', 'Jane Smith', 'jane@example.com', '+1234567891'],
      ['MEMBER003', 'Bob Johnson', 'bob@example.com', '+1234567892']
    ];
    const enrollmentsData = [
      ['Memberld', 'Courseld'],
      ['MEMBER001', 'COURSE001'],
      ['MEMBER002', 'COURSE001'],
      ['MEMBER001', 'COURSE002'],
      ['MEMBER003', 'COURSE003']
    ];
    // Create workbook with multiple sheets
    const workbook = XLSX.utils.book_new();
    // Add sheets
    const coursesSheet = XLSX.utils.aoa_to_sheet(coursesData);
    const traineesSheet = XLSX.utils.aoa_to_sheet(traineesData);
    const enrollmentsSheet = XLSX.utils.aoa_to_sheet(enrollmentsData);
    XLSX.utils.book_append_sheet(workbook, coursesSheet, 'Courses');
    XLSX.utils.book_append_sheet(workbook, traineesSheet, 'Trainees');
    XLSX.utils.book_append_sheet(workbook, enrollmentsSheet, 'Enrollments');
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="training_data_template.xlsx"');
    // Write to buffer and send
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// Test API key endpoint
app.post('/api/test-api-key', async (req, res) => {
  try {
    const { provider, apiKey, endpoint, model } = req.body;
    
    console.log('Testing API key for provider:', provider);
    
    let result;
    
    switch (provider) {
      case 'openai':
        result = await aiService.testOpenAI(apiKey);
        break;
      case 'azure':
        result = await aiService.testAzureOpenAI(apiKey, endpoint);
        break;
      case 'gemini':
        result = await aiService.testGemini(apiKey);
        break;
      case 'claude':
        result = await aiService.testClaude(apiKey);
        break;
      case 'vertex':
        const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'ajgc-mep-app-dev-ccd-01';
        const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
        result = await aiService.testVertexAI(apiKey, projectId, location);
        break;
      default:
        result = { success: false, message: 'Unsupported provider' };
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error testing API key:', error);
    res.status(500).json({ success: false, message: 'Error testing API key' });
  }
});

// Generate recommendations endpoint
app.post('/api/generate-recommendations', async (req, res) => {
  try {
    const { style, targetCourseId, useAI, aiProvider, aiModel, aiApiKey, aiEndpoint } = req.body;

    if (!global.processedData) {
      return res.status(400).json({ error: 'No data available. Please upload a file first.' });
    }

    // If AI is enabled, create AI client
    if (useAI && aiProvider && aiModel && aiApiKey) {
      aiService.createAIClient(aiProvider, aiApiKey, aiEndpoint, aiModel);
    }

    // Generate basic recommendations first
    const dataProcessor = require('./services/dataProcessor');
    let recommendations = dataProcessor.generateRecommendations(
      global.processedData,
      style,
      targetCourseId
    );

    // Enhance with AI if enabled
    if (useAI && aiProvider) {
      try {
        const prompt = `Based on the following course recommendations, provide enhanced insights and suggestions:\n\n${JSON.stringify(recommendations, null, 2)}\n\nPlease provide additional insights, trends, and personalized recommendations for each course.`;
        
        const aiInsight = await aiService.generateRecommendations(
          aiProvider,
          prompt,
          aiApiKey,
          aiEndpoint,
          aiModel
        );
        
        // Add AI insights to recommendations
        recommendations = recommendations.map((rec, index) => ({
          ...rec,
          aiInsight: aiInsight ? `AI Enhanced: ${aiInsight.substring(0, 200)}...` : null
        }));
      } catch (aiError) {
        console.error('AI enhancement failed:', aiError);
        // Continue with basic recommendations if AI fails
      }
    }

    res.json({
      success: true,
      recommendations: recommendations
    });
  } catch (error) {
    console.error('Recommendation generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint for testing database queries
app.get('/api/debug-trainees', async (req, res) => {
  try {
    // Simple query to get trainees without enrollments
    const query = `
      SELECT t.member_id, t.name, t.email, COUNT(e.course_id) as enrollment_count
      FROM trainees t
      LEFT JOIN enrollments e ON t.member_id = e.member_id
      GROUP BY t.member_id, t.name, t.email
      HAVING enrollment_count = 0
      LIMIT 5
    `;
    
    const result = await dbManager.getAllRows(query);
    
    res.json({
      success: true,
      query: query,
      count: result.length,
      sample: result
    });

  } catch (error) {
    console.error('Debug query error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Simple working endpoint for NLP queries
app.post('/api/nlp-trainees', async (req, res) => {
  try {
    const { query, filters = {}, pagination = {} } = req.body;
    
    console.log('NLP Trainees query:', query, 'Filters:', filters);
    
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;
    
    let trainees = [];
    let total = 0;
    
    // Handle specific filter cases with compound conditions
    if (filters.emailSearch && filters.randomSample) {
      // Compound filter: specific domain + random sampling
      trainees = await simpleDB.getRandomTraineesFromDomain(filters.emailSearch, filters.randomSampleSize || 20);
      total = trainees.length;
    } else if (filters.emailSearch && filters.hasEnrollments === false) {
      // Compound filter: specific domain + no enrollments
      trainees = await simpleDB.getTraineesFromDomainWithoutEnrollments(filters.emailSearch, limit, offset);
      total = await simpleDB.countTraineesFromDomainWithoutEnrollments(filters.emailSearch);
    } else if (filters.hasEnrollments === false) {
      // Trainees without enrollments
      trainees = await simpleDB.getTraineesWithoutEnrollments(limit, offset);
      total = await simpleDB.countTraineesWithoutEnrollments();
    } else if (filters.hasEnrollments === true) {
      // Trainees with enrollments
      trainees = await simpleDB.getTraineesWithEnrollments(limit, offset);
      total = 23308; // From statistics - trainees with enrollments
    } else if (filters.randomSample) {
      // Random trainees
      trainees = await simpleDB.getRandomTrainees(filters.randomSampleSize || 10);
      total = trainees.length;
    } else if (filters.nameSearch || filters.emailSearch) {
      // Search trainees
      const searchTerm = filters.nameSearch || filters.emailSearch || '';
      trainees = await simpleDB.searchTrainees(searchTerm, limit, offset);
      total = trainees.length; // Approximate for search
    } else {
      // Default: get some trainees with enrollments
      trainees = await simpleDB.getTraineesWithEnrollments(limit, offset);
      total = 23308;
    }
    
    res.json({
      success: true,
      data: trainees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters,
      query,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('NLP trainees error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// High-performance trainee search endpoint using database
app.post('/api/search-trainees', async (req, res) => {
  try {
    const { searchTerm, options = {} } = req.body;
    
    if (!searchTerm || !searchTerm.trim()) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    const result = await dbManager.searchTrainees(searchTerm, options);
    res.json(result);

  } catch (error) {
    console.error('Trainee search error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// High-performance filtered trainees endpoint
app.post('/api/filtered-trainees', async (req, res) => {
  try {
    const { filters = {}, pagination = {} } = req.body;
    
    const result = await dbManager.getFilteredTrainees(filters, pagination);
    res.json(result);

  } catch (error) {
    console.error('Filtered trainees error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// High-performance statistics endpoint
app.get('/api/statistics', async (req, res) => {
  try {
    const result = await dbManager.getStatistics();
    res.json(result);

  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Optimized trainee recommendations endpoint
app.post('/api/trainee-recommendations/:traineeId', async (req, res) => {
  try {
    const { traineeId } = req.params;
    const options = req.body;
    
    const result = await dbManager.getTraineeRecommendations(parseInt(traineeId), options);
    res.json(result);

  } catch (error) {
    console.error('Trainee recommendations error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// NLP insights endpoint
app.post('/api/nlp-insights', async (req, res) => {
  try {
    const { query, dataContext } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!global.processedData) {
      return res.status(400).json({ error: 'No data available. Please upload a file first.' });
    }

    console.log('Processing NLP query:', query);

    // Process the natural language query with Gemini AI
    const result = await geminiNLPProcessor.processNaturalLanguageQuery(query, dataContext);

    // If it's an insight request, generate dynamic insights
    if (result.type === 'insight') {
      // For insights, use rule-based generation for now
      const insights = { 
        success: true, 
        query, 
        insights: [{ 
          type: 'info', 
          title: 'Insight Request', 
          description: 'Insight generation feature coming soon' 
        }] 
      };
      res.json(insights);
    } else if (result.type === 'filter') {
      // Execute the filter using the working database with intelligent limit handling
      let trainees = [];
      let total = 0;
      
      // Smart limit calculation: use maxResults, randomSampleSize, or default
      const effectiveLimit = result.traineeFilters.randomSampleSize || 
                            result.traineeFilters.maxResults || 
                            20;
      
      console.log(`🔍 Executing filter with effective limit: ${effectiveLimit}`);
      console.log(`📊 Filter criteria:`, JSON.stringify(result.traineeFilters, null, 2));
      
      if (result.traineeFilters.emailSearch && result.traineeFilters.randomSample) {
        // Compound filter: specific domain + random sampling
        trainees = await simpleDB.getRandomTraineesFromDomain(result.traineeFilters.emailSearch, effectiveLimit);
        total = trainees.length;
      } else if (result.traineeFilters.emailSearch && result.traineeFilters.minEnrollments) {
        // Compound filter: specific domain + minimum enrollments - use simple DB with post-processing
        console.log(`🔍 Using simple database with post-processing for complex query: domain=${result.traineeFilters.emailSearch}, minEnrollments=${result.traineeFilters.minEnrollments}`);
        
        // Get all trainees from the domain first (larger limit to account for filtering)
        const allDomainTrainees = await simpleDB.searchTrainees(result.traineeFilters.emailSearch, effectiveLimit * 3, 0);
        
        // Filter by minimum enrollments
        const filteredTrainees = allDomainTrainees.filter(trainee => 
          trainee.enrollment_count >= result.traineeFilters.minEnrollments
        );
        
        // Sort by enrollment count (descending) and limit results
        trainees = filteredTrainees
          .sort((a, b) => b.enrollment_count - a.enrollment_count)
          .slice(0, effectiveLimit);
        
        total = filteredTrainees.length;
      } else if (result.traineeFilters.emailSearch && result.traineeFilters.hasEnrollments === false) {
        // Compound filter: specific domain + no enrollments
        trainees = await simpleDB.getTraineesFromDomainWithoutEnrollments(result.traineeFilters.emailSearch, effectiveLimit, 0);
        total = await simpleDB.countTraineesFromDomainWithoutEnrollments(result.traineeFilters.emailSearch);
      } else if (result.traineeFilters.emailSearch && result.traineeFilters.hasEnrollments === true) {
        // Compound filter: specific domain + with enrollments
        trainees = await simpleDB.getTraineesFromDomainWithEnrollments(result.traineeFilters.emailSearch, effectiveLimit, 0);
        total = await simpleDB.countTraineesFromDomainWithEnrollments(result.traineeFilters.emailSearch);
      } else if (result.traineeFilters.hasEnrollments === false) {
        trainees = await simpleDB.getTraineesWithoutEnrollments(effectiveLimit, 0);
        total = await simpleDB.countTraineesWithoutEnrollments();
      } else if (result.traineeFilters.hasEnrollments === true) {
        trainees = await simpleDB.getTraineesWithEnrollments(effectiveLimit, 0);
        total = 23308; // This should be calculated dynamically
      } else if (result.traineeFilters.minEnrollments) {
        // Filter by minimum enrollments only - use simple DB with post-processing
        console.log(`🔍 Using simple database with post-processing for minEnrollments filter: ${result.traineeFilters.minEnrollments}`);
        
        // Get all trainees first (larger limit to account for filtering)
        const allTrainees = await simpleDB.getTrainees(effectiveLimit * 5, 0);
        
        // Filter by minimum enrollments
        const filteredTrainees = allTrainees.filter(trainee => 
          trainee.enrollment_count >= result.traineeFilters.minEnrollments
        );
        
        // Sort by enrollment count (descending) and limit results
        trainees = filteredTrainees
          .sort((a, b) => b.enrollment_count - a.enrollment_count)
          .slice(0, effectiveLimit);
        
        total = filteredTrainees.length;
      } else if (result.traineeFilters.randomSample) {
        trainees = await simpleDB.getRandomTrainees(effectiveLimit);
        total = trainees.length;
      } else if (result.traineeFilters.emailSearch) {
        // Email search only
        trainees = await simpleDB.searchTrainees(result.traineeFilters.emailSearch, effectiveLimit, 0);
        total = trainees.length;
      } else {
        // General query - get trainees with smart limit
        trainees = await simpleDB.getTrainees(effectiveLimit, 0);
        total = await simpleDB.countAllTrainees();
      }
      
      console.log(`✅ Query executed: Found ${trainees.length} trainees (total available: ${total})`);
      
      res.json({
        success: true,
        query,
        type: result.type,
        traineeFilters: result.traineeFilters,
        courseFilters: result.courseFilters,
        explanation: result.explanation,
        suggestedActions: result.suggestedActions,
        confidence: result.confidence,
        processedBy: result.processedBy,
        results: {
          success: true,
          data: trainees,
          pagination: { 
            page: 1, 
            limit: effectiveLimit, 
            total, 
            totalPages: Math.ceil(total / effectiveLimit),
            actualResults: trainees.length
          }
        },
        processedAt: new Date().toISOString()
      });
    } else {
      // Return the processed filters and suggestions
      res.json({
        success: true,
        query,
        type: result.type,
        traineeFilters: result.traineeFilters,
        courseFilters: result.courseFilters,
        explanation: result.explanation,
        suggestedActions: result.suggestedActions,
        processedAt: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('NLP insights error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      query: req.body.query
    });
  }
});

// Data validation endpoint
app.get('/api/validate-data', (req, res) => {
  try {
    if (!global.processedData) {
      return res.status(400).json({ error: 'No data available' });
    }

    const { courses, enrollments, trainees } = global.processedData;
    
    // Create course ID set for fast lookup
    const courseIds = new Set(courses.map(c => c.CourseBasicDataId));
    
    // Find enrollments with missing courses
    const invalidEnrollments = enrollments.filter(e => !courseIds.has(e.CourseId));
    const uniqueInvalidCourseIds = [...new Set(invalidEnrollments.map(e => e.CourseId))];
    
    // Find trainees with invalid enrollments
    const affectedTrainees = trainees.filter(t => 
      enrollments.some(e => e.MemberId === t.MemberId && !courseIds.has(e.CourseId))
    );

    res.json({
      success: true,
      validation: {
        totalCourses: courses.length,
        totalEnrollments: enrollments.length,
        totalTrainees: trainees.length,
        invalidEnrollments: invalidEnrollments.length,
        uniqueInvalidCourseIds: uniqueInvalidCourseIds.length,
        affectedTrainees: affectedTrainees.length,
        invalidCourseIds: uniqueInvalidCourseIds.slice(0, 10), // Show first 10
        sampleAffectedTrainees: affectedTrainees.slice(0, 5).map(t => ({
          id: t.MemberId,
          name: t.Name,
          email: t.Email
        }))
      }
    });
  } catch (error) {
    console.error('Data validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate AI-powered trainee recommendations endpoint (streaming)
app.get('/api/generate-trainee-recommendations-stream', async (req, res) => {
  try {
    const { 
      useAI = 'true', 
      aiProvider = 'vertex', 
      maxRecommendations = '5', 
      minProbability = '0.1',
      maxTrainees = '50',
      // Trainee filters
      nameSearch = '',
      emailSearch = '',
      phoneSearch = '',
      hasEnrollments = '',
      minEnrollments = '',
      maxEnrollments = '',
      randomSample = 'false',
      randomSampleSize = '10',
      maxResults = ''
    } = req.query;

    if (!global.processedData) {
      return res.status(400).json({ error: 'No data available. Please upload a file first.' });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    console.log('Starting streaming AI-powered trainee recommendations...');

    // Send initial progress
    sendProgress({
      type: 'progress',
      stage: 'initializing',
      message: 'Initializing AI recommendation engine...',
      progress: 0,
      totalTrainees: global.processedData.trainees?.length || 0,
      totalCourses: global.processedData.courses?.length || 0
    });

    try {
      const result = await chunkedRecommendationEngine.generateTraineeRecommendationsChunked(
        global.processedData,
        {
          useAI: useAI === 'true',
          aiProvider,
          maxRecommendations: parseInt(maxRecommendations),
          minProbability: parseFloat(minProbability),
          maxTrainees: parseInt(maxTrainees),
          includeExplanations: true,
          chunkSize: 20, // Process 20 trainees per chunk for faster processing
          traineeFilters: {
            nameSearch: nameSearch || undefined,
            emailSearch: emailSearch || undefined,
            phoneSearch: phoneSearch || undefined,
            hasEnrollments: hasEnrollments === 'true' ? true : hasEnrollments === 'false' ? false : undefined,
            minEnrollments: minEnrollments ? parseInt(minEnrollments) : undefined,
            maxEnrollments: maxEnrollments ? parseInt(maxEnrollments) : undefined,
            randomSample: randomSample === 'true',
            randomSampleSize: parseInt(randomSampleSize),
            maxResults: maxResults ? parseInt(maxResults) : undefined,
            enrollments: global.processedData.enrollments // Pass enrollments for filtering
          }
        },
        sendProgress // Pass the progress callback
      );

      // Send final result
      sendProgress({
        type: 'complete',
        message: 'AI analysis completed successfully!',
        progress: 100,
        result: result
      });

    } catch (error) {
      console.error('Streaming recommendation error:', error);
      sendProgress({
        type: 'error',
        message: error.message,
        progress: 0
      });
    }

    res.end();
  } catch (error) {
    console.error('Streaming setup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate AI-powered trainee recommendations endpoint (non-streaming fallback)
app.post('/api/generate-trainee-recommendations', async (req, res) => {
  try {
    const { 
      useAI = true, 
      aiProvider = 'vertex', 
      maxRecommendations = 5, 
      minProbability = 0.1,
      filters = {}
    } = req.body;

    if (!global.processedData) {
      return res.status(400).json({ error: 'No data available. Please upload a file first.' });
    }

    console.log('Generating AI-powered trainee recommendations...');

    const result = await recommendationEngine.generateTraineeRecommendations(
      global.processedData,
      {
        useAI,
        aiProvider,
        maxRecommendations,
        minProbability,
        includeExplanations: true
      }
    );

    // Apply filters if provided
    let filteredResult = result;
    if (Object.keys(filters).length > 0) {
      filteredResult.data = recommendationEngine.filterAndSortRecommendations(result.data, filters);
    }

    res.json(filteredResult);
  } catch (error) {
    console.error('Trainee recommendation generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export data endpoint
app.get('/api/export/:type', async (req, res) => {
  try {
    if (!global.processedData) {
      return res.status(400).json({ error: 'No data available to export' });
    }

    const { type } = req.params;
    const filePath = await dataProcessor.exportToCSV(global.processedData, type);
    
    res.download(filePath, `${type}_export.csv`, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      // Clean up file after download
      dataProcessor.cleanupFile(filePath);
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export prospects endpoint
app.post('/api/export-prospects', async (req, res) => {
  try {
    const { courseId, filters } = req.body;
    
    if (!global.processedData) {
      return res.status(400).json({ error: 'No data available' });
    }

    const prospects = dataProcessor.exportProspects(global.processedData, courseId, filters);
    const filePath = await dataProcessor.exportProspectsToCSV(prospects);
    
    res.download(filePath, 'prospects_export.csv', (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      // Clean up file after download
      dataProcessor.cleanupFile(filePath);
    });
  } catch (error) {
    console.error('Prospects export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV);
});