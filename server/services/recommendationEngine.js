const AIService = require('./aiService');

class RecommendationEngine {
  constructor() {
    this.aiService = new AIService();
    this.courseSimilarityCache = new Map();
    this.courseContextCache = new Map();
  }

  /**
   * Generate AI-powered personalized recommendations for all trainees (streaming version)
   */
  async generateTraineeRecommendationsStreaming(data, options = {}, progressCallback = null) {
    try {
      const {
        useAI = true,
        aiProvider = 'vertex',
        maxRecommendations = 5,
        minProbability = 0.1,
        includeExplanations = true
      } = options;

      if (!data || !data.courses || !data.trainees || !data.enrollments) {
        throw new Error('Invalid data structure');
      }

      // Limit trainees for performance (can be adjusted)
      const maxTrainees = options.maxTrainees || 100; // Default to 100 for testing
      const limitedTrainees = data.trainees.slice(0, maxTrainees);
      
      const totalTrainees = limitedTrainees.length;
      const totalCourses = data.courses.length;

      console.log('Generating trainee recommendations with streaming progress...');

      // Send progress update
      if (progressCallback) {
        progressCallback({
          type: 'progress',
          stage: 'context_analysis',
          message: `Analyzing ${totalCourses} courses for context and similarity...`,
          progress: 5,
          currentStep: 'Course Analysis',
          totalTrainees,
          totalCourses
        });
      }

      // Step 1: Analyze course contexts
      let courseContexts = {};
      let aiAvailable = false;
      
      if (useAI && global.oauthTokens && global.oauthTokens.access_token) {
        try {
          courseContexts = await this.analyzeCourseContextsStreaming(data.courses, aiProvider, progressCallback);
          aiAvailable = true;
        } catch (error) {
          console.log('AI context analysis failed, using fallback:', error.message);
          courseContexts = this.generateFallbackContexts(data.courses);
          if (progressCallback) {
            progressCallback({
              type: 'progress',
              stage: 'fallback_context',
              message: 'AI unavailable, using intelligent fallback analysis...',
              progress: 15,
              currentStep: 'Fallback Analysis'
            });
          }
        }
      } else {
        console.log('AI not available or not authenticated, using fallback analysis');
        courseContexts = this.generateFallbackContexts(data.courses);
        if (progressCallback) {
          progressCallback({
            type: 'progress',
            stage: 'fallback_context',
            message: 'Using intelligent rule-based course analysis...',
            progress: 15,
            currentStep: 'Rule-based Analysis'
          });
        }
      }

      // Step 2: Calculate similarity matrix
      if (progressCallback) {
        progressCallback({
          type: 'progress',
          stage: 'similarity_matrix',
          message: 'Calculating course similarity relationships...',
          progress: 25,
          currentStep: 'Similarity Analysis'
        });
      }

      let similarityMatrix = {};
      if (aiAvailable) {
        similarityMatrix = await this.calculateCourseSimilarityMatrix(data.courses, courseContexts, aiProvider);
      } else {
        similarityMatrix = this.calculateBasicSimilarityMatrix(data.courses);
      }

      // Step 3: Generate recommendations for each trainee (streaming)
      const traineeRecommendations = [];
      
      if (progressCallback) {
        progressCallback({
          type: 'progress',
          stage: 'trainee_analysis',
          message: 'Starting personalized analysis for each trainee...',
          progress: 35,
          currentStep: 'Trainee Analysis',
          processedTrainees: 0,
          totalTrainees
        });
      }

      for (let i = 0; i < limitedTrainees.length; i++) {
        const trainee = limitedTrainees[i];
        
        // Send progress for each trainee
        if (progressCallback) {
          progressCallback({
            type: 'progress',
            stage: 'trainee_processing',
            message: `Analyzing recommendations for ${trainee.Name ? String(trainee.Name) : `Trainee ${trainee.MemberId}`}...`,
            progress: 35 + (i / totalTrainees) * 60, // 35% to 95%
            currentStep: 'Individual Analysis',
            processedTrainees: i,
            totalTrainees,
            currentTrainee: {
              name: trainee.Name ? String(trainee.Name) : `Trainee ${trainee.MemberId}`,
              email: trainee.Email
            }
          });
        }

        const recommendations = await this.generateTraineeSpecificRecommendations(
          trainee,
          data.courses,
          data.enrollments,
          similarityMatrix,
          courseContexts,
          {
            maxRecommendations,
            minProbability,
            includeExplanations,
            useAI,
            aiProvider
          }
        );

        const traineeResult = {
          traineeId: trainee.MemberId,
          traineeName: trainee.Name ? String(trainee.Name) : `Trainee ${trainee.MemberId}`,
          traineeEmail: trainee.Email,
          traineePhone: trainee.Phone,
          currentCourses: this.getTraineeCurrentCourses(trainee.MemberId, data.enrollments, data.courses),
          recommendations: recommendations
        };

        traineeRecommendations.push(traineeResult);

        // Send individual trainee result as it's completed
        if (progressCallback) {
          progressCallback({
            type: 'trainee_complete',
            message: `Completed analysis for ${trainee.Name ? String(trainee.Name) : `Trainee ${trainee.MemberId}`} - ${recommendations.length} recommendations found`,
            progress: 35 + ((i + 1) / totalTrainees) * 60,
            traineeResult: traineeResult,
            processedTrainees: i + 1,
            totalTrainees
          });
        }

        // Small delay to prevent overwhelming the client
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalResult = {
        success: true,
        totalTrainees: traineeRecommendations.length,
        recommendationsGenerated: traineeRecommendations.reduce((sum, t) => sum + t.recommendations.length, 0),
        data: traineeRecommendations,
        metadata: {
          useAI,
          aiProvider,
          aiAvailable,
          courseSimilarityMatrixSize: Object.keys(similarityMatrix).length,
          courseContextsAnalyzed: Object.keys(courseContexts).length
        }
      };

      return finalResult;

    } catch (error) {
      console.error('Error generating streaming trainee recommendations:', error);
      throw error;
    }
  }

  /**
   * Generate AI-powered personalized recommendations for all trainees (non-streaming)
   */
  async generateTraineeRecommendations(data, options = {}) {
    try {
      const {
        useAI = true,
        aiProvider = 'vertex',
        maxRecommendations = 5,
        minProbability = 0.1,
        includeExplanations = true
      } = options;

      if (!data || !data.courses || !data.trainees || !data.enrollments) {
        throw new Error('Invalid data structure');
      }

      console.log('Generating trainee recommendations with AI similarity analysis...');

      // Step 1: Analyze course contexts using AI (if enabled and authenticated)
      let courseContexts = {};
      let aiAvailable = false;
      
      if (useAI && global.oauthTokens && global.oauthTokens.access_token) {
        try {
          courseContexts = await this.analyzeCourseContexts(data.courses, aiProvider);
          aiAvailable = true;
        } catch (error) {
          console.log('AI context analysis failed, using fallback:', error.message);
          courseContexts = this.generateFallbackContexts(data.courses);
        }
      } else {
        console.log('AI not available or not authenticated, using fallback analysis');
        courseContexts = this.generateFallbackContexts(data.courses);
      }

      // Step 2: Calculate course similarity matrix
      let similarityMatrix = {};
      if (aiAvailable) {
        similarityMatrix = await this.calculateCourseSimilarityMatrix(data.courses, courseContexts, aiProvider);
      } else {
        similarityMatrix = this.calculateBasicSimilarityMatrix(data.courses);
      }

      // Step 3: Generate recommendations for each trainee
      const traineeRecommendations = [];

      for (const trainee of data.trainees) {
        const recommendations = await this.generateTraineeSpecificRecommendations(
          trainee,
          data.courses,
          data.enrollments,
          similarityMatrix,
          courseContexts,
          {
            maxRecommendations,
            minProbability,
            includeExplanations,
            useAI,
            aiProvider
          }
        );

        traineeRecommendations.push({
          traineeId: trainee.MemberId,
          traineeName: trainee.Name ? String(trainee.Name) : `Trainee ${trainee.MemberId}`,
          traineeEmail: trainee.Email,
          traineePhone: trainee.Phone,
          currentCourses: this.getTraineeCurrentCourses(trainee.MemberId, data.enrollments, data.courses),
          recommendations: recommendations
        });
      }

      return {
        success: true,
        totalTrainees: traineeRecommendations.length,
        recommendationsGenerated: traineeRecommendations.reduce((sum, t) => sum + t.recommendations.length, 0),
        data: traineeRecommendations,
        metadata: {
          useAI,
          aiProvider,
          courseSimilarityMatrixSize: Object.keys(similarityMatrix).length,
          courseContextsAnalyzed: Object.keys(courseContexts).length
        }
      };

    } catch (error) {
      console.error('Error generating trainee recommendations:', error);
      throw error;
    }
  }

  /**
   * Analyze course contexts using AI with streaming progress updates
   */
  async analyzeCourseContextsStreaming(courses, aiProvider, progressCallback = null) {
    const contexts = {};
    const batchSize = 3;

    try {
      console.log(`Analyzing contexts for ${courses.length} courses using AI...`);

      for (let i = 0; i < courses.length; i += batchSize) {
        const batch = courses.slice(i, i + batchSize);
        
        // Send progress update for this batch
        if (progressCallback) {
          progressCallback({
            type: 'progress',
            stage: 'course_context_batch',
            message: `Analyzing course batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(courses.length/batchSize)}...`,
            progress: 5 + (i / courses.length) * 15, // 5% to 20%
            currentStep: 'AI Course Analysis',
            coursesProcessed: i,
            totalCourses: courses.length,
            currentBatch: batch.map(c => c.CustomName)
          });
        }
        
        for (const course of batch) {
          // Check cache first
          const cacheKey = `${course.CourseBasicDataId}_${course.CustomName}`;
          if (this.courseContextCache.has(cacheKey)) {
            contexts[course.CourseBasicDataId] = this.courseContextCache.get(cacheKey);
            continue;
          }

          try {
            const prompt = `Analyze this course and categorize it. Course: "${course.CustomName}". 
            
            Respond with a JSON object containing:
            - subject_area: main subject (e.g., "Technology", "Media", "Business")  
            - skills_taught: key skills learned
            - target_audience: who should take this
            - keywords: 3 relevant keywords
            
            Example: {"subject_area":"Technology","skills_taught":"Programming basics","target_audience":"Beginners","keywords":["programming","code","software"]}`;

            const aiResponse = await this.aiService.generateRecommendations(
              aiProvider,
              prompt,
              null,
              null,
              'gemini-1.5-pro'
            );

            let context;
            try {
              // Try to extract JSON from response
              const jsonMatch = aiResponse.match(/\{.*\}/s);
              if (jsonMatch) {
                context = JSON.parse(jsonMatch[0]);
              } else {
                throw new Error('No JSON found in response');
              }
            } catch (parseError) {
              // Fallback to simple context
              context = {
                subject_area: "General Training",
                skills_taught: course.CustomName,
                target_audience: "General learners",
                keywords: [course.CustomName.split(' ')[0] || 'training']
              };
            }

            contexts[course.CourseBasicDataId] = context;
            this.courseContextCache.set(cacheKey, context);

          } catch (aiError) {
            console.warn(`Failed to analyze context for course ${course.CourseBasicDataId}:`, aiError.message);
            // Fallback context
            contexts[course.CourseBasicDataId] = {
              subject_area: "General Training",
              skills_taught: course.CustomName,
              target_audience: "General learners",
              keywords: [course.CustomName]
            };
          }
        }

        // Small delay between batches
        if (i + batchSize < courses.length) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      return contexts;

    } catch (error) {
      console.error('Error analyzing course contexts:', error);
      return {};
    }
  }

  /**
   * Analyze course contexts using AI to understand what each course is about (non-streaming)
   */
  async analyzeCourseContexts(courses, aiProvider) {
    const contexts = {};
    const batchSize = 3; // Process courses in smaller batches

    try {
      console.log(`Analyzing contexts for ${courses.length} courses using AI...`);

      for (let i = 0; i < courses.length; i += batchSize) {
        const batch = courses.slice(i, i + batchSize);
        
        for (const course of batch) {
          // Check cache first
          const cacheKey = `${course.CourseBasicDataId}_${course.CustomName}`;
          if (this.courseContextCache.has(cacheKey)) {
            contexts[course.CourseBasicDataId] = this.courseContextCache.get(cacheKey);
            continue;
          }

          try {
            const prompt = `Analyze this course and categorize it. Course: "${course.CustomName}". 
            
            Respond with a JSON object containing:
            - subject_area: main subject (e.g., "Technology", "Media", "Business")  
            - skills_taught: key skills learned
            - target_audience: who should take this
            - keywords: 3 relevant keywords
            
            Example: {"subject_area":"Technology","skills_taught":"Programming basics","target_audience":"Beginners","keywords":["programming","code","software"]}`;

            const aiResponse = await this.aiService.generateRecommendations(
              aiProvider,
              prompt,
              null,
              null,
              'gemini-1.5-pro'
            );

            let context;
            try {
              // Try to extract JSON from response
              const jsonMatch = aiResponse.match(/\{.*\}/s);
              if (jsonMatch) {
                context = JSON.parse(jsonMatch[0]);
              } else {
                throw new Error('No JSON found in response');
              }
            } catch (parseError) {
              // Fallback to simple context
              context = {
                subject_area: "General Training",
                skills_taught: course.CustomName,
                target_audience: "General learners",
                keywords: [course.CustomName.split(' ')[0] || 'training']
              };
            }

            contexts[course.CourseBasicDataId] = context;
            this.courseContextCache.set(cacheKey, context);

          } catch (aiError) {
            console.warn(`Failed to analyze context for course ${course.CourseBasicDataId}:`, aiError.message);
            // Fallback context
            contexts[course.CourseBasicDataId] = {
              subject_area: "General Training",
              skills_taught: course.CustomName,
              target_audience: "General learners",
              keywords: [course.CustomName]
            };
          }
        }

        // Small delay between batches
        if (i + batchSize < courses.length) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      return contexts;

    } catch (error) {
      console.error('Error analyzing course contexts:', error);
      return {};
    }
  }

  /**
   * Calculate similarity matrix between courses using AI
   */
  async calculateCourseSimilarityMatrix(courses, courseContexts, aiProvider) {
    const matrix = {};
    
    try {
      console.log('Calculating course similarity matrix...');

      // For performance, limit to top courses by enrollment if dataset is large
      const coursesToAnalyze = courses.slice(0, 50); // Limit for performance

      for (const courseA of coursesToAnalyze) {
        matrix[courseA.CourseBasicDataId] = {};

        for (const courseB of coursesToAnalyze) {
          if (courseA.CourseBasicDataId === courseB.CourseBasicDataId) {
            matrix[courseA.CourseBasicDataId][courseB.CourseBasicDataId] = 1.0;
            continue;
          }

          // Use simple similarity for performance, with AI enhancement for key pairs
          const similarity = this.calculateSimpleNameSimilarity(courseA.CustomName, courseB.CustomName);
          matrix[courseA.CourseBasicDataId][courseB.CourseBasicDataId] = similarity;
        }
      }

      return matrix;

    } catch (error) {
      console.error('Error calculating similarity matrix:', error);
      return {};
    }
  }

  /**
   * Generate recommendations for a specific trainee
   */
  async generateTraineeSpecificRecommendations(trainee, courses, enrollments, similarityMatrix, courseContexts, options) {
    const {
      maxRecommendations,
      minProbability,
      includeExplanations
    } = options;

    // Get trainee's enrollment history
    const traineeEnrollments = enrollments.filter(e => e.MemberId === trainee.MemberId);
    const enrolledCourseIds = traineeEnrollments.map(e => e.CourseId);

    // Find courses not yet taken
    const availableCourses = courses.filter(course => 
      !enrolledCourseIds.includes(course.CourseBasicDataId)
    );

    const recommendations = [];

    for (const course of availableCourses) {
      // Calculate recommendation probability
      const probability = this.calculateRecommendationProbability(
        trainee,
        course,
        enrolledCourseIds,
        courses,
        enrollments,
        similarityMatrix,
        courseContexts
      );

      if (probability >= minProbability) {
        const recommendation = {
          courseId: course.CourseBasicDataId,
          courseName: course.CustomName,
          courseStatus: course.Status,
          probability: Math.round(probability * 100) / 100,
          explanation: includeExplanations ? this.generateExplanation(
            trainee,
            course,
            enrolledCourseIds,
            courses,
            similarityMatrix,
            courseContexts,
            probability
          ) : null,
          similarCourses: this.findMostSimilarEnrolledCourses(
            course.CourseBasicDataId,
            enrolledCourseIds,
            similarityMatrix,
            courses
          ).slice(0, 3)
        };

        recommendations.push(recommendation);
      }
    }

    // Sort by probability (highest first)
    recommendations.sort((a, b) => b.probability - a.probability);

    return recommendations.slice(0, maxRecommendations);
  }

  /**
   * Calculate recommendation probability for a trainee-course pair
   */
  calculateRecommendationProbability(trainee, course, enrolledCourseIds, courses, enrollments, similarityMatrix, courseContexts) {
    let probability = 0.0;

    // Factor 1: Similarity to enrolled courses (50% weight)
    const similarityScore = this.calculateSimilarityScore(course.CourseBasicDataId, enrolledCourseIds, similarityMatrix);
    probability += similarityScore * 0.5;

    // Factor 2: Course popularity (30% weight)
    const popularityScore = this.calculatePopularityScore(course.CourseBasicDataId, enrollments);
    probability += popularityScore * 0.3;

    // Factor 3: Learning progression (20% weight)
    const progressionScore = this.calculateProgressionScore(trainee, course, enrolledCourseIds, courses, courseContexts);
    probability += progressionScore * 0.2;

    return Math.min(1.0, Math.max(0.0, probability));
  }

  calculateSimilarityScore(targetCourseId, enrolledCourseIds, similarityMatrix) {
    if (enrolledCourseIds.length === 0) return 0.5; // Default for new trainees

    const similarities = enrolledCourseIds.map(enrolledId => {
      return similarityMatrix[enrolledId]?.[targetCourseId] || 0;
    });

    return similarities.length > 0 ? similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length : 0;
  }

  calculatePopularityScore(courseId, enrollments) {
    const courseEnrollments = enrollments.filter(e => e.CourseId === courseId);
    const enrollmentCounts = {};
    enrollments.forEach(e => {
      enrollmentCounts[e.CourseId] = (enrollmentCounts[e.CourseId] || 0) + 1;
    });
    
    const maxEnrollments = Math.max(...Object.values(enrollmentCounts));
    return maxEnrollments > 0 ? courseEnrollments.length / maxEnrollments : 0;
  }

  calculateProgressionScore(trainee, course, enrolledCourseIds, courses, courseContexts) {
    // Simple progression logic
    const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.CourseBasicDataId));
    
    // If trainee has taken many courses, slightly prefer new subject areas
    if (enrolledCourses.length > 3) {
      return 0.7;
    }
    
    // For new trainees, prefer popular foundational courses
    return 0.6;
  }

  generateExplanation(trainee, course, enrolledCourseIds, courses, similarityMatrix, courseContexts, probability) {
    const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.CourseBasicDataId));
    const targetContext = courseContexts[course.CourseBasicDataId] || {};

    let explanation = `${Math.round(probability * 100)}% match based on: `;
    
    if (enrolledCourses.length > 0) {
      explanation += `${enrolledCourses.length} enrolled courses, `;
    }
    
    if (targetContext.subject_area) {
      explanation += `${targetContext.subject_area} subject area, `;
    }
    
    explanation += `course popularity and learning progression analysis.`;
    
    return explanation;
  }

  findMostSimilarEnrolledCourses(targetCourseId, enrolledCourseIds, similarityMatrix, courses) {
    const similarities = enrolledCourseIds.map(enrolledId => {
      const similarity = similarityMatrix[enrolledId]?.[targetCourseId] || 0;
      const course = courses.find(c => c.CourseBasicDataId === enrolledId);
      
      return {
        courseId: enrolledId,
        courseName: course ? course.CustomName : 'Unknown',
        similarity: similarity
      };
    });

    return similarities
      .filter(s => s.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity);
  }

  calculateSimpleNameSimilarity(nameA, nameB) {
    const wordsA = nameA.toLowerCase().split(/\s+/);
    const wordsB = nameB.toLowerCase().split(/\s+/);
    
    const intersection = wordsA.filter(word => wordsB.includes(word));
    const union = [...new Set([...wordsA, ...wordsB])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  filterAndSortRecommendations(traineeRecommendations, filters = {}) {
    const {
      minProbability = 0.0,
      maxProbability = 1.0,
      courseStatus = null,
      sortBy = 'probability',
      sortOrder = 'desc',
      limit = null
    } = filters;

    return traineeRecommendations.map(trainee => ({
                ...trainee,
      recommendations: trainee.recommendations
        .filter(rec => {
          if (rec.probability < minProbability || rec.probability > maxProbability) return false;
          if (courseStatus !== null && rec.courseStatus !== courseStatus) return false;
          return true;
        })
        .sort((a, b) => {
          const aVal = a[sortBy] || 0;
          const bVal = b[sortBy] || 0;
          return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
        })
        .slice(0, limit || undefined)
    }));
  }

  /**
   * Generate fallback contexts when AI is not available
   */
  generateFallbackContexts(courses) {
    const contexts = {};
    
    courses.forEach(course => {
      // Simple keyword-based categorization
      const name = course.CustomName.toLowerCase();
      let subject_area = "General Training";
      let keywords = [course.CustomName.split(' ')[0] || 'training'];
      
      if (name.includes('تصوير') || name.includes('cinema') || name.includes('video')) {
        subject_area = "Media & Video Production";
        keywords = ['video', 'production', 'media'];
      } else if (name.includes('تحليل') || name.includes('analysis') || name.includes('data')) {
        subject_area = "Data Analysis";
        keywords = ['analysis', 'data', 'research'];
      } else if (name.includes('إدارة') || name.includes('management') || name.includes('business')) {
        subject_area = "Business Management";
        keywords = ['management', 'business', 'leadership'];
      } else if (name.includes('تقديم') || name.includes('presentation') || name.includes('communication')) {
        subject_area = "Communication";
        keywords = ['communication', 'presentation', 'speaking'];
      }
      
      contexts[course.CourseBasicDataId] = {
        subject_area,
        skills_taught: course.CustomName,
        target_audience: "General learners",
        keywords
      };
    });
    
    return contexts;
  }

  /**
   * Calculate basic similarity matrix without AI
   */
  calculateBasicSimilarityMatrix(courses) {
    const matrix = {};
    
    courses.forEach(courseA => {
      matrix[courseA.CourseBasicDataId] = {};
      
      courses.forEach(courseB => {
        if (courseA.CourseBasicDataId === courseB.CourseBasicDataId) {
          matrix[courseA.CourseBasicDataId][courseB.CourseBasicDataId] = 1.0;
        } else {
          const similarity = this.calculateSimpleNameSimilarity(courseA.CustomName, courseB.CustomName);
          matrix[courseA.CourseBasicDataId][courseB.CourseBasicDataId] = similarity;
        }
      });
    });
    
    return matrix;
  }

  getTraineeCurrentCourses(traineeId, enrollments, courses) {
    const traineeEnrollments = enrollments.filter(e => e.MemberId === traineeId);
    
    return traineeEnrollments.map(enrollment => {
      const course = courses.find(c => c.CourseBasicDataId === enrollment.CourseId);
      return {
        courseId: enrollment.CourseId,
        courseName: course ? course.CustomName : 'Unknown Course',
        courseStatus: course ? course.Status : 1,
        enrollmentDate: enrollment.EnrollmentDate
      };
    });
  }
}

module.exports = RecommendationEngine;