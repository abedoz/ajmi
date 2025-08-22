const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

class DataProcessor {
  constructor() {
    this.uploadDir = path.join(__dirname, '../uploads');
    this.ensureUploadDir();
  }

  ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async processExcelFile(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const result = {};

      // Expected sheet names
      const expectedSheets = ['Courses', 'Trainees', 'Enrollments'];
      
      for (const sheetName of expectedSheets) {
        if (workbook.SheetNames.includes(sheetName)) {
          const worksheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (data.length > 0) {
            // Remove empty rows
            const cleanData = data.filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));
            
            if (cleanData.length > 1) { // At least header + 1 data row
              const headers = cleanData[0];
              const rows = cleanData.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                  if (header && row[index] !== undefined) {
                    obj[header] = row[index];
                  }
                });
                return obj;
              });

              // Process data based on sheet type
              switch (sheetName) {
                case 'Courses':
                  result.courses = this.processCourses(rows);
                  break;
                case 'Trainees':
                  result.trainees = this.processTrainees(rows);
                  break;
                case 'Enrollments':
                  result.enrollments = this.processEnrollments(rows);
                  break;
              }

              result[`${sheetName.toLowerCase()}Headers`] = headers;
              result[`${sheetName.toLowerCase()}RowCount`] = rows.length;
            }
          }
        } else {
          console.warn(`Sheet '${sheetName}' not found in Excel file`);
        }
      }

      return result;
    } catch (error) {
      console.error('Error processing Excel file:', error);
      throw new Error(`Failed to process Excel file: ${error.message}`);
    }
  }

  // Process courses data
  processCourses(rawData) {
    return rawData.map(row => ({
      CourseBasicDataId: row.CourseBasicDatald || row.CourseBasicDataId || row.coursebasicdatald || row.coursebasicdataid || row.CourseID || row.CourseId,
      CustomName: row.CustomName || row.customname || row.CourseName || row.Name,
      Status: parseInt(row.Status || row.status) || 1
    })).filter(course => course.CourseBasicDataId && course.CustomName);
  }

  // Process trainees data
  processTrainees(rawData) {
    return rawData.map(row => ({
      MemberId: parseInt(row.Memberld || row.MemberId || row.memberld || row.memberid, 10),
      Name: row.Name || row.name || `Trainee ${row.Memberld || row.MemberId}`,
      Phone: row.Phone || row.phone || row.Mobile || row.mobile || '',
      Email: row.Email || row.email || ''
    })).filter(trainee => trainee.MemberId && !isNaN(trainee.MemberId));
  }

  // Process enrollments data
  processEnrollments(rawData) {
    return rawData.map(row => ({
      MemberId: row.Memberld || row.MemberId || row.memberld || row.memberid || row.Name || row.name,
      CourseId: row.Courseld || row.CourseId || row.courseld || row.courseid || row.CourseBasicDatald || row.CourseBasicDataId || row.CourseID,
      EnrollmentDate: row.EnrollmentDate || row.enrollmentdate || row.Date || new Date().toISOString()
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

    const summary = {};
    courses.forEach(course => {
      const status = course.Status || 1;
      summary[status] = (summary[status] || 0) + 1;
    });
    
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
        uniqueTrainees: new Set(courseEnrollments.map(e => e.MemberId)).size
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

    const allTrainees = [...new Set(enrollments.map(e => e.MemberId))];
    
    const similarities = allTrainees
      .filter(traineeId => traineeId !== targetTraineeId)
      .map(traineeId => {
        const traineeEnrollments = enrollments
          .filter(e => e.MemberId === traineeId)
          .map(e => e.CourseId);

        const intersection = targetEnrollments.filter(courseId => 
          traineeEnrollments.includes(courseId)
        );
        const union = [...new Set([...targetEnrollments, ...traineeEnrollments])];
        
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
      { label: 'Phone', value: 'Phone' },
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

  async processCSVFile(filePath) {
    try {
      const csv = require('csv-parser');
      const results = [];
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => {
            if (results.length === 0) {
              reject(new Error('CSV file is empty or invalid'));
              return;
            }
            
            const headers = Object.keys(results[0]);
            resolve({
              headers: headers,
              data: results,
              rowCount: results.length
            });
          })
          .on('error', (error) => {
            reject(new Error(`Failed to process CSV file: ${error.message}`));
          });
      });
    } catch (error) {
      console.error('Error processing CSV file:', error);
      throw new Error(`Failed to process CSV file: ${error.message}`);
    }
  }

  async processFile(filePath, fileType) {
    try {
      if (fileType === 'xlsx' || fileType === 'xls') {
        return await this.processExcelFile(filePath);
      } else if (fileType === 'csv') {
        return await this.processCSVFile(filePath);
      } else {
        throw new Error('Unsupported file type');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      throw error;
    }
  }

  exportToCSV(data, filename) {
    try {
      const parser = new Parser();
      const csv = parser.parse(data);
      
      const filePath = path.join(this.uploadDir, filename);
      fs.writeFileSync(filePath, csv);
      
      return filePath;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw new Error(`Failed to export to CSV: ${error.message}`);
    }
  }

  // Generate recommendations based on data and style
  generateRecommendations(data, style, targetCourseId = null) {
    try {
      if (!data || !data.courses || !data.enrollments) {
        return [];
      }

      const courses = data.courses;
      const enrollments = data.enrollments;
      const trainees = data.trainees || [];

      let recommendations = [];

      switch (style) {
        case 'popular':
          recommendations = this.generatePopularRecommendations(courses, enrollments);
          break;
        case 'similar':
          if (targetCourseId) {
            recommendations = this.generateSimilarRecommendations(courses, enrollments, targetCourseId);
          } else {
            recommendations = this.generatePopularRecommendations(courses, enrollments);
          }
          break;
        case 'personalized':
          recommendations = this.generatePersonalizedRecommendations(courses, enrollments, trainees);
          break;
        case 'trending':
          recommendations = this.generateTrendingRecommendations(courses, enrollments);
          break;
        default:
          recommendations = this.generatePopularRecommendations(courses, enrollments);
      }

      return recommendations.slice(0, 10); // Limit to top 10 recommendations
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [];
    }
  }

  generatePopularRecommendations(courses, enrollments) {
    const courseStats = courses.map(course => {
      const courseEnrollments = enrollments.filter(e => e.CourseId === course.CourseBasicDataId);
      return {
        courseId: course.CourseBasicDataId,
        courseName: course.CustomName,
        enrollmentCount: courseEnrollments.length,
        status: course.Status,
        score: courseEnrollments.length,
        reason: `Popular course with ${courseEnrollments.length} enrollments`
      };
    });

    return courseStats
      .filter(course => course.enrollmentCount > 0)
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount);
  }

  generateSimilarRecommendations(courses, enrollments, targetCourseId) {
    const targetEnrollments = enrollments.filter(e => e.CourseId === targetCourseId);
    const targetTrainees = targetEnrollments.map(e => e.MemberId);

    const coEnrollmentCounts = {};
    
    // Find courses that target trainees also took
    targetTrainees.forEach(traineeId => {
      const traineeEnrollments = enrollments.filter(e => e.MemberId === traineeId);
      traineeEnrollments.forEach(enrollment => {
        if (enrollment.CourseId !== targetCourseId) {
          coEnrollmentCounts[enrollment.CourseId] = (coEnrollmentCounts[enrollment.CourseId] || 0) + 1;
        }
      });
    });

    const recommendations = Object.keys(coEnrollmentCounts).map(courseId => {
      const course = courses.find(c => c.CourseBasicDataId === courseId);
      const count = coEnrollmentCounts[courseId];
      
      return {
        courseId: courseId,
        courseName: course ? course.CustomName : 'Unknown Course',
        enrollmentCount: count,
        status: course ? course.Status : 1,
        score: count,
        reason: `${count} trainees who took the target course also took this course`
      };
    });

    return recommendations.sort((a, b) => b.score - a.score);
  }

  generatePersonalizedRecommendations(courses, enrollments, trainees) {
    // For personalized recommendations, we'll recommend courses with good enrollment patterns
    const courseStats = this.generatePopularRecommendations(courses, enrollments);
    
    return courseStats.map(course => ({
      ...course,
      reason: `Personalized recommendation based on enrollment patterns and course popularity`
    }));
  }

  generateTrendingRecommendations(courses, enrollments) {
    // For trending, we'll look at recent enrollment patterns
    // Since we don't have dates, we'll use enrollment count as a proxy
    const courseStats = this.generatePopularRecommendations(courses, enrollments);
    
    return courseStats.map(course => ({
      ...course,
      reason: `Trending course with ${course.enrollmentCount} active enrollments`
    }));
  }

  cleanupFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error cleaning up file:', error);
    }
  }
}

module.exports = new DataProcessor();