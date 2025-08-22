const AIService = require('./aiService');

class AdvancedNLPProcessor {
  constructor() {
    this.aiService = new AIService();
  }

  /**
   * Process natural language query using Gemini AI exclusively
   */
  async processNaturalLanguageQuery(query, dataContext = {}) {
    try {
      console.log('🤖 Processing NL query with Gemini AI:', query);

      // Ensure we have valid tokens
      if (!global.tokenManager) {
        throw new Error('Token manager not initialized');
      }
      
      const hasValidToken = await global.tokenManager.ensureValidToken();
      
      if (!hasValidToken) {
        throw new Error('OAuth authentication required. Please authenticate with Google first.');
      }

      // Use Gemini for all NLP processing
      return await this.processWithGeminiAI(query, dataContext);

    } catch (error) {
      console.error('❌ Advanced NLP processing error:', error.message);
      console.error('❌ Full error:', error);
      // Only fallback to rules if absolutely necessary
      console.log('🔄 Falling back to basic rule processing...');
      return this.processWithBasicRules(query, dataContext);
    }
  }

  /**
   * Advanced AI-powered natural language processing using Gemini
   */
  async processWithGeminiAI(query, dataContext) {
    try {
      const prompt = `
You are an advanced AI assistant for a training center recommendation system. You have access to a comprehensive database with the following data:

📊 CURRENT DATA CONTEXT:
- Total Courses: ${dataContext.totalCourses || 0}
- Total Trainees: ${dataContext.totalTrainees || 0}
- Total Enrollments: ${dataContext.totalEnrollments || 0}
- Database: SQLite with indexed searches
- Available Domains: aljazeera.net, gmail.com, hotmail.com, outlook.com, and others

🎯 USER QUERY: "${query}"

Your task is to convert this natural language query into a structured response that the application can execute. Be intelligent about understanding the user's intent.

RESPOND WITH VALID JSON ONLY in this exact format:
{
  "type": "filter" | "insight" | "search",
  "traineeFilters": {
    "nameSearch": "string or null",
    "emailSearch": "string or null", 
    "phoneSearch": "string or null",
    "hasEnrollments": true | false | null,
    "minEnrollments": number | null,
    "maxEnrollments": number | null,
    "randomSample": true | false,
    "randomSampleSize": number | null,
    "maxResults": number | null
  },
  "courseFilters": {
    "courseStatus": number | null,
    "minProbability": number | null,
    "maxProbability": number | null,
    "maxRecommendations": number | null
  },
  "insightType": "trends" | "patterns" | "statistics" | "recommendations" | null,
  "explanation": "Clear explanation of what you understood",
  "suggestedActions": ["action1", "action2", "action3"],
  "confidence": 0.95,
  "queryType": "simple" | "compound" | "complex"
}

🧠 INTELLIGENCE GUIDELINES:
1. For queries like "20 trainees from aljazeera" → Set emailSearch: "aljazeera", randomSample: true, randomSampleSize: 20
2. For "active trainees" → Set hasEnrollments: true
3. For "trainees without enrollments" → Set hasEnrollments: false
4. For "more than X courses" → Set minEnrollments: X
5. For "show trends" or "insights" → Set type: "insight"
6. For specific names → Set nameSearch with the name
7. For phone numbers → Set phoneSearch with the number
8. Be smart about compound conditions and multiple filters

🎯 EXAMPLES:
- "Find 10 random trainees from aljazeera" → {"type": "filter", "traineeFilters": {"emailSearch": "aljazeera", "randomSample": true, "randomSampleSize": 10}}
- "Show me active trainees with more than 3 courses" → {"type": "filter", "traineeFilters": {"hasEnrollments": true, "minEnrollments": 3}}
- "Trainees without any enrollments" → {"type": "filter", "traineeFilters": {"hasEnrollments": false}}
- "Show enrollment trends" → {"type": "insight", "insightType": "trends"}

Be extremely intelligent and context-aware. Understand the user's intent perfectly.`;

      console.log('🚀 Sending query to Gemini AI...');
      console.log('📝 Prompt preview:', prompt.substring(0, 200) + '...');
      
      const response = await this.aiService.generateRecommendations('vertex', prompt);
      
      console.log('🤖 Gemini AI response type:', typeof response);
      console.log('🤖 Gemini AI response preview:', JSON.stringify(response).substring(0, 200) + '...');
      
      console.log('🤖 Gemini AI raw response:', response);

      // Parse Gemini's response
      let parsedResponse;
      if (typeof response === 'string') {
        // Extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsedResponse = JSON.parse(jsonMatch[0]);
            console.log('✅ Successfully parsed Gemini response:', parsedResponse);
          } catch (parseError) {
            console.error('❌ Failed to parse Gemini JSON:', parseError);
            throw new Error('Invalid JSON response from Gemini');
          }
        } else {
          throw new Error('No JSON found in Gemini response');
        }
      } else if (typeof response === 'object') {
        parsedResponse = response;
      } else {
        throw new Error('Unexpected response format from Gemini');
      }

      // Validate and enhance the response
      const validatedResponse = this.validateAndEnhanceResponse(parsedResponse, query);
      
      console.log('🎯 Final processed response:', validatedResponse);
      return validatedResponse;

    } catch (error) {
      console.error('❌ Gemini AI processing failed:', error);
      throw error;
    }
  }

  /**
   * Validate and enhance Gemini's response
   */
  validateAndEnhanceResponse(response, originalQuery) {
    // Set defaults for any missing fields
    const validated = {
      type: response.type || 'filter',
      traineeFilters: {
        nameSearch: response.traineeFilters?.nameSearch || null,
        emailSearch: response.traineeFilters?.emailSearch || null,
        phoneSearch: response.traineeFilters?.phoneSearch || null,
        hasEnrollments: response.traineeFilters?.hasEnrollments || null,
        minEnrollments: response.traineeFilters?.minEnrollments || null,
        maxEnrollments: response.traineeFilters?.maxEnrollments || null,
        randomSample: response.traineeFilters?.randomSample || false,
        randomSampleSize: response.traineeFilters?.randomSampleSize || null
      },
      courseFilters: {
        courseStatus: response.courseFilters?.courseStatus || null,
        minProbability: response.courseFilters?.minProbability || null,
        maxProbability: response.courseFilters?.maxProbability || null,
        maxRecommendations: response.courseFilters?.maxRecommendations || null
      },
      insightType: response.insightType || null,
      explanation: response.explanation || `Processing query: "${originalQuery}"`,
      suggestedActions: response.suggestedActions || [
        'Generate recommendations for filtered trainees',
        'Export filtered trainee list',
        'View detailed analytics'
      ],
      confidence: response.confidence || 0.8,
      queryType: response.queryType || 'simple',
      processedBy: 'Gemini AI',
      timestamp: new Date().toISOString()
    };

    // Smart validation and corrections
    if (validated.traineeFilters.randomSample && !validated.traineeFilters.randomSampleSize) {
      validated.traineeFilters.randomSampleSize = 10; // Default sample size
    }

    if (validated.traineeFilters.randomSampleSize && !validated.traineeFilters.randomSample) {
      validated.traineeFilters.randomSample = true; // Auto-enable random sampling
    }

    // Ensure reasonable limits
    if (validated.traineeFilters.randomSampleSize > 100) {
      validated.traineeFilters.randomSampleSize = 100;
    }

    if (validated.traineeFilters.minEnrollments > 50) {
      validated.traineeFilters.minEnrollments = 50;
    }

    return validated;
  }

  /**
   * Basic rule-based processing (fallback only)
   */
  processWithBasicRules(query, dataContext) {
    const lowerQuery = query.toLowerCase();
    const result = {
      type: 'filter',
      traineeFilters: {},
      courseFilters: {},
      explanation: '',
      suggestedActions: ['Try a simpler query', 'Check your connection', 'Re-authenticate if needed'],
      confidence: 0.6,
      queryType: 'basic_fallback',
      processedBy: 'Basic Rules (Fallback)',
      timestamp: new Date().toISOString()
    };

    // Basic patterns
    if (lowerQuery.includes('aljazeera')) {
      result.traineeFilters.emailSearch = 'aljazeera';
      result.explanation = 'Filtering trainees from Al Jazeera (basic rules)';
    }

    const randomMatch = lowerQuery.match(/(\d+)\s*random/);
    if (randomMatch || lowerQuery.includes('random')) {
      const count = randomMatch ? parseInt(randomMatch[1]) : 10;
      result.traineeFilters.randomSample = true;
      result.traineeFilters.randomSampleSize = Math.min(count, 100);
      result.explanation += result.explanation ? ` - ${count} random sample` : `Selecting ${count} random trainees (basic rules)`;
    }

    if (lowerQuery.includes('without enrollment')) {
      result.traineeFilters.hasEnrollments = false;
      result.explanation += result.explanation ? ' without enrollments' : 'Filtering trainees without enrollments (basic rules)';
    }

    return result;
  }

  /**
   * Generate dynamic insights using Gemini AI
   */
  async generateDynamicInsights(query, data) {
    try {
      // Ensure valid tokens
      const hasValidToken = await global.tokenManager.ensureValidToken();
      
      if (!hasValidToken) {
        throw new Error('AI insights require authentication');
      }

      const { courses, trainees, enrollments } = data;
      
      // Calculate advanced statistics
      const stats = {
        totalCourses: courses.length,
        totalTrainees: trainees.length,
        totalEnrollments: enrollments.length,
        averageEnrollmentsPerTrainee: (enrollments.length / trainees.length).toFixed(2),
        averageEnrollmentsPerCourse: (enrollments.length / courses.length).toFixed(2),
        engagementRate: ((trainees.filter(t => enrollments.some(e => e.MemberId === t.MemberId)).length / trainees.length) * 100).toFixed(1)
      };

      const prompt = `
You are an advanced AI data analyst for a training center. Analyze the following data and provide intelligent insights based on the user's query.

📊 COMPREHENSIVE DATA ANALYSIS:
- Total Courses: ${stats.totalCourses.toLocaleString()}
- Total Trainees: ${stats.totalTrainees.toLocaleString()}
- Total Enrollments: ${stats.totalEnrollments.toLocaleString()}
- Average Enrollments per Trainee: ${stats.averageEnrollmentsPerTrainee}
- Average Enrollments per Course: ${stats.averageEnrollmentsPerCourse}
- Overall Engagement Rate: ${stats.engagementRate}%

🎯 USER QUERY: "${query}"

Generate intelligent, actionable insights in this JSON format:
{
  "success": true,
  "query": "${query}",
  "insights": [
    {
      "type": "trend_analysis" | "performance_metric" | "recommendation" | "pattern_discovery",
      "title": "Insight Title",
      "description": "Detailed analysis with specific numbers and percentages",
      "recommendation": "Specific actionable recommendation",
      "impact": "high" | "medium" | "low",
      "metrics": {
        "primary_value": number,
        "secondary_value": number,
        "percentage_change": number
      }
    }
  ],
  "statistics": {
    "key_findings": ["finding1", "finding2", "finding3"],
    "notable_patterns": ["pattern1", "pattern2"],
    "recommendations": ["rec1", "rec2", "rec3"]
  },
  "visualization_suggestions": [
    {
      "type": "bar_chart" | "pie_chart" | "line_chart" | "heatmap",
      "title": "Chart Title",
      "description": "What this chart would show"
    }
  ]
}

🧠 BE EXTREMELY INTELLIGENT:
- Provide specific numbers and percentages
- Identify meaningful patterns and trends
- Give actionable business recommendations
- Consider the training center context
- Focus on practical insights that improve outcomes
- Use the actual data statistics provided above

Generate 2-4 high-quality insights that are specific, actionable, and valuable for training center management.`;

      console.log('🚀 Generating AI insights with Gemini...');
      const response = await this.aiService.generateRecommendations('vertex', prompt);
      
      console.log('🤖 Gemini insights response:', response);

      // Parse the response
      let parsedInsights;
      if (typeof response === 'string') {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedInsights = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON in Gemini response');
        }
      } else {
        parsedInsights = response;
      }

      // Enhance with timestamp and processing info
      parsedInsights.processedAt = new Date().toISOString();
      parsedInsights.processedBy = 'Gemini AI';
      parsedInsights.dataContext = stats;

      return parsedInsights;

    } catch (error) {
      console.error('❌ Gemini insights generation failed:', error);
      
      // Return basic insights as fallback
      return {
        success: false,
        error: error.message,
        query,
        fallback_insights: this.generateBasicInsights(data),
        processedBy: 'Fallback System',
        processedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Generate basic insights when AI is not available
   */
  generateBasicInsights(data) {
    const { courses, trainees, enrollments } = data;
    
    return {
      insights: [
        {
          type: 'performance_metric',
          title: '📊 Engagement Overview',
          description: `${trainees.length.toLocaleString()} total trainees with ${enrollments.length.toLocaleString()} enrollments across ${courses.length.toLocaleString()} courses`,
          recommendation: 'Focus on increasing trainee engagement',
          impact: 'high'
        }
      ],
      statistics: {
        key_findings: [
          `${trainees.length.toLocaleString()} trainees in system`,
          `${courses.length.toLocaleString()} courses available`,
          `${enrollments.length.toLocaleString()} total enrollments`
        ]
      }
    };
  }
}

module.exports = AdvancedNLPProcessor;
