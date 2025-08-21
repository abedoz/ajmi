const _ = require('lodash');
const dataProcessor = require('./dataProcessor');

class RecommendationEngine {
  
  // 1. Similar courses based on past enrollments
  getSimilarCourseRecommendations(targetCourseId, courses, trainees, enrollments) {
    const targetCourse = courses.find(c => c.CourseBasicDataId === targetCourseId);
    if (!targetCourse) {
      throw new Error('Target course not found');
    }

    // Find trainees who took the target course
    const targetCourseTrainees = enrollments
      .filter(e => e.CourseId === targetCourseId)
      .map(e => e.MemberId);

    if (targetCourseTrainees.length === 0) {
      return [];
    }

    // Find what other courses these trainees took
    const otherCourses = enrollments
      .filter(e => targetCourseTrainees.includes(e.MemberId) && e.CourseId !== targetCourseId)
      .map(e => e.CourseId);

    // Count frequency of other courses
    const courseFrequency = _.countBy(otherCourses);
    
    // Get recommendations based on frequency
    const similarCourses = Object.keys(courseFrequency)
      .map(courseId => ({
        courseId,
        frequency: courseFrequency[courseId],
        course: courses.find(c => c.CourseBasicDataId === courseId)
      }))
      .filter(item => item.course)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10); // Top 10 similar courses

    // Generate recommendations for each similar course
    const recommendations = [];

    similarCourses.forEach(similarCourse => {
      // Find prospects who haven't taken this similar course
      const prospects = dataProcessor.findProspectsForCourse(
        similarCourse.courseId, trainees, enrollments
      );

      prospects.forEach(prospect => {
        // Check if prospect took the target course (higher relevance)
        const tookTargetCourse = enrollments.some(e => 
          e.MemberId === prospect.MemberId && e.CourseId === targetCourseId
        );

        recommendations.push({
          ...prospect,
          recommendedCourse: similarCourse.course.CustomName,
          recommendedCourseId: similarCourse.courseId,
          confidenceScore: dataProcessor.calculateConfidenceScore(
            prospect, similarCourse.course, enrollments, 'similar'
          ),
          reason: tookTargetCourse 
            ? `Took "${targetCourse.CustomName}" - commonly paired with this course`
            : `Similar to "${targetCourse.CustomName}" based on enrollment patterns`,
          relevanceScore: tookTargetCourse ? similarCourse.frequency + 10 : similarCourse.frequency
        });
      });
    });

    return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // 2. Courses for skill progression
  getSkillProgressionRecommendations(courses, trainees, enrollments) {
    const recommendations = [];

    trainees.forEach(trainee => {
      const traineeEnrollments = dataProcessor.getTraineeEnrollments(
        trainee.MemberId, enrollments, courses
      );

      if (traineeEnrollments.length === 0) {
        // New trainee - recommend beginner courses
        const beginnerCourses = courses.filter(c => c.Status <= 3); // Active courses
        
        beginnerCourses.slice(0, 3).forEach(course => {
          recommendations.push({
            ...trainee,
            recommendedCourse: course.CustomName,
            recommendedCourseId: course.CourseBasicDataId,
            confidenceScore: dataProcessor.calculateConfidenceScore(
              trainee, course, enrollments, 'progression'
            ),
            reason: 'New trainee - recommended starter course',
            relevanceScore: 5
          });
        });
      } else {
        // Existing trainee - suggest progression
        const completedCourses = traineeEnrollments.map(e => e.CourseId);
        const availableCourses = courses.filter(c => 
          !completedCourses.includes(c.CourseBasicDataId) && c.Status <= 3
        );

        // Simple progression logic - recommend courses that others with similar history took
        const similarTrainees = dataProcessor.findSimilarTrainees(
          trainee.MemberId, enrollments, 0.2
        );

        if (similarTrainees.length > 0) {
          // Find courses that similar trainees took but this trainee hasn't
          const similarTraineesCourses = enrollments
            .filter(e => similarTrainees.some(st => st.traineeId === e.MemberId))
            .filter(e => !completedCourses.includes(e.CourseId))
            .map(e => e.CourseId);

          const courseRecommendations = _.countBy(similarTraineesCourses);
          
          Object.keys(courseRecommendations)
            .slice(0, 2) // Top 2 recommendations per trainee
            .forEach(courseId => {
              const course = courses.find(c => c.CourseBasicDataId === courseId);
              if (course && course.Status <= 3) {
                recommendations.push({
                  ...trainee,
                  recommendedCourse: course.CustomName,
                  recommendedCourseId: courseId,
                  confidenceScore: dataProcessor.calculateConfidenceScore(
                    trainee, course, enrollments, 'progression'
                  ),
                  reason: `Next step in learning path (${traineeEnrollments.length} courses completed)`,
                  relevanceScore: courseRecommendations[courseId] + traineeEnrollments.length
                });
              }
            });
        }
      }
    });

    return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // 3. Popular courses among similar trainees
  getPopularCourseRecommendations(courses, trainees, enrollments) {
    // Calculate course popularity
    const coursePopularity = enrollments.reduce((acc, enrollment) => {
      acc[enrollment.CourseId] = (acc[enrollment.CourseId] || 0) + 1;
      return acc;
    }, {});

    // Get top popular courses
    const popularCourses = Object.keys(coursePopularity)
      .map(courseId => ({
        courseId,
        enrollmentCount: coursePopularity[courseId],
        course: courses.find(c => c.CourseBasicDataId === courseId)
      }))
      .filter(item => item.course && item.course.Status <= 3) // Only active courses
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
      .slice(0, 5); // Top 5 popular courses

    const recommendations = [];

    popularCourses.forEach(popularCourse => {
      // Find prospects who haven't taken this popular course
      const prospects = dataProcessor.findProspectsForCourse(
        popularCourse.courseId, trainees, enrollments
      );

      prospects.forEach(prospect => {
        // Check if prospect has similar interests (took related courses)
        const prospectEnrollments = enrollments.filter(e => e.MemberId === prospect.MemberId);
        let similarityBonus = 0;

        if (prospectEnrollments.length > 0) {
          // Find trainees who took both the popular course and courses the prospect took
          const prospectCourses = prospectEnrollments.map(e => e.CourseId);
          const relatedTrainees = enrollments
            .filter(e => e.CourseId === popularCourse.courseId)
            .map(e => e.MemberId);

          const commonInterests = enrollments
            .filter(e => relatedTrainees.includes(e.MemberId) && prospectCourses.includes(e.CourseId))
            .length;

          similarityBonus = commonInterests * 2;
        }

        recommendations.push({
          ...prospect,
          recommendedCourse: popularCourse.course.CustomName,
          recommendedCourseId: popularCourse.courseId,
          confidenceScore: dataProcessor.calculateConfidenceScore(
            prospect, popularCourse.course, enrollments, 'popular'
          ),
          reason: `Popular course (${popularCourse.enrollmentCount} enrollments)${similarityBonus > 0 ? ' + similar interests' : ''}`,
          relevanceScore: popularCourse.enrollmentCount + similarityBonus
        });
      });
    });

    return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // 4. Courses filling skill gaps
  getSkillGapRecommendations(courses, trainees, enrollments) {
    const recommendations = [];

    // Identify course sequences/patterns
    const courseSequences = this.identifyCourseSequences(enrollments, courses);

    trainees.forEach(trainee => {
      const traineeEnrollments = enrollments
        .filter(e => e.MemberId === trainee.MemberId)
        .map(e => e.CourseId);

      if (traineeEnrollments.length === 0) return; // Skip new trainees

      // Find gaps in common sequences
      courseSequences.forEach(sequence => {
        const takenFromSequence = sequence.courses.filter(courseId => 
          traineeEnrollments.includes(courseId)
        );

        if (takenFromSequence.length > 0 && takenFromSequence.length < sequence.courses.length) {
          // Found a gap in a sequence
          const missingCourses = sequence.courses.filter(courseId => 
            !traineeEnrollments.includes(courseId)
          );

          missingCourses.forEach(courseId => {
            const course = courses.find(c => c.CourseBasicDataId === courseId);
            if (course && course.Status <= 3) {
              recommendations.push({
                ...trainee,
                recommendedCourse: course.CustomName,
                recommendedCourseId: courseId,
                confidenceScore: dataProcessor.calculateConfidenceScore(
                  trainee, course, enrollments, 'gaps'
                ),
                reason: `Fills gap in ${sequence.name} sequence (${takenFromSequence.length}/${sequence.courses.length} completed)`,
                relevanceScore: sequence.frequency + (takenFromSequence.length * 2)
              });
            }
          });
        }
      });

      // Also recommend courses that complement existing skills
      const similarTrainees = dataProcessor.findSimilarTrainees(
        trainee.MemberId, enrollments, 0.4
      );

      if (similarTrainees.length > 0) {
        const complementaryCourses = enrollments
          .filter(e => similarTrainees.some(st => st.traineeId === e.MemberId))
          .filter(e => !traineeEnrollments.includes(e.CourseId))
          .map(e => e.CourseId);

        const courseFrequency = _.countBy(complementaryCourses);
        
        Object.keys(courseFrequency)
          .slice(0, 2)
          .forEach(courseId => {
            const course = courses.find(c => c.CourseBasicDataId === courseId);
            if (course && course.Status <= 3) {
              recommendations.push({
                ...trainee,
                recommendedCourse: course.CustomName,
                recommendedCourseId: courseId,
                confidenceScore: dataProcessor.calculateConfidenceScore(
                  trainee, course, enrollments, 'gaps'
                ),
                reason: `Complements existing skills (recommended by ${courseFrequency[courseId]} similar trainees)`,
                relevanceScore: courseFrequency[courseId] + traineeEnrollments.length
              });
            }
          });
      }
    });

    return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Helper method to identify common course sequences
  identifyCourseSequences(enrollments, courses) {
    // Group enrollments by trainee
    const traineeEnrollments = _.groupBy(enrollments, 'MemberId');
    
    // Find common patterns (simplified version)
    const sequences = [];
    
    // Look for pairs of courses often taken together
    const coursePairs = {};
    
    Object.values(traineeEnrollments).forEach(memberEnrollments => {
      const memberCourses = memberEnrollments.map(e => e.CourseId).sort();
      
      for (let i = 0; i < memberCourses.length - 1; i++) {
        for (let j = i + 1; j < memberCourses.length; j++) {
          const pair = `${memberCourses[i]}-${memberCourses[j]}`;
          coursePairs[pair] = (coursePairs[pair] || 0) + 1;
        }
      }
    });

    // Convert frequent pairs to sequences
    Object.keys(coursePairs)
      .filter(pair => coursePairs[pair] >= 3) // At least 3 trainees took this pair
      .forEach(pair => {
        const [course1, course2] = pair.split('-');
        const course1Name = courses.find(c => c.CourseBasicDataId === course1)?.CustomName || 'Unknown';
        const course2Name = courses.find(c => c.CourseBasicDataId === course2)?.CustomName || 'Unknown';
        
        sequences.push({
          name: `${course1Name} + ${course2Name}`,
          courses: [course1, course2],
          frequency: coursePairs[pair]
        });
      });

    return sequences.sort((a, b) => b.frequency - a.frequency);
  }
}

module.exports = new RecommendationEngine();