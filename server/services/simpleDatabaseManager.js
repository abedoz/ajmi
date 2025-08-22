const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SimpleDatabaseManager {
  constructor() {
    this.dbPath = path.join(__dirname, '../data/training_center.db');
    this.db = null;
    this.dbPool = []; // Simple connection pool
    this.maxConnections = 5;
  }

  /**
   * Get database instance with connection pooling
   */
  getDB() {
    if (!this.db) {
      this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
          console.error('Database connection error:', err);
        } else {
          // Enable WAL mode for better concurrent access
          this.db.run('PRAGMA journal_mode=WAL');
          this.db.run('PRAGMA busy_timeout=10000'); // 10 second timeout
          this.db.run('PRAGMA synchronous=NORMAL');
        }
      });
    }
    return this.db;
  }

  /**
   * Simple query to get trainees without enrollments
   */
  async getTraineesWithoutEnrollments(limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT t.member_id, t.name, t.email, t.phone, COUNT(e.course_id) as enrollment_count
        FROM trainees t
        LEFT JOIN enrollments e ON t.member_id = e.member_id
        GROUP BY t.member_id, t.name, t.email, t.phone
        HAVING enrollment_count = 0
        ORDER BY t.member_id
        LIMIT ? OFFSET ?
      `;
      
      this.getDB().all(query, [limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Count trainees without enrollments
   */
  async countTraineesWithoutEnrollments() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COUNT(*) as total FROM (
          SELECT t.member_id
          FROM trainees t
          LEFT JOIN enrollments e ON t.member_id = e.member_id
          GROUP BY t.member_id
          HAVING COUNT(e.course_id) = 0
        )
      `;
      
      this.getDB().get(query, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.total);
        }
      });
    });
  }

  /**
   * Get trainees from specific domain without enrollments
   */
  async getTraineesFromDomainWithoutEnrollments(domain, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT t.member_id, t.name, t.email, t.phone, COUNT(e.course_id) as enrollment_count
        FROM trainees t
        LEFT JOIN enrollments e ON t.member_id = e.member_id
        WHERE t.email LIKE ?
        GROUP BY t.member_id, t.name, t.email, t.phone
        HAVING enrollment_count = 0
        ORDER BY t.name
        LIMIT ? OFFSET ?
      `;
      
      this.getDB().all(query, [`%${domain}%`, limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Count trainees from specific domain without enrollments
   */
  async countTraineesFromDomainWithoutEnrollments(domain) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COUNT(*) as total FROM (
          SELECT t.member_id
          FROM trainees t
          LEFT JOIN enrollments e ON t.member_id = e.member_id
          WHERE t.email LIKE ?
          GROUP BY t.member_id
          HAVING COUNT(e.course_id) = 0
        )
      `;
      
      this.getDB().get(query, [`%${domain}%`], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.total);
        }
      });
    });
  }

  /**
   * Simple search trainees by name or email
   */
  async searchTrainees(searchTerm, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT t.member_id, t.name, t.email, t.phone, COUNT(e.course_id) as enrollment_count
        FROM trainees t
        LEFT JOIN enrollments e ON t.member_id = e.member_id
        WHERE (t.name LIKE ? OR t.email LIKE ? OR t.phone LIKE ?)
        GROUP BY t.member_id, t.name, t.email, t.phone
        ORDER BY enrollment_count DESC, t.name
        LIMIT ? OFFSET ?
      `;
      
      const searchPattern = `%${searchTerm}%`;
      this.getDB().all(query, [searchPattern, searchPattern, searchPattern, limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Search for "${searchTerm}" returned ${rows.length} results`);
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get random trainees from specific domain
   */
  async getRandomTraineesFromDomain(domain, count = 20) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT t.member_id, t.name, t.email, t.phone, COUNT(e.course_id) as enrollment_count
        FROM trainees t
        LEFT JOIN enrollments e ON t.member_id = e.member_id
        WHERE t.email LIKE ?
        GROUP BY t.member_id, t.name, t.email, t.phone
        ORDER BY RANDOM()
        LIMIT ?
      `;
      
      this.getDB().all(query, [`%${domain}%`, count], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Random search for "${domain}" returned ${rows.length} results`);
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get all trainees with enrollment counts
   */
  async getTrainees(limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT t.member_id, t.name, t.email, t.phone, COUNT(e.course_id) as enrollment_count
        FROM trainees t
        LEFT JOIN enrollments e ON t.member_id = e.member_id
        GROUP BY t.member_id, t.name, t.email, t.phone
        ORDER BY enrollment_count DESC
        LIMIT ? OFFSET ?
      `;
      
      this.getDB().all(query, [limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get trainees with enrollments
   */
  async getTraineesWithEnrollments(limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT t.member_id, t.name, t.email, t.phone, COUNT(e.course_id) as enrollment_count
        FROM trainees t
        INNER JOIN enrollments e ON t.member_id = e.member_id
        GROUP BY t.member_id, t.name, t.email, t.phone
        ORDER BY enrollment_count DESC
        LIMIT ? OFFSET ?
      `;
      
      this.getDB().all(query, [limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get random trainees
   */
  async getRandomTrainees(count = 10) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT t.member_id, t.name, t.email, t.phone, COUNT(e.course_id) as enrollment_count
        FROM trainees t
        LEFT JOIN enrollments e ON t.member_id = e.member_id
        GROUP BY t.member_id, t.name, t.email, t.phone
        ORDER BY RANDOM()
        LIMIT ?
      `;
      
      this.getDB().all(query, [count], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Count all trainees
   */
  async countAllTrainees() {
    return new Promise((resolve, reject) => {
      const query = `SELECT COUNT(*) as total FROM trainees`;
      
      this.getDB().get(query, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.total);
        }
      });
    });
  }
}

module.exports = SimpleDatabaseManager;
