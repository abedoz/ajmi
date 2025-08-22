const AIService = require('./aiService');

class ChunkedRecommendationEngine {
  constructor() {
    this.aiService = new AIService();
    this.courseSimilarityCache = new Map();
    this.courseContextCache = new Map();
  }

  /**
   * Generate AI-powered personalized recommendations with chunked processing
   */
  async generateTraineeRecommendationsChunked(data, options = {}, progressCallback = null) {
    try {
      const {
        useAI = true,
        aiProvider = 'vertex',
        maxRecommendations = 5,
        minProbability = 0.1,
        includeExplanations = true,
        maxTrainees = 50,
        chunkSize = 20
      } = options;

      if (!data || !data.courses || !data.trainees || !data.enrollments) {
        throw new Error('Invalid data structure');
      }

      // Clean data first - remove invalid enrollments
      const cleanedData = this.cleanDataIntegrity(data);
      console.log(`Data cleaned: ${data.enrollments.length} → ${cleanedData.enrollments.length} valid enrollments`);
      
      // Apply trainee filters to cleaned data
      let filteredTrainees = this.applyTraineeFilters(cleanedData.trainees, {
        ...options.traineeFilters,
        enrollments: cleanedData.enrollments // Use cleaned enrollments for filtering
      });
      
      // Then limit for performance
      const limitedTrainees = filteredTrainees.slice(0, maxTrainees);
      const totalTrainees = limitedTrainees.length;
      const totalCourses = data.courses.length;

      console.log(`Generating recommendations for ${totalTrainees} trainees using chunked processing...`);

      // Send initial progress
      if (progressCallback) {
        progressCallback({
          type: 'progress',
          stage: 'initializing',
          message: 'Initializing chunked AI recommendation engine...',
          progress: 0,
          totalTrainees,
          totalCourses,
          chunkSize
        });
      }

      // Step 1: Quick course analysis (simplified for performance)
      if (progressCallback) {
        progressCallback({
          type: 'progress',
          stage: 'course_analysis',
          message: `Analyzing ${totalCourses} courses for similarity patterns...`,
          progress: 5,
          currentStep: 'Course Analysis',
          totalTrainees,
          totalCourses
        });
      }

      // Use basic similarity for performance with cleaned data
      const similarityMatrix = this.calculateBasicSimilarityMatrix(cleanedData.courses);
      const courseContexts = this.generateFallbackContexts(cleanedData.courses);

      // Step 2: Process trainees in chunks
      const chunks = [];
      for (let i = 0; i < limitedTrainees.length; i += chunkSize) {
        chunks.push(limitedTrainees.slice(i, i + chunkSize));
      }

      console.log(`Processing ${totalTrainees} trainees in ${chunks.length} chunks of ${chunkSize}`);

      if (progressCallback) {
        progressCallback({
          type: 'progress',
          stage: 'chunking_setup',
          message: `Setting up ${chunks.length} processing batches...`,
          progress: 15,
          currentStep: 'Batch Setup',
          totalTrainees,
          totalChunks: chunks.length,
          chunkSize
        });
      }

      const traineeRecommendations = [];
      let processedCount = 0;
      
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        
        // Send chunk start notification with emoji for better UX
        if (progressCallback) {
          progressCallback({
            type: 'progress',
            stage: 'chunk_start',
            message: `📦 Starting batch ${chunkIndex + 1}/${chunks.length} (${chunk.length} trainees)`,
            progress: Math.round(20 + (processedCount / totalTrainees) * 70),
            currentStep: `Batch ${chunkIndex + 1}/${chunks.length}`,
            processedTrainees: processedCount,
            totalTrainees,
            currentChunk: chunkIndex + 1,
            totalChunks: chunks.length
          });
        }

        // Process each trainee in the chunk
        for (let indexInChunk = 0; indexInChunk < chunk.length; indexInChunk++) {
          const trainee = chunk[indexInChunk];
          const globalIndex = processedCount + indexInChunk;
          
          // Send individual trainee start notification with safe name handling
          const traineeName = trainee.Name ? String(trainee.Name) : `Trainee ${trainee.MemberId}`;
          const traineeEmail = trainee.Email ? String(trainee.Email) : '';
          
          if (progressCallback) {
            progressCallback({
              type: 'progress',
              stage: 'trainee_start',
              message: `🔍 Analyzing ${traineeName}...`,
              progress: Math.round(20 + (globalIndex / totalTrainees) * 70),
              currentStep: 'Individual Analysis',
              processedTrainees: globalIndex,
              totalTrainees,
              currentTrainee: {
                name: traineeName,
                email: traineeEmail,
                index: globalIndex + 1
              }
            });
          }

          // Generate recommendations for this trainee
          const recommendations = await this.generateTraineeRecommendations(
            trainee,
            cleanedData.courses,
            cleanedData.enrollments,
            similarityMatrix,
            courseContexts,
            { maxRecommendations, minProbability, includeExplanations }
          );

          const traineeResult = {
            traineeId: trainee.MemberId,
            traineeName: traineeName,
            traineeEmail: traineeEmail,
            traineePhone: trainee.Phone ? String(trainee.Phone) : '',
            currentCourses: this.getTraineeCurrentCourses(trainee.MemberId, cleanedData.enrollments, cleanedData.courses),
            recommendations: recommendations,
            processedAt: new Date().toISOString()
          };

          traineeRecommendations.push(traineeResult);
          
          // Send individual trainee completion with instant feedback
          if (progressCallback) {
            progressCallback({
              type: 'trainee_complete',
              message: `✅ ${traineeName}: ${recommendations.length} recommendations found`,
              progress: Math.round(20 + ((globalIndex + 1) / totalTrainees) * 70),
              traineeResult: traineeResult,
              processedTrainees: globalIndex + 1,
              totalTrainees,
              chunkProgress: indexInChunk + 1,
              chunkSize: chunk.length
            });
          }

          // Minimal delay for UI responsiveness
          await new Promise(resolve => setTimeout(resolve, 1));
        }

        processedCount += chunk.length;
        
        // Send chunk completion notification
        if (progressCallback) {
          progressCallback({
            type: 'progress',
            stage: 'chunk_complete',
            message: `✅ Batch ${chunkIndex + 1}/${chunks.length} completed! (${chunk.length} trainees processed)`,
            progress: Math.round(20 + (processedCount / totalTrainees) * 70),
            currentStep: 'Batch Complete',
            processedTrainees: processedCount,
            totalTrainees,
            completedChunks: chunkIndex + 1,
            totalChunks: chunks.length
          });
        }

        // Minimal delay between chunks
        if (chunkIndex < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Final completion
      if (progressCallback) {
        progressCallback({
          type: 'complete',
          message: `🎉 Analysis completed! Generated recommendations for ${traineeRecommendations.length} trainees`,
          progress: 100,
          result: {
            success: true,
            totalTrainees: traineeRecommendations.length,
            totalCourses,
            recommendationsGenerated: traineeRecommendations.reduce((sum, t) => sum + t.recommendations.length, 0),
            data: traineeRecommendations,
            processingTime: Date.now(),
            chunksProcessed: chunks.length,
            chunkSize
          }
        });
      }

      return {
        success: true,
        totalTrainees: traineeRecommendations.length,
        totalCourses,
        recommendationsGenerated: traineeRecommendations.reduce((sum, t) => sum + t.recommendations.length, 0),
        data: traineeRecommendations
      };

    } catch (error) {
      console.error('Chunked recommendation generation error:', error);
      
      if (progressCallback) {
        progressCallback({
          type: 'error',
          message: `Error: ${error.message}`,
          error: error.message
        });
      }
      
      throw error;
    }
  }

  /**
   * Generate recommendations for a single trainee
   */
  async generateTraineeRecommendations(trainee, courses, enrollments, similarityMatrix, courseContexts, options) {
    const { maxRecommendations, minProbability, includeExplanations } = options;
    
    // Get trainee's current enrollments
    const traineeEnrollments = enrollments.filter(e => e.MemberId === trainee.MemberId);
    const enrolledCourseIds = traineeEnrollments.map(e => e.CourseId);
    
    // Fast recommendation calculation with early filtering
    const recommendations = [];
    const enrolledSet = new Set(enrolledCourseIds);
    
    for (const course of courses) {
      if (enrolledSet.has(course.CourseBasicDataId)) {
        continue; // Skip already enrolled courses
      }
      
      // Quick probability calculation
      const probability = this.calculateFastRecommendationProbability(
        enrolledCourseIds, course, enrollments, similarityMatrix
      );
      
      if (probability >= minProbability) {
        const recommendation = {
          courseId: course.CourseBasicDataId,
          courseName: course.CustomName,
          courseStatus: course.Status,
          probability: Math.round(probability * 100) / 100,
          explanation: includeExplanations ? `${Math.round(probability * 100)}% match based on enrollment patterns and course similarity` : null,
          similarCourses: enrolledCourseIds.length > 0 ? this.findTopSimilarCourses(course.CourseBasicDataId, enrolledCourseIds, courses, similarityMatrix) : []
        };
        
        recommendations.push(recommendation);
      }
    }
    
    // Sort by probability and limit results
    return recommendations
      .sort((a, b) => b.probability - a.probability)
      .slice(0, maxRecommendations);
  }

  /**
   * Fast probability calculation optimized for performance
   */
  calculateFastRecommendationProbability(enrolledCourseIds, course, enrollments, similarityMatrix) {
    let probability = 0.1; // Base probability
    
    // Factor 1: Course popularity (quick calculation)
    const courseEnrollments = enrollments.filter(e => e.CourseId === course.CourseBasicDataId).length;
    probability += Math.min(courseEnrollments / 100, 0.3); // Cap at 30%
    
    // Factor 2: Similarity to enrolled courses (optimized)
    if (enrolledCourseIds.length > 0) {
      let maxSimilarity = 0;
      for (const enrolledCourseId of enrolledCourseIds) {
        const similarity = similarityMatrix[course.CourseBasicDataId]?.[enrolledCourseId] || 0;
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
        }
      }
      probability += maxSimilarity * 0.5;
    }
    
    // Factor 3: Course status bonus
    if (course.Status === 1) {
      probability += 0.2;
    }
    
    return Math.min(probability, 1.0);
  }

  /**
   * Calculate recommendation probability for a trainee-course pair (detailed version)
   */
  calculateRecommendationProbability(trainee, course, enrolledCourseIds, courses, enrollments, similarityMatrix, courseContexts) {
    let probability = 0.1; // Base probability
    
    // Factor 1: Course popularity (20% weight)
    const courseEnrollments = enrollments.filter(e => e.CourseId === course.CourseBasicDataId).length;
    const maxEnrollments = Math.max(...courses.map(c => enrollments.filter(e => e.CourseId === c.CourseBasicDataId).length));
    if (maxEnrollments > 0) {
      probability += (courseEnrollments / maxEnrollments) * 0.2;
    }
    
    // Factor 2: Similarity to enrolled courses (60% weight)
    if (enrolledCourseIds.length > 0) {
      let maxSimilarity = 0;
      for (const enrolledCourseId of enrolledCourseIds) {
        const similarity = similarityMatrix[course.CourseBasicDataId]?.[enrolledCourseId] || 0;
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
      probability += maxSimilarity * 0.6;
    }
    
    // Factor 3: Course status bonus (20% weight)
    if (course.Status === 1) { // Active courses
      probability += 0.2;
    }
    
    return Math.min(probability, 1.0);
  }

  /**
   * Generate explanation for recommendation
   */
  generateExplanation(probability, enrolledCount, course) {
    const percentage = Math.round(probability * 100);
    return `${percentage}% match based on: ${enrolledCount} enrolled courses, ${course.Status === 1 ? 'active' : 'inactive'} course status, and similarity analysis.`;
  }

  /**
   * Find top similar courses (optimized version with course map)
   */
  findTopSimilarCourses(courseId, enrolledCourseIds, courses, similarityMatrix) {
    const similarities = [];
    
    // Create course lookup map for faster access
    const courseMap = new Map();
    courses.forEach(course => {
      courseMap.set(course.CourseBasicDataId, course);
    });
    
    for (const enrolledCourseId of enrolledCourseIds) {
      const similarity = similarityMatrix[courseId]?.[enrolledCourseId] || 0;
      if (similarity > 0.1) { // Only include meaningful similarities
        const enrolledCourse = courseMap.get(enrolledCourseId);
        if (enrolledCourse) {
          similarities.push({
            courseId: enrolledCourseId,
            courseName: enrolledCourse.CustomName,
            similarity: Math.round(similarity * 100) / 100
          });
        }
      }
    }
    
    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 2); // Top 2 for speed
  }

  /**
   * Find similar courses for explanation (detailed version)
   */
  findSimilarCourses(courseId, enrolledCourseIds, courses, similarityMatrix) {
    const similarities = [];
    
    for (const enrolledCourseId of enrolledCourseIds) {
      const similarity = similarityMatrix[courseId]?.[enrolledCourseId] || 0;
      if (similarity > 0) {
        const enrolledCourse = courses.find(c => c.CourseBasicDataId === enrolledCourseId);
        if (enrolledCourse) {
          similarities.push({
            courseId: enrolledCourseId,
            courseName: enrolledCourse.CustomName,
            similarity: Math.round(similarity * 100) / 100
          });
        }
      }
    }
    
    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  }

  /**
   * Get trainee's current courses with improved lookup
   */
  getTraineeCurrentCourses(traineeId, enrollments, courses) {
    const traineeEnrollments = enrollments.filter(e => e.MemberId === traineeId);
    
    // Create course lookup map for faster access
    const courseMap = new Map();
    courses.forEach(course => {
      courseMap.set(course.CourseBasicDataId, course);
    });
    
    return traineeEnrollments.map(enrollment => {
      const course = courseMap.get(enrollment.CourseId);
      
      if (!course) {
        console.log(`Warning: Course ID ${enrollment.CourseId} not found in courses data for trainee ${traineeId}`);
      }
      
      return {
        courseId: enrollment.CourseId,
        courseName: course ? course.CustomName : `Course ID: ${enrollment.CourseId}`,
        courseStatus: course ? course.Status : 1,
        enrollmentDate: enrollment.EnrollmentDate,
        isValid: !!course
      };
    }).filter(course => course.isValid); // Only return valid courses
  }

  /**
   * Calculate optimized similarity matrix using course names (faster version)
   */
  calculateBasicSimilarityMatrix(courses) {
    const matrix = {};
    
    // Pre-process course names for faster comparison
    const processedCourses = courses.map(course => ({
      id: course.CourseBasicDataId,
      name: course.CustomName,
      words: course.CustomName.toLowerCase().split(/\s+/).filter(word => word.length > 2)
    }));
    
    for (const course1 of processedCourses) {
      matrix[course1.id] = {};
      
      for (const course2 of processedCourses) {
        if (course1.id === course2.id) {
          matrix[course1.id][course2.id] = 1.0;
        } else {
          // Fast similarity calculation using pre-processed words
          const similarity = this.calculateFastSimilarity(course1.words, course2.words);
          matrix[course1.id][course2.id] = similarity;
        }
      }
    }
    
    return matrix;
  }

  /**
   * Fast similarity calculation using pre-processed word arrays
   */
  calculateFastSimilarity(words1, words2) {
    if (words1.length === 0 || words2.length === 0) return 0;
    
    let commonWords = 0;
    const words2Set = new Set(words2);
    
    for (const word1 of words1) {
      if (words2Set.has(word1)) {
        commonWords++;
      }
    }
    
    return commonWords / Math.max(words1.length, words2.length);
  }

  /**
   * Calculate name similarity between two courses (legacy method)
   */
  calculateNameSimilarity(name1, name2) {
    const words1 = name1.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const words2 = name2.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    return this.calculateFastSimilarity(words1, words2);
  }

  /**
   * Clean data integrity issues - remove invalid course references
   */
  cleanDataIntegrity(data) {
    const { courses, enrollments, trainees } = data;
    
    // Create course ID set for fast lookup
    const validCourseIds = new Set(courses.map(c => c.CourseBasicDataId));
    
    // Filter out enrollments with invalid course IDs
    const validEnrollments = enrollments.filter(enrollment => {
      const isValid = validCourseIds.has(enrollment.CourseId);
      if (!isValid) {
        console.log(`Removing invalid enrollment: CourseId ${enrollment.CourseId} not found`);
      }
      return isValid;
    });
    
    console.log(`Data integrity: ${enrollments.length} → ${validEnrollments.length} enrollments (removed ${enrollments.length - validEnrollments.length} invalid)`);
    
    return {
      courses,
      enrollments: validEnrollments,
      trainees
    };
  }

  /**
   * Apply filters to trainee list
   */
  applyTraineeFilters(trainees, filters) {
    let filtered = [...trainees];

    // Filter by name (partial match) with safe string conversion
    if (filters.nameSearch && filters.nameSearch.trim()) {
      const searchTerm = filters.nameSearch.toLowerCase().trim();
      filtered = filtered.filter(trainee => {
        const name = trainee.Name ? String(trainee.Name).toLowerCase() : '';
        const firstName = trainee.FirstName ? String(trainee.FirstName).toLowerCase() : '';
        const lastName = trainee.LastName ? String(trainee.LastName).toLowerCase() : '';
        
        return name.includes(searchTerm) || 
               firstName.includes(searchTerm) || 
               lastName.includes(searchTerm);
      });
    }

    // Filter by email (partial match) with safe string conversion
    if (filters.emailSearch && filters.emailSearch.trim()) {
      const searchTerm = filters.emailSearch.toLowerCase().trim();
      filtered = filtered.filter(trainee => {
        const email = trainee.Email ? String(trainee.Email).toLowerCase() : '';
        return email.includes(searchTerm);
      });
    }

    // Filter by phone (partial match) with safe string conversion
    if (filters.phoneSearch && filters.phoneSearch.trim()) {
      const searchTerm = filters.phoneSearch.trim();
      filtered = filtered.filter(trainee => {
        const phone = trainee.Phone ? String(trainee.Phone) : '';
        return phone.includes(searchTerm);
      });
    }

    // Filter by enrollment status
    if (filters.hasEnrollments !== undefined) {
      filtered = filtered.filter(trainee => {
        const hasEnrollments = this.traineeHasEnrollments(trainee.MemberId, filters.enrollments || []);
        return filters.hasEnrollments ? hasEnrollments : !hasEnrollments;
      });
    }

    // Filter by specific course enrollment
    if (filters.enrolledInCourse && filters.enrolledInCourse.length > 0) {
      filtered = filtered.filter(trainee => 
        this.traineeEnrolledInCourses(trainee.MemberId, filters.enrolledInCourse, filters.enrollments || [])
      );
    }

    // Filter by number of enrollments
    if (filters.minEnrollments !== undefined || filters.maxEnrollments !== undefined) {
      filtered = filtered.filter(trainee => {
        const enrollmentCount = this.getTraineeEnrollmentCount(trainee.MemberId, filters.enrollments || []);
        const meetsMin = filters.minEnrollments === undefined || enrollmentCount >= filters.minEnrollments;
        const meetsMax = filters.maxEnrollments === undefined || enrollmentCount <= filters.maxEnrollments;
        return meetsMin && meetsMax;
      });
    }

    // Random sampling if requested
    if (filters.randomSample && filters.randomSampleSize) {
      const shuffled = filtered.sort(() => 0.5 - Math.random());
      filtered = shuffled.slice(0, filters.randomSampleSize);
    }

    // Apply maxResults limit if specified (and not using random sampling)
    if (!filters.randomSample && filters.maxResults && filters.maxResults > 0) {
      filtered = filtered.slice(0, filters.maxResults);
    }

    console.log(`Applied filters: ${trainees.length} → ${filtered.length} trainees`);
    return filtered;
  }

  /**
   * Check if trainee has any enrollments
   */
  traineeHasEnrollments(traineeId, enrollments) {
    return enrollments.some(e => e.MemberId === traineeId);
  }

  /**
   * Check if trainee is enrolled in specific courses
   */
  traineeEnrolledInCourses(traineeId, courseIds, enrollments) {
    const traineeEnrollments = enrollments.filter(e => e.MemberId === traineeId);
    return courseIds.some(courseId => 
      traineeEnrollments.some(e => e.CourseId === courseId)
    );
  }

  /**
   * Get trainee enrollment count
   */
  getTraineeEnrollmentCount(traineeId, enrollments) {
    return enrollments.filter(e => e.MemberId === traineeId).length;
  }

  /**
   * Generate fallback contexts for courses
   */
  generateFallbackContexts(courses) {
    const contexts = {};
    
    courses.forEach(course => {
      const name = course.CustomName.toLowerCase();
      let subject_area = "General Training";
      
      // Simple keyword-based categorization
      if (name.includes('programming') || name.includes('code') || name.includes('software')) {
        subject_area = "Technology";
      } else if (name.includes('design') || name.includes('art') || name.includes('creative')) {
        subject_area = "Design";
      } else if (name.includes('business') || name.includes('management') || name.includes('marketing')) {
        subject_area = "Business";
      } else if (name.includes('language') || name.includes('english') || name.includes('communication')) {
        subject_area = "Language";
      }
      
      contexts[course.CourseBasicDataId] = {
        subject_area,
        skills_taught: course.CustomName.split(' ').slice(0, 3).join(' '),
        target_audience: "All levels",
        keywords: course.CustomName.split(' ').slice(0, 3)
      };
    });
    
    return contexts;
  }
}

module.exports = ChunkedRecommendationEngine;
