const { Parser } = require('json2csv');
const _ = require('lodash');

class DataProcessor {
  // Process courses CSV data
  processCourses(rawData) {
    return rawData.map(row => ({
      CourseBasicDataId: row.CourseBasicDataId || row.coursebasicdataid || row.CourseID,
      CustomName: row.CustomName || row.customname || row.CourseName,
      Status: parseInt(row.Status || row.status) || 1
    })).filter(course => course.CourseBasicDataId && course.CustomName);
  }

  // Process trainees CSV data
  processTrainees(rawData) {
    return rawData.map(row => ({
      MemberId: row.MemberId || row.memberid || row.Name,
      Name: row.Name || row.name || row.MemberId,
      Mobile: row.Mobile || row.mobile || row.Phone || '',
      Email: row.Email || row.email || ''
    })).filter(trainee => trainee.MemberId);
  }

  // Process enrollments CSV data
  processEnrollments(rawData) {
    return rawData.map(row => ({
      MemberId: row.MemberId || row.memberid,
      CourseId: row.CourseId || row.courseid || row.CourseBasicDataId,
      EnrollmentDate: row.EnrollmentDate || row.enrollmentdate || new Date().toISOString()
    })).filter(enrollment => enrollment.MemberId && enrollment.CourseId);
  }

  // Get course status summary
  getCourseStatusSummary(courses) {
    const statusLabels = {
      1: 'Created',
      2: 'Opened', 
      3: 'Running',
      4: 'Closed',
      5: 'Archived'
    };

    const summary = _.countBy(courses, 'Status');
    
    return Object.keys(summary).map(status => ({
      status: parseInt(status),
      label: statusLabels[status] || 'Unknown',
      count: summary[status]
    }));
  }

  // Get trainee enrollment history
  getTraineeEnrollments(memberId, enrollments, courses) {
    const memberEnrollments = enrollments.filter(e => e.MemberId === memberId);
    
    return memberEnrollments.map(enrollment => {
      const course = courses.find(c => c.CourseBasicDataId === enrollment.CourseId);
      return {
        ...enrollment,
        courseName: course ? course.CustomName : 'Unknown Course',
        courseStatus: course ? course.Status : null
      };
    });
  }

  // Get course enrollment statistics
  getCourseStats(courses, enrollments) {
    return courses.map(course => {
      const courseEnrollments = enrollments.filter(e => e.CourseId === course.CourseBasicDataId);
      
      return {
        ...course,
        enrollmentCount: courseEnrollments.length,
        uniqueTrainees: _.uniq(courseEnrollments.map(e => e.MemberId)).length
      };
    });
  }

  // Find trainees who haven't taken specific courses
  findProspectsForCourse(courseId, trainees, enrollments) {
    const enrolledTrainees = enrollments
      .filter(e => e.CourseId === courseId)
      .map(e => e.MemberId);

    return trainees.filter(trainee => 
      !enrolledTrainees.includes(trainee.MemberId)
    );
  }

  // Find trainees with similar enrollment patterns
  findSimilarTrainees(targetTraineeId, enrollments, threshold = 0.3) {
    const targetEnrollments = enrollments
      .filter(e => e.MemberId === targetTraineeId)
      .map(e => e.CourseId);

    if (targetEnrollments.length === 0) return [];

    const allTrainees = _.uniq(enrollments.map(e => e.MemberId));
    
    const similarities = allTrainees
      .filter(traineeId => traineeId !== targetTraineeId)
      .map(traineeId => {
        const traineeEnrollments = enrollments
          .filter(e => e.MemberId === traineeId)
          .map(e => e.CourseId);

        const intersection = _.intersection(targetEnrollments, traineeEnrollments);
        const union = _.union(targetEnrollments, traineeEnrollments);
        
        const similarity = union.length > 0 ? intersection.length / union.length : 0;

        return {
          traineeId,
          similarity,
          commonCourses: intersection.length,
          totalCourses: traineeEnrollments.length
        };
      })
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    return similarities;
  }

  // Export prospects to CSV
  exportProspects(prospects, format = 'csv') {
    const fields = [
      { label: 'Name', value: 'Name' },
      { label: 'Email', value: 'Email' },
      { label: 'Mobile', value: 'Mobile' },
      { label: 'Recommended Course', value: 'recommendedCourse' },
      { label: 'Confidence Score', value: 'confidenceScore' },
      { label: 'Reason', value: 'reason' }
    ];

    const parser = new Parser({ fields });
    return parser.parse(prospects);
  }

  // Calculate recommendation confidence scores
  calculateConfidenceScore(trainee, course, enrollments, method) {
    let baseScore = 0.5; // Default confidence

    switch (method) {
      case 'similar':
        // Higher confidence for trainees with more similar patterns
        const similarities = this.findSimilarTrainees(trainee.MemberId, enrollments);
        baseScore = similarities.length > 0 ? Math.min(0.9, 0.5 + (similarities.length * 0.1)) : 0.3;
        break;
      
      case 'popular':
        // Higher confidence for more popular courses
        const courseEnrollments = enrollments.filter(e => e.CourseId === course.CourseBasicDataId);
        baseScore = Math.min(0.9, 0.4 + (courseEnrollments.length * 0.05));
        break;
      
      case 'progression':
        // Medium to high confidence for logical progressions
        baseScore = 0.7;
        break;
      
      case 'gaps':
        // Variable confidence based on gap analysis
        baseScore = 0.6;
        break;
    }

    return Math.round(baseScore * 100) / 100; // Round to 2 decimal places
  }
}

module.exports = new DataProcessor();