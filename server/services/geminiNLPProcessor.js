const axios = require('axios');

class GeminiNLPProcessor {
  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'ajgc-mep-app-dev-ccd-01';
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  }

  /**
   * Process natural language query using Gemini AI directly
   */
  async processNaturalLanguageQuery(query, dataContext = {}) {
    try {
      console.log('🤖 Processing NL query with Gemini AI:', query);

      // Check if we have valid tokens
      if (!global.oauthTokens || !global.oauthTokens.access_token) {
        console.log('❌ No OAuth tokens, using fallback');
        return this.processWithFallback(query, dataContext);
      }

      // Use Gemini directly
      const result = await this.callGeminiAPI(query, dataContext);
      
      if (result) {
        console.log('✅ Gemini AI processing successful');
        return result;
      } else {
        throw new Error('Gemini returned empty result');
      }

    } catch (error) {
      console.error('❌ Gemini NLP processing error:', error.message);
      console.log('🔄 Falling back to rule-based processing...');
      return this.processWithFallback(query, dataContext);
    }
  }

  /**
   * Call Gemini API directly with optimized prompt
   */
  async callGeminiAPI(query, dataContext) {
    try {
      // Try different available models - use gemini-pro as it's more widely available
      const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/gemini-pro:generateContent`;
      
      const prompt = `You are an intelligent AI assistant for a training center management system. Your job is to understand natural language queries about trainees and courses, then convert them into precise JSON filter objects.

CONTEXT:
- Total trainees in system: ${dataContext.totalTrainees || 0}
- Total courses available: ${dataContext.totalCourses || 0}
- System supports filtering by: email domains, enrollment status, random sampling, minimum enrollment counts

USER QUERY: "${query}"

INSTRUCTIONS:
1. Analyze the user's intent carefully
2. Extract key filtering criteria
3. Return ONLY valid JSON in the exact format specified below
4. Be smart about interpreting variations and synonyms
5. Handle misspellings and informal language

REQUIRED JSON FORMAT:
{
  "type": "filter",
  "traineeFilters": {
    "emailSearch": null,
    "randomSample": false,
    "randomSampleSize": null,
    "hasEnrollments": null,
    "minEnrollments": null,
    "maxResults": null
  },
  "explanation": "Clear explanation of what you understood",
  "confidence": 0.95
}

FIELD EXPLANATIONS:
- emailSearch: Domain name to filter by (e.g., "aljazeera", "gmail", "company")
- randomSample: true if user wants random selection
- randomSampleSize: number of random trainees requested
- hasEnrollments: true for active/enrolled trainees, false for inactive, null for all
- minEnrollments: minimum number of enrollments required
- maxResults: maximum number of results to return

ADVANCED EXAMPLES:
- "10 random trainees" → {"type": "filter", "traineeFilters": {"randomSample": true, "randomSampleSize": 10}, "explanation": "10 randomly selected trainees"}
- "trainees from aljazeera with more than one enrollment" → {"type": "filter", "traineeFilters": {"emailSearch": "aljazeera", "minEnrollments": 2}, "explanation": "Al Jazeera trainees with multiple enrollments"}
- "20 active gmail users" → {"type": "filter", "traineeFilters": {"emailSearch": "gmail", "hasEnrollments": true, "maxResults": 20}, "explanation": "20 active Gmail trainees"}
- "show me 5 trainees from bbc" → {"type": "filter", "traineeFilters": {"emailSearch": "bbc", "maxResults": 5}, "explanation": "5 trainees from BBC"}
- "inactive trainees" → {"type": "filter", "traineeFilters": {"hasEnrollments": false}, "explanation": "trainees without any enrollments"}
- "all trainees with at least 3 courses" → {"type": "filter", "traineeFilters": {"minEnrollments": 3}, "explanation": "trainees enrolled in 3+ courses"}

SMART INTERPRETATION RULES:
- "from [domain]" = emailSearch
- Numbers + "random" = randomSample + randomSampleSize
- "active/enrolled/participating" = hasEnrollments: true
- "inactive/not enrolled/no courses" = hasEnrollments: false
- "more than X" = minEnrollments: X+1
- "at least X" = minEnrollments: X
- "show me X" = maxResults: X

Return ONLY the JSON object, no additional text:`;

      const payload = {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.1,
          topP: 0.8
        }
      };

      console.log('🚀 Calling Gemini API...');
      
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${global.oauthTokens.access_token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (response.data.candidates && response.data.candidates[0]) {
        const content = response.data.candidates[0].content.parts[0].text;
        console.log('📝 Gemini response:', content);
        
        // Parse JSON response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          parsed.processedBy = 'Gemini AI';
          parsed.timestamp = new Date().toISOString();
          return parsed;
        } else {
          throw new Error('No valid JSON in Gemini response');
        }
      } else {
        throw new Error('No response from Gemini');
      }

    } catch (error) {
      console.error('❌ Gemini API call failed:', error.message);
      if (error.response) {
        console.error('❌ Response status:', error.response.status);
        console.error('❌ Response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Advanced fallback processing when Gemini is not available
   */
  processWithFallback(query, dataContext) {
    const lowerQuery = query.toLowerCase().trim();
    const result = {
      type: 'filter',
      traineeFilters: {
        emailSearch: null,
        randomSample: false,
        randomSampleSize: null,
        hasEnrollments: null,
        minEnrollments: null,
        maxResults: null
      },
      explanation: '',
      confidence: 0.8,
      processedBy: 'Advanced Fallback Rules',
      timestamp: new Date().toISOString()
    };
    
    // Intent detection: check for "how many" or counting queries
    if (lowerQuery.startsWith('how many') || lowerQuery.startsWith('count')) {
      result.type = 'insight';
      result.insightType = 'count';
      result.explanation = `Counting trainees based on criteria: ${lowerQuery}`;
    }

    // Enrollment status detection (process FIRST to avoid conflicts)
    const inactiveKeywords = ['inactive', 'not enrolled', 'without enrollment', 'no course', 'unregistered', 'without any', 'without courses'];
    const activeKeywords = ['active', 'enrolled', 'participating', 'with enrollment', 'with course', 'registered'];
    
    let statusDetected = false;
    // Check for inactive FIRST (more specific than active)
    if (inactiveKeywords.some(keyword => lowerQuery.includes(keyword))) {
      result.traineeFilters.hasEnrollments = false;
      statusDetected = true;
    } else if (activeKeywords.some(keyword => lowerQuery.includes(keyword))) {
      result.traineeFilters.hasEnrollments = true;
      statusDetected = true;
    }

    // Smart domain extraction patterns
    const domainPatterns = [
      /(?:from\s+)([a-zA-Z]+(?:\.[a-zA-Z]+)*)/g,
      /([a-zA-Z]+)\s+(?:trainees?|users?|people)/g,
      /(?:company|organization|domain)[\s:]*([a-zA-Z]+)/g,
      /@([a-zA-Z]+(?:\.[a-zA-Z]+)*)/g
    ];

    let detectedDomain = null;
    for (const pattern of domainPatterns) {
      const matches = [...lowerQuery.matchAll(pattern)];
      if (matches.length > 0) {
        detectedDomain = matches[0][1];
        // Skip generic words that aren't domains, including status words
        const skipWords = ['random', 'active', 'inactive', 'all', 'me', 'show', 'get', 'find', 'list', 'without', 'any', 'how', 'many'];
        if (detectedDomain && detectedDomain.length > 2 && !skipWords.includes(detectedDomain)) {
          result.traineeFilters.emailSearch = detectedDomain;
          break;
        }
      }
    }

    // Enhanced number extraction for various contexts
    const numberPatterns = [
      /(\d+)\s*random/i,
      /random\s*(\d+)/i,
      /(\d+)\s*trainees?/i,
      /show\s*(?:me\s*)?(\d+)/i,
      /get\s*(\d+)/i,
      /(\d+)\s*(?:of|from)/i,
      /(?:top|first|last)\s*(\d+)/i,
      /(\d+)\s*active/i,
      /(\d+)\s*inactive/i,
      /(\d+)\s*(?:gmail|aljazeera|bbc|hotmail|outlook)/i
    ];

    let detectedNumber = null;
    
    // Add number word to digit conversion
    const numberWords = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };
    
    // Replace number words with digits in the query string itself for uniform processing
    let processedQuery = lowerQuery;
    for (const word in numberWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      processedQuery = processedQuery.replace(regex, numberWords[word]);
    }

    for (const pattern of numberPatterns) {
      const match = processedQuery.match(pattern);
      if (match) {
        detectedNumber = parseInt(match[1]);
        if (detectedNumber > 0 && detectedNumber <= 1000) {
          break;
        }
      }
    }

    // Random sampling detection
    if (lowerQuery.includes('random') || lowerQuery.includes('sample')) {
      result.traineeFilters.randomSample = true;
      result.traineeFilters.randomSampleSize = detectedNumber || 10;
      result.explanation = `${result.traineeFilters.randomSampleSize} random trainees`;
    }

    // Max results detection
    if (detectedNumber && !result.traineeFilters.randomSample) {
      if (lowerQuery.includes('show') || lowerQuery.includes('get') || lowerQuery.includes('find') || lowerQuery.includes('list') || lowerQuery.includes('give')) {
        result.traineeFilters.maxResults = detectedNumber;
        result.explanation = result.explanation ? `${result.explanation} (max ${detectedNumber})` : `Up to ${detectedNumber} trainees`;
      } else if (result.traineeFilters.emailSearch && detectedNumber) {
        // If we have both domain and number, use maxResults
        result.traineeFilters.maxResults = detectedNumber;
        result.explanation = result.explanation ? `${result.explanation} (max ${detectedNumber})` : `Up to ${detectedNumber} trainees`;
      }
    }



    // Minimum enrollment detection
    const minEnrollmentPatterns = [
      /(?:more than|>\s*)(\d+)(?:\s*(?:enrollment|course|class))/i,
      /(?:at least|>=?\s*)(\d+)(?:\s*(?:enrollment|course|class))/i,
      /(?:minimum|min)\s*(?:of\s*)?(\d+)/i,
      /(\d+)\s*(?:or more|plus|\+)(?:\s*(?:enrollment|course|class))/i,
      /with\s+at\s+least\s+(\d+)\s+(?:course|class|enrollment)/i,
      /(?:minimum|min)\s+(\d+)\s+(?:course|class|enrollment)/i,
      /with\s+more\s+than\s+(\d+)\s+(?:course|class|enrollment)/i,
      /(?:have|has)\s+more\s+than\s+(\d+)\s+(?:course|class|enrollment)/i,
      /more\s+than\s+(\d+)\s+(?:course|class|enrollment)/i
    ];

    for (const pattern of minEnrollmentPatterns) {
      const match = processedQuery.match(pattern);
      if (match) {
        let minCount = parseInt(match[1]);
        if (processedQuery.includes('more than') || processedQuery.includes('>')) {
          minCount += 1;
        }
        result.traineeFilters.minEnrollments = minCount;
        result.explanation = result.explanation ? 
          `${result.explanation} (min ${minCount} enrollments)` : 
          `Trainees with at least ${minCount} enrollments`;
        break;
      }
    }

    // Domain-specific handling
    if (detectedDomain) {
      const domainExplanation = `from ${detectedDomain.charAt(0).toUpperCase() + detectedDomain.slice(1)}`;
      result.explanation = result.explanation ? 
        `${result.explanation} ${domainExplanation}` : 
        `Trainees ${domainExplanation}`;
    }
    
    // Status-specific handling (override domain-based explanations)
    if (statusDetected) {
      if (result.traineeFilters.hasEnrollments === true) {
        if (detectedDomain) {
          result.explanation = `Active trainees from ${detectedDomain.charAt(0).toUpperCase() + detectedDomain.slice(1)}`;
        } else {
          result.explanation = 'Active trainees only';
        }
      } else if (result.traineeFilters.hasEnrollments === false) {
        result.explanation = 'Inactive trainees only';
      }
    }
    
    // Special case: if query contains "all trainees" and we mistakenly set emailSearch to "all", clear it
    if (result.traineeFilters.emailSearch === 'all' && lowerQuery.includes('all trainees')) {
      result.traineeFilters.emailSearch = null;
      result.explanation = result.explanation.replace('from All', '').trim() || 'All trainees';
    }

    // Smart confidence adjustment
    let confidenceFactors = 0;
    if (result.traineeFilters.emailSearch) confidenceFactors++;
    if (result.traineeFilters.randomSample || result.traineeFilters.maxResults) confidenceFactors++;
    if (result.traineeFilters.hasEnrollments !== null) confidenceFactors++;
    if (result.traineeFilters.minEnrollments) confidenceFactors++;

    result.confidence = Math.min(0.9, 0.6 + (confidenceFactors * 0.1));

    // Default explanation if none generated
    if (!result.explanation) {
      result.explanation = 'General trainee query';
      result.confidence = 0.5;
    }

    console.log(`🔄 Fallback processing result:`, JSON.stringify(result, null, 2));
    return result;
  }
}

module.exports = GeminiNLPProcessor;
