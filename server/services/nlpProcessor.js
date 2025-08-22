const AIService = require('./aiService');

class NLPProcessor {
  constructor() {
    this.aiService = new AIService();
  }

  /**
   * Process natural language query and convert to structured filters
   */
  async processNaturalLanguageQuery(query, dataContext = {}) {
    try {
      console.log('Processing NL query:', query);

      // Check if AI is available for advanced NLP
      if (global.oauthTokens && global.oauthTokens.access_token) {
        console.log('Using AI-powered NLP processing with Vertex AI');
        return await this.processWithAI(query, dataContext);
      } else {
        console.log('Using rule-based NLP processing (no OAuth tokens available)');
        return this.processWithRules(query, dataContext);
      }
    } catch (error) {
      console.error('NLP processing error:', error);
      return this.processWithRules(query, dataContext); // Fallback to rules
    }
  }

  /**
   * AI-powered natural language processing
   */
  async processWithAI(query, dataContext) {
    try {
      // Ensure we have valid tokens before making AI calls
      const TokenManager = require('./tokenManager');
      const tokenManager = new TokenManager(null); // We'll use the global instance
      const hasValidToken = await tokenManager.ensureValidToken();
      
      if (!hasValidToken) {
        console.log('❌ AI processing failed: Invalid or expired tokens, falling back to rules');
        return this.processWithRules(query, dataContext);
      }

      const prompt = `
You are an AI assistant for a training center recommendation system. Convert the user's natural language query into structured filters.

Available data context:
- Total courses: ${dataContext.totalCourses || 0}
- Total trainees: ${dataContext.totalTrainees || 0}
- Total enrollments: ${dataContext.totalEnrollments || 0}

User query: "${query}"

Convert this to a JSON object with these possible filters:
{
  "type": "insight" | "filter" | "search",
  "traineeFilters": {
    "nameSearch": string,
    "emailSearch": string, 
    "phoneSearch": string,
    "hasEnrollments": boolean,
    "minEnrollments": number,
    "maxEnrollments": number,
    "randomSample": boolean,
    "randomSampleSize": number
  },
  "courseFilters": {
    "courseStatus": number,
    "minProbability": number,
    "maxProbability": number,
    "maxRecommendations": number
  },
  "insightType": "trends" | "patterns" | "statistics" | "recommendations",
  "explanation": "What the user is looking for",
  "suggestedActions": ["action1", "action2"]
}

Examples:
- "Show me 5 random trainees" → {"type": "filter", "traineeFilters": {"randomSample": true, "randomSampleSize": 5}}
- "Find trainees from aljazeera" → {"type": "filter", "traineeFilters": {"emailSearch": "aljazeera"}}
- "Show enrollment trends" → {"type": "insight", "insightType": "trends"}
- "Active trainees with more than 3 courses" → {"type": "filter", "traineeFilters": {"hasEnrollments": true, "minEnrollments": 3}}

Respond with valid JSON only.`;

      const response = await this.aiService.generateRecommendations('vertex', prompt);
      
      if (typeof response === 'string') {
        // Try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      return response;
    } catch (error) {
      console.error('AI NLP processing failed:', error);
      return this.processWithRules(query, dataContext);
    }
  }

  /**
   * Rule-based natural language processing (fallback)
   */
  processWithRules(query, dataContext) {
    const lowerQuery = query.toLowerCase();
    const result = {
      type: 'filter',
      traineeFilters: {},
      courseFilters: {},
      explanation: '',
      suggestedActions: []
    };

    // Email domain detection
    if (lowerQuery.includes('aljazeera') || lowerQuery.includes('@aljazeera')) {
      result.traineeFilters.emailSearch = 'aljazeera';
      result.explanation += result.explanation ? ' and from Al Jazeera' : 'Filtering trainees from Al Jazeera';
    }

    // Random sampling
    const randomMatch = lowerQuery.match(/(\d+)\s*random/);
    if (randomMatch || lowerQuery.includes('random')) {
      const count = randomMatch ? parseInt(randomMatch[1]) : 10;
      result.traineeFilters.randomSample = true;
      result.traineeFilters.randomSampleSize = Math.min(count, 100);
      result.explanation = `Selecting ${result.traineeFilters.randomSampleSize} random trainees`;
    }

    // Number + domain pattern (e.g., "20 trainees from aljazeera")
    const numberDomainMatch = lowerQuery.match(/(\d+)\s+trainees?\s+from\s+(\w+)/) || 
                             lowerQuery.match(/(\d+)\s+(\w+)\s+trainees?/);
    if (numberDomainMatch) {
      const count = parseInt(numberDomainMatch[1]);
      const domain = numberDomainMatch[2];
      
      if (domain === 'aljazeera' || domain.includes('aljazeera')) {
        result.traineeFilters.emailSearch = 'aljazeera';
        result.traineeFilters.randomSample = true;
        result.traineeFilters.randomSampleSize = Math.min(count, 100);
        result.explanation = `Selecting ${count} trainees from Al Jazeera`;
      }
    }

    // Name search
    const nameMatch = lowerQuery.match(/name.*["']([^"']+)["']/) || 
                     lowerQuery.match(/called\s+([a-zA-Z\s]+)/) ||
                     lowerQuery.match(/named\s+([a-zA-Z\s]+)/);
    if (nameMatch) {
      result.traineeFilters.nameSearch = nameMatch[1].trim();
      result.explanation = `Searching for trainees named "${nameMatch[1].trim()}"`;
    }

    // Enrollment filters
    if (lowerQuery.includes('active') || lowerQuery.includes('enrolled')) {
      result.traineeFilters.hasEnrollments = true;
      result.explanation = 'Filtering active trainees with enrollments';
    }

    if (lowerQuery.includes('no enrollment') || 
        lowerQuery.includes('not enrolled') || 
        lowerQuery.includes('without enrollment') ||
        lowerQuery.includes('without any enrollment') ||
        lowerQuery.includes('no courses') ||
        lowerQuery.includes('zero enrollment')) {
      result.traineeFilters.hasEnrollments = false;
      result.explanation += result.explanation ? ' without any enrollments' : 'Filtering trainees without any enrollments';
    }

    // Number extraction for enrollments
    const numberMatch = lowerQuery.match(/more than (\d+)/) || 
                       lowerQuery.match(/at least (\d+)/) ||
                       lowerQuery.match(/minimum (\d+)/);
    if (numberMatch) {
      result.traineeFilters.minEnrollments = parseInt(numberMatch[1]);
      result.explanation += ` with at least ${numberMatch[1]} enrollments`;
    }

    const maxMatch = lowerQuery.match(/less than (\d+)/) || 
                    lowerQuery.match(/maximum (\d+)/) ||
                    lowerQuery.match(/up to (\d+)/);
    if (maxMatch) {
      result.traineeFilters.maxEnrollments = parseInt(maxMatch[1]);
      result.explanation += ` with maximum ${maxMatch[1]} enrollments`;
    }

    // Insight detection
    if (lowerQuery.includes('trend') || lowerQuery.includes('pattern') || lowerQuery.includes('insight')) {
      result.type = 'insight';
      result.insightType = 'trends';
      result.explanation = 'Generating enrollment trends and patterns';
    }

    if (lowerQuery.includes('statistic') || lowerQuery.includes('summary') || lowerQuery.includes('overview')) {
      result.type = 'insight';
      result.insightType = 'statistics';
      result.explanation = 'Generating statistical overview';
    }

    // Add suggested actions
    result.suggestedActions = this.generateSuggestedActions(result, dataContext);

    return result;
  }

  /**
   * Generate suggested actions based on the query result
   */
  generateSuggestedActions(result, dataContext) {
    const actions = [];

    if (result.type === 'filter') {
      actions.push('Generate recommendations for filtered trainees');
      actions.push('Export filtered trainee list');
      actions.push('View detailed trainee profiles');
    }

    if (result.type === 'insight') {
      actions.push('Generate detailed report');
      actions.push('Export insights to PDF');
      actions.push('Create visualization charts');
    }

    if (result.traineeFilters.randomSample) {
      actions.push('Increase sample size');
      actions.push('Try different random sample');
    }

    return actions;
  }

  /**
   * Generate dynamic insights based on data and user query
   */
  async generateDynamicInsights(query, data) {
    try {
      const { courses, trainees, enrollments } = data;
      
      // Basic statistics
      const stats = {
        totalCourses: courses.length,
        totalTrainees: trainees.length,
        totalEnrollments: enrollments.length,
        averageEnrollmentsPerTrainee: enrollments.length / trainees.length,
        averageEnrollmentsPerCourse: enrollments.length / courses.length
      };

      // Generate insights based on query
      const insights = [];

      if (query.toLowerCase().includes('trend') || query.toLowerCase().includes('popular')) {
        insights.push(this.generatePopularityInsights(courses, enrollments));
      }

      if (query.toLowerCase().includes('engagement') || query.toLowerCase().includes('active')) {
        insights.push(this.generateEngagementInsights(trainees, enrollments));
      }

      if (query.toLowerCase().includes('completion') || query.toLowerCase().includes('success')) {
        insights.push(this.generateCompletionInsights(courses, enrollments));
      }

      // If AI is available, enhance insights
      if (global.oauthTokens && global.oauthTokens.access_token) {
        const aiInsights = await this.generateAIInsights(query, stats, insights);
        if (aiInsights) {
          insights.push(aiInsights);
        }
      }

      return {
        success: true,
        query,
        statistics: stats,
        insights,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Dynamic insights generation error:', error);
      return {
        success: false,
        error: error.message,
        query
      };
    }
  }

  /**
   * Generate popularity insights
   */
  generatePopularityInsights(courses, enrollments) {
    const courseEnrollmentCounts = {};
    
    enrollments.forEach(enrollment => {
      courseEnrollmentCounts[enrollment.CourseId] = (courseEnrollmentCounts[enrollment.CourseId] || 0) + 1;
    });

    const topCourses = Object.entries(courseEnrollmentCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([courseId, count]) => {
        const course = courses.find(c => c.CourseBasicDataId === parseInt(courseId));
        return {
          courseId: parseInt(courseId),
          courseName: course ? course.CustomName : `Course ${courseId}`,
          enrollmentCount: count
        };
      });

    return {
      type: 'popularity',
      title: '📈 Most Popular Courses',
      description: 'Top 5 courses by enrollment count',
      data: topCourses,
      visualization: 'bar_chart'
    };
  }

  /**
   * Generate engagement insights
   */
  generateEngagementInsights(trainees, enrollments) {
    const traineeEngagement = {};
    
    enrollments.forEach(enrollment => {
      traineeEngagement[enrollment.MemberId] = (traineeEngagement[enrollment.MemberId] || 0) + 1;
    });

    const engagementLevels = {
      high: 0, // 5+ courses
      medium: 0, // 2-4 courses  
      low: 0, // 1 course
      none: 0 // 0 courses
    };

    trainees.forEach(trainee => {
      const enrollmentCount = traineeEngagement[trainee.MemberId] || 0;
      if (enrollmentCount >= 5) engagementLevels.high++;
      else if (enrollmentCount >= 2) engagementLevels.medium++;
      else if (enrollmentCount >= 1) engagementLevels.low++;
      else engagementLevels.none++;
    });

    return {
      type: 'engagement',
      title: '👥 Trainee Engagement Levels',
      description: 'Distribution of trainee engagement based on course enrollments',
      data: engagementLevels,
      visualization: 'pie_chart'
    };
  }

  /**
   * Generate completion insights
   */
  generateCompletionInsights(courses, enrollments) {
    const statusCounts = {};
    
    courses.forEach(course => {
      const status = course.Status || 1;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const statusLabels = {
      1: 'Created',
      2: 'Opened',
      3: 'Running', 
      4: 'Closed',
      5: 'Archived'
    };

    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      status: parseInt(status),
      statusLabel: statusLabels[status] || `Status ${status}`,
      count
    }));

    return {
      type: 'completion',
      title: '📊 Course Status Distribution',
      description: 'Current status of all courses in the system',
      data: statusData,
      visualization: 'donut_chart'
    };
  }

  /**
   * Generate AI-powered insights
   */
  async generateAIInsights(query, stats, existingInsights) {
    try {
      const prompt = `
Based on this training center data, provide insights for the user query: "${query}"

Data Summary:
- Total Courses: ${stats.totalCourses}
- Total Trainees: ${stats.totalTrainees}  
- Total Enrollments: ${stats.totalEnrollments}
- Avg Enrollments per Trainee: ${stats.averageEnrollmentsPerTrainee.toFixed(2)}
- Avg Enrollments per Course: ${stats.averageEnrollmentsPerCourse.toFixed(2)}

Generate 2-3 actionable insights in JSON format:
{
  "type": "ai_insights",
  "title": "🤖 AI-Generated Insights",
  "description": "AI analysis based on your query",
  "insights": [
    {
      "title": "Insight title",
      "description": "Detailed insight description",
      "recommendation": "Actionable recommendation",
      "impact": "high|medium|low"
    }
  ]
}

Focus on practical, actionable insights that help improve training outcomes.`;

      const response = await this.aiService.generateRecommendations('vertex', prompt);
      
      if (typeof response === 'string') {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      return response;
    } catch (error) {
      console.error('AI insights generation failed:', error);
      return null;
    }
  }
}

module.exports = NLPProcessor;
