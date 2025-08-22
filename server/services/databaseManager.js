const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
  constructor() {
    this.dbPath = path.join(__dirname, '../data/training_center.db');
    this.db = null;
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize database and create tables
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  /**
   * Create optimized database tables with indexes
   */
  async createTables() {
    const createQueries = [
      // Courses table
      `CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY,
        custom_name TEXT NOT NULL,
        status INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Trainees table
      `CREATE TABLE IF NOT EXISTS trainees (
        member_id INTEGER PRIMARY KEY,
        name TEXT,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Enrollments table
      `CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        enrollment_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES trainees (member_id),
        FOREIGN KEY (course_id) REFERENCES courses (id)
      )`,
      
      // Performance indexes
      `CREATE INDEX IF NOT EXISTS idx_enrollments_member_id ON enrollments (member_id)`,
      `CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments (course_id)`,
      `CREATE INDEX IF NOT EXISTS idx_trainees_email ON trainees (email)`,
      `CREATE INDEX IF NOT EXISTS idx_trainees_name ON trainees (name)`,
      `CREATE INDEX IF NOT EXISTS idx_courses_status ON courses (status)`,
      `CREATE INDEX IF NOT EXISTS idx_courses_name ON courses (custom_name)`,
      
      // Composite indexes for common queries
      `CREATE INDEX IF NOT EXISTS idx_enrollments_member_course ON enrollments (member_id, course_id)`,
      `CREATE INDEX IF NOT EXISTS idx_trainees_name_email ON trainees (name, email)`
    ];

    for (const query of createQueries) {
      await this.runQuery(query);
    }
    
    console.log('Database tables and indexes created successfully');
  }

  /**
   * Import data from processed JSON to database
   */
  async importData(processedData) {
    try {
      console.log('Starting database import...');
      
      // Clear existing data
      await this.runQuery('DELETE FROM enrollments');
      await this.runQuery('DELETE FROM trainees');
      await this.runQuery('DELETE FROM courses');
      
      // Import courses
      const courseStmt = this.db.prepare(`
        INSERT OR REPLACE INTO courses (id, custom_name, status) 
        VALUES (?, ?, ?)
      `);
      
      for (const course of processedData.courses) {
        await this.runPreparedStatement(courseStmt, [
          course.CourseBasicDataId,
          course.CustomName,
          course.Status || 1
        ]);
      }
      courseStmt.finalize();
      
      // Import trainees
      const traineeStmt = this.db.prepare(`
        INSERT OR REPLACE INTO trainees (member_id, name, first_name, last_name, email, phone) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      for (const trainee of processedData.trainees) {
        await this.runPreparedStatement(traineeStmt, [
          trainee.MemberId,
          trainee.Name || null,
          trainee.FirstName || null,
          trainee.LastName || null,
          trainee.Email || null,
          trainee.Phone || null
        ]);
      }
      traineeStmt.finalize();
      
      // Import enrollments (only valid ones)
      const courseIds = new Set(processedData.courses.map(c => c.CourseBasicDataId));
      const validEnrollments = processedData.enrollments.filter(e => courseIds.has(e.CourseId));
      
      const enrollmentStmt = this.db.prepare(`
        INSERT OR REPLACE INTO enrollments (member_id, course_id, enrollment_date) 
        VALUES (?, ?, ?)
      `);
      
      for (const enrollment of validEnrollments) {
        await this.runPreparedStatement(enrollmentStmt, [
          enrollment.MemberId,
          enrollment.CourseId,
          enrollment.EnrollmentDate
        ]);
      }
      enrollmentStmt.finalize();
      
      console.log(`Database import completed:
        - Courses: ${processedData.courses.length}
        - Trainees: ${processedData.trainees.length}
        - Valid Enrollments: ${validEnrollments.length}/${processedData.enrollments.length}
        - Removed Invalid: ${processedData.enrollments.length - validEnrollments.length}`);
      
      // Clear cache after data import
      this.clearCache();
      
      return {
        success: true,
        imported: {
          courses: processedData.courses.length,
          trainees: processedData.trainees.length,
          validEnrollments: validEnrollments.length,
          removedInvalid: processedData.enrollments.length - validEnrollments.length
        }
      };
      
    } catch (error) {
      console.error('Database import error:', error);
      throw error;
    }
  }

  /**
   * Get filtered trainees with pagination and optimized queries
   */
  async getFilteredTrainees(filters = {}, pagination = {}) {
    const cacheKey = `trainees_${JSON.stringify(filters)}_${JSON.stringify(pagination)}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const {
        nameSearch,
        emailSearch,
        phoneSearch,
        hasEnrollments,
        minEnrollments,
        maxEnrollments,
        randomSample,
        randomSampleSize
      } = filters;

      const {
        page = 1,
        limit = 50,
        sortBy = 'member_id',
        sortOrder = 'ASC'
      } = pagination;

      let query = `
        SELECT t.member_id, t.name, t.first_name, t.last_name, t.email, t.phone,
               COUNT(e.course_id) as enrollment_count
        FROM trainees t
        LEFT JOIN enrollments e ON t.member_id = e.member_id
        WHERE 1=1
      `;
      
      const params = [];

      // Apply filters
      if (nameSearch) {
        query += ` AND (t.name LIKE ? OR t.first_name LIKE ? OR t.last_name LIKE ?)`;
        const searchTerm = `%${nameSearch}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (emailSearch) {
        query += ` AND t.email LIKE ?`;
        params.push(`%${emailSearch}%`);
      }

      if (phoneSearch) {
        query += ` AND t.phone LIKE ?`;
        params.push(`%${phoneSearch}%`);
      }

      query += ` GROUP BY t.member_id, t.name, t.first_name, t.last_name, t.email, t.phone`;

      // Enrollment count filters (handle HAVING clause properly)
      const havingConditions = [];
      const havingParams = [];
      
      if (hasEnrollments === true) {
        havingConditions.push('enrollment_count > 0');
      } else if (hasEnrollments === false) {
        havingConditions.push('enrollment_count = 0');
      }

      if (minEnrollments !== undefined && minEnrollments !== '') {
        havingConditions.push('enrollment_count >= ?');
        havingParams.push(parseInt(minEnrollments));
      }

      if (maxEnrollments !== undefined && maxEnrollments !== '') {
        havingConditions.push('enrollment_count <= ?');
        havingParams.push(parseInt(maxEnrollments));
      }

      if (havingConditions.length > 0) {
        query += ` HAVING ${havingConditions.join(' AND ')}`;
        params.push(...havingParams);
      }

      // Sorting with proper table aliases
      const allowedSortFields = {
        'member_id': 't.member_id',
        'name': 't.name', 
        'email': 't.email',
        'enrollment_count': 'enrollment_count'
      };
      const sortField = allowedSortFields[sortBy] || 't.member_id';
      const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      
      if (randomSample) {
        query += ` ORDER BY RANDOM()`;
        if (randomSampleSize) {
          query += ` LIMIT ?`;
          params.push(randomSampleSize);
        }
      } else {
        query += ` ORDER BY ${sortField} ${order}`;
        query += ` LIMIT ? OFFSET ?`;
        params.push(limit, (page - 1) * limit);
      }

      console.log('Executing filtered trainees query:', query);
      console.log('With parameters:', params);
      
      const trainees = await this.getAllRows(query, params);
      console.log(`Filtered trainees query returned ${trainees.length} trainees`);
      
      // Get total count for pagination using subquery approach
      let countQuery = `
        SELECT COUNT(*) as total FROM (
          SELECT t.member_id
          FROM trainees t
          LEFT JOIN enrollments e ON t.member_id = e.member_id
          WHERE 1=1
      `;
      
      const countParams = [];
      // Apply same filters for count
      if (nameSearch) {
        countQuery += ` AND (t.name LIKE ? OR t.first_name LIKE ? OR t.last_name LIKE ?)`;
        const searchTerm = `%${nameSearch}%`;
        countParams.push(searchTerm, searchTerm, searchTerm);
      }
      if (emailSearch) {
        countQuery += ` AND t.email LIKE ?`;
        countParams.push(`%${emailSearch}%`);
      }
      if (phoneSearch) {
        countQuery += ` AND t.phone LIKE ?`;
        countParams.push(`%${phoneSearch}%`);
      }

      countQuery += ` GROUP BY t.member_id`;

      // Apply HAVING conditions to count query
      if (havingConditions.length > 0) {
        countQuery += ` HAVING ${havingConditions.join(' AND ')}`;
      }
      
      countQuery += `)`;

      const totalResult = await this.getRow(countQuery, countParams);
      const total = totalResult.total;

      const result = {
        success: true,
        data: trainees,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        },
        filters: filters,
        processedAt: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      return result;

    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Get course recommendations for a trainee using optimized database queries
   */
  async getTraineeRecommendations(traineeId, options = {}) {
    const cacheKey = `recommendations_${traineeId}_${JSON.stringify(options)}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const {
        maxRecommendations = 5,
        minProbability = 0.1,
        excludeEnrolled = true
      } = options;

      // Get trainee's current enrollments
      const enrolledCoursesQuery = `
        SELECT DISTINCT course_id 
        FROM enrollments 
        WHERE member_id = ?
      `;
      const enrolledCourses = await this.getAllRows(enrolledCoursesQuery, [traineeId]);
      const enrolledCourseIds = enrolledCourses.map(row => row.course_id);

      // Get course recommendations with popularity scoring
      let recommendationQuery = `
        SELECT 
          c.id as course_id,
          c.custom_name as course_name,
          c.status as course_status,
          COUNT(e.member_id) as popularity_score,
          CASE 
            WHEN c.status = 1 THEN 0.3
            WHEN c.status = 3 THEN 0.2  
            ELSE 0.1
          END as status_bonus
        FROM courses c
        LEFT JOIN enrollments e ON c.id = e.course_id
        WHERE 1=1
      `;

      const params = [];

      if (excludeEnrolled && enrolledCourseIds.length > 0) {
        const placeholders = enrolledCourseIds.map(() => '?').join(',');
        recommendationQuery += ` AND c.id NOT IN (${placeholders})`;
        params.push(...enrolledCourseIds);
      }

      recommendationQuery += `
        GROUP BY c.id, c.custom_name, c.status
        ORDER BY (popularity_score * 0.001 + status_bonus) DESC
        LIMIT ?
      `;
      params.push(maxRecommendations * 2); // Get more for filtering

      const recommendations = await this.getAllRows(recommendationQuery, params);
      
      // Calculate final probability scores
      const scoredRecommendations = recommendations.map(rec => {
        const baseScore = 0.1;
        const popularityScore = Math.min(rec.popularity_score / 100, 0.4);
        const statusScore = rec.status_bonus;
        const probability = baseScore + popularityScore + statusScore;
        
        return {
          courseId: rec.course_id,
          courseName: rec.course_name,
          courseStatus: rec.course_status,
          probability: Math.round(probability * 100) / 100,
          popularityScore: rec.popularity_score,
          explanation: `${Math.round(probability * 100)}% match based on course popularity (${rec.popularity_score} enrollments) and status`
        };
      }).filter(rec => rec.probability >= minProbability);

      const result = {
        success: true,
        traineeId,
        recommendations: scoredRecommendations.slice(0, maxRecommendations),
        enrolledCourses: enrolledCourseIds,
        processedAt: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, result);
      
      return result;

    } catch (error) {
      console.error('Recommendation query error:', error);
      throw error;
    }
  }

  /**
   * Get aggregated statistics with caching
   */
  async getStatistics() {
    const cacheKey = 'statistics';
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const queries = {
        totalCourses: 'SELECT COUNT(*) as count FROM courses',
        totalTrainees: 'SELECT COUNT(*) as count FROM trainees',
        totalEnrollments: 'SELECT COUNT(*) as count FROM enrollments',
        coursesByStatus: `
          SELECT status, COUNT(*) as count 
          FROM courses 
          GROUP BY status 
          ORDER BY status
        `,
        topCourses: `
          SELECT c.custom_name, COUNT(e.member_id) as enrollment_count
          FROM courses c
          LEFT JOIN enrollments e ON c.id = e.course_id
          GROUP BY c.id, c.custom_name
          ORDER BY enrollment_count DESC
          LIMIT 10
        `,
        engagementLevels: `
          SELECT 
            CASE 
              WHEN enrollment_count >= 5 THEN 'high'
              WHEN enrollment_count >= 2 THEN 'medium'
              WHEN enrollment_count >= 1 THEN 'low'
              ELSE 'none'
            END as engagement_level,
            COUNT(*) as count
          FROM (
            SELECT t.member_id, COUNT(e.course_id) as enrollment_count
            FROM trainees t
            LEFT JOIN enrollments e ON t.member_id = e.member_id
            GROUP BY t.member_id
          )
          GROUP BY engagement_level
        `
      };

      const results = {};
      for (const [key, query] of Object.entries(queries)) {
        if (key.includes('total')) {
          const result = await this.getRow(query);
          results[key] = result.count;
        } else {
          results[key] = await this.getAllRows(query);
        }
      }

      const statistics = {
        success: true,
        ...results,
        averageEnrollmentsPerTrainee: results.totalEnrollments / results.totalTrainees,
        averageEnrollmentsPerCourse: results.totalEnrollments / results.totalCourses,
        generatedAt: new Date().toISOString()
      };

      // Cache for 5 minutes
      this.setCache(cacheKey, statistics);
      
      return statistics;

    } catch (error) {
      console.error('Statistics query error:', error);
      throw error;
    }
  }

  /**
   * Search trainees with full-text search capabilities
   */
  async searchTrainees(searchTerm, options = {}) {
    const cacheKey = `search_${searchTerm}_${JSON.stringify(options)}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const { limit = 50, includeEnrollments = false } = options;
      
      let query = `
        SELECT t.member_id, t.name, t.first_name, t.last_name, t.email, t.phone,
               COUNT(e.course_id) as enrollment_count
        FROM trainees t
        LEFT JOIN enrollments e ON t.member_id = e.member_id
        WHERE (
          t.name LIKE ? OR 
          t.first_name LIKE ? OR 
          t.last_name LIKE ? OR 
          t.email LIKE ? OR 
          t.phone LIKE ?
        )
        GROUP BY t.member_id, t.name, t.first_name, t.last_name, t.email, t.phone
        ORDER BY enrollment_count DESC, t.name ASC
        LIMIT ?
      `;

      const searchPattern = `%${searchTerm}%`;
      const params = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, limit];
      
      const trainees = await this.getAllRows(query, params);
      
      // Optionally include enrollment details
      if (includeEnrollments) {
        for (const trainee of trainees) {
          const enrollmentsQuery = `
            SELECT e.course_id, c.custom_name as course_name, c.status as course_status, e.enrollment_date
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            WHERE e.member_id = ?
            ORDER BY e.enrollment_date DESC
          `;
          trainee.enrollments = await this.getAllRows(enrollmentsQuery, [trainee.member_id]);
        }
      }

      const result = {
        success: true,
        searchTerm,
        results: trainees,
        count: trainees.length,
        processedAt: new Date().toISOString()
      };

      // Cache for 2 minutes (shorter for search results)
      this.setCache(cacheKey, result, 2 * 60 * 1000);
      
      return result;

    } catch (error) {
      console.error('Search query error:', error);
      throw error;
    }
  }

  /**
   * Cache management
   */
  setCache(key, value, duration = this.CACHE_DURATION) {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + duration);
  }

  getFromCache(key) {
    if (this.cache.has(key)) {
      const expiry = this.cacheExpiry.get(key);
      if (Date.now() < expiry) {
        return this.cache.get(key);
      } else {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
    return null;
  }

  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
    console.log('Cache cleared');
  }

  /**
   * Database utility methods
   */
  runQuery(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  runPreparedStatement(stmt, params) {
    return new Promise((resolve, reject) => {
      stmt.run(params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  getRow(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  getAllRows(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = DatabaseManager;
