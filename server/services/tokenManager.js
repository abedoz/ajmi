const { OAuth2Client } = require('google-auth-library');

class TokenManager {
  constructor(oauth2Client) {
    this.oauth2Client = oauth2Client;
    this.refreshInterval = null;
    this.REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes (tokens expire in 1 hour)
    this.TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes buffer
  }

  /**
   * Start automatic token refresh
   */
  startAutoRefresh() {
    console.log('🔄 Starting automatic token refresh every 45 minutes');
    
    // Clear any existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Set up automatic refresh
    this.refreshInterval = setInterval(async () => {
      await this.refreshTokenIfNeeded();
    }, this.REFRESH_INTERVAL);

    // Also check immediately
    setTimeout(() => {
      this.refreshTokenIfNeeded();
    }, 5000); // Check after 5 seconds
  }

  /**
   * Stop automatic token refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('🛑 Stopped automatic token refresh');
    }
  }

  /**
   * Check if token needs refresh and refresh if necessary
   */
  async refreshTokenIfNeeded() {
    try {
      if (!global.oauthTokens || !global.oauthTokens.refresh_token) {
        console.log('⚠️ No refresh token available for automatic refresh');
        return false;
      }

      // Check if token is close to expiry or already expired
      const needsRefresh = this.isTokenExpiringSoon();
      
      if (needsRefresh) {
        console.log('🔄 Token expiring soon, refreshing automatically...');
        return await this.refreshToken();
      } else {
        console.log('✅ Token is still valid, no refresh needed');
        return true;
      }

    } catch (error) {
      console.error('❌ Error in automatic token refresh:', error);
      return false;
    }
  }

  /**
   * Check if token is expiring soon
   */
  isTokenExpiringSoon() {
    if (!global.oauthTokens || !global.oauthTokens.expiry_date) {
      // If no expiry date, assume it needs refresh
      return true;
    }

    const now = Date.now();
    const expiryTime = global.oauthTokens.expiry_date;
    const timeUntilExpiry = expiryTime - now;

    // Refresh if expiring within 5 minutes
    return timeUntilExpiry <= this.TOKEN_EXPIRY_BUFFER;
  }

  /**
   * Refresh the OAuth token
   */
  async refreshToken() {
    try {
      if (!global.oauthTokens || !global.oauthTokens.refresh_token) {
        throw new Error('No refresh token available');
      }

      console.log('🔄 Refreshing OAuth token...');
      
      this.oauth2Client.setCredentials(global.oauthTokens);
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      // Update global tokens
      global.oauthTokens = {
        ...global.oauthTokens,
        ...credentials,
        expiry_date: credentials.expiry_date || (Date.now() + 3600000) // 1 hour from now
      };

      // Save to file
      this.saveTokensToFile(global.oauthTokens);
      
      console.log('✅ OAuth token refreshed successfully');
      console.log(`🕐 New token expires at: ${new Date(global.oauthTokens.expiry_date).toLocaleString()}`);
      
      return true;

    } catch (error) {
      console.error('❌ Failed to refresh OAuth token:', error);
      
      // If refresh fails, we might need to re-authenticate
      if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired')) {
        console.log('🔐 Refresh token expired, manual re-authentication required');
        global.oauthTokens = null;
        this.clearTokensFile();
      }
      
      return false;
    }
  }

  /**
   * Validate current token by making a test API call
   */
  async validateToken() {
    try {
      if (!global.oauthTokens || !global.oauthTokens.access_token) {
        return false;
      }

      // Simple test call to Vertex AI
      const axios = require('axios');
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'ajgc-mep-app-dev-ccd-01';
      const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
      
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-pro:generateContent`;
      
      const payload = {
        contents: [{
          parts: [{
            text: "Test"
          }]
        }],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0.1
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${global.oauthTokens.access_token}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      console.log('✅ Token validation successful');
      return true;

    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('❌ Token validation failed - token expired or invalid');
        return false;
      }
      
      console.log('⚠️ Token validation error (but token might still be valid):', error.message);
      return true; // Assume valid if it's not an auth error
    }
  }

  /**
   * Ensure token is valid before AI operations
   */
  async ensureValidToken() {
    try {
      console.log('🔍 Checking token validity...');
      
      // First check if we have tokens
      if (!global.oauthTokens || !global.oauthTokens.access_token) {
        console.log('❌ No OAuth tokens available');
        return false;
      }
      
      console.log('✅ OAuth tokens found, checking expiry...');

      // Check if token is expiring soon
      if (this.isTokenExpiringSoon()) {
        console.log('🔄 Token expiring soon, refreshing...');
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          return false;
        }
      }

      // Validate the token
      const isValid = await this.validateToken();
      if (!isValid) {
        console.log('🔄 Token invalid, attempting refresh...');
        return await this.refreshToken();
      }

      return true;

    } catch (error) {
      console.error('❌ Error ensuring valid token:', error);
      return false;
    }
  }

  /**
   * Save tokens to file
   */
  saveTokensToFile(tokens) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const tokensDir = path.join(__dirname, '../data');
      if (!fs.existsSync(tokensDir)) {
        fs.mkdirSync(tokensDir, { recursive: true });
      }
      
      const tokensPath = path.join(tokensDir, 'oauth_tokens.json');
      fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
      console.log('💾 OAuth tokens saved to file');
    } catch (error) {
      console.error('❌ Error saving tokens to file:', error);
    }
  }

  /**
   * Clear tokens file
   */
  clearTokensFile() {
    try {
      const fs = require('fs');
      const path = require('path');
      const tokensPath = path.join(__dirname, '../data/oauth_tokens.json');
      
      if (fs.existsSync(tokensPath)) {
        fs.unlinkSync(tokensPath);
        console.log('🗑️ OAuth tokens file cleared');
      }
    } catch (error) {
      console.error('❌ Error clearing tokens file:', error);
    }
  }

  /**
   * Get token status for monitoring
   */
  getTokenStatus() {
    if (!global.oauthTokens) {
      return {
        authenticated: false,
        hasRefreshToken: false,
        expiresAt: null,
        timeUntilExpiry: null
      };
    }

    const now = Date.now();
    const expiryTime = global.oauthTokens.expiry_date;
    const timeUntilExpiry = expiryTime ? expiryTime - now : null;

    return {
      authenticated: !!global.oauthTokens.access_token,
      hasRefreshToken: !!global.oauthTokens.refresh_token,
      expiresAt: expiryTime ? new Date(expiryTime).toLocaleString() : null,
      timeUntilExpiry: timeUntilExpiry,
      isExpiringSoon: timeUntilExpiry ? timeUntilExpiry <= this.TOKEN_EXPIRY_BUFFER : false
    };
  }
}

module.exports = TokenManager;
