const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

class AIService {
  constructor() {
    this.openai = null;
    this.azureOpenai = null;
    this.gemini = null;
    this.claude = null;
    this.vertexAI = null;
    this.oauth2Client = null;
  }

  createAIClient(provider, apiKey, endpoint = null, model = null) {
    switch (provider) {
      case 'openai':
        this.openai = new OpenAI({
          apiKey: apiKey
        });
        break;
      case 'azure':
        this.azureOpenai = new OpenAI({
          apiKey: apiKey,
          baseURL: endpoint
        });
        break;
      case 'gemini':
        this.gemini = new GoogleGenerativeAI(apiKey);
        break;
      case 'claude':
        this.claude = new Anthropic({
          apiKey: apiKey
        });
        break;
      case 'vertex':
        // For Vertex AI, we'll use OAuth 2.0 authentication
        this.oauth2Client = new OAuth2Client(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback'
        );
        break;
    }
  }

  async testOpenAI(apiKey) {
    try {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello, this is a test message.' }],
        max_tokens: 10
      });
      return { success: true, message: 'OpenAI connection successful' };
    } catch (error) {
      return { success: false, message: `OpenAI test failed: ${error.message}` };
    }
  }

  async testAzureOpenAI(apiKey, endpoint) {
    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: endpoint
      });
      const response = await openai.chat.completions.create({
        model: 'gpt-35-turbo',
        messages: [{ role: 'user', content: 'Hello, this is a test message.' }],
        max_tokens: 10
      });
      return { success: true, message: 'Azure OpenAI connection successful' };
    } catch (error) {
      return { success: false, message: `Azure OpenAI test failed: ${error.message}` };
    }
  }

  async testGemini(apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent('Hello, this is a test message.');
      return { success: true, message: 'Gemini connection successful' };
    } catch (error) {
      return { success: false, message: `Gemini test failed: ${error.message}` };
    }
  }

  async testClaude(apiKey) {
    try {
      const claude = new Anthropic({ apiKey });
      const response = await claude.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello, this is a test message.' }]
      });
      return { success: true, message: 'Claude connection successful' };
    } catch (error) {
      return { success: false, message: `Claude test failed: ${error.message}` };
    }
  }

  async testVertexAI(apiKey, projectId, location) {
    try {
      console.log('Testing Vertex AI with OAuth 2.0 authentication');
      
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'ajgc-mep-app-dev-ccd-01';
      const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
      
              // Ensure we have valid OAuth tokens
        const hasValidToken = await global.tokenManager.ensureValidToken();
        
        if (!hasValidToken) {
          return { 
            success: false, 
            message: 'OAuth authentication required or token expired. Please re-authenticate with Google.' 
          };
        }
      
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-pro:generateContent`;
      
      const payload = {
        contents: [{
          parts: [{
            text: "Hello, this is a test message. Please respond with 'Test successful' if you can read this."
          }]
        }],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0.1
        }
      };

      console.log('Making request to:', url);
      
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${global.oauthTokens.access_token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('Vertex AI test successful:', response.data);
      return { success: true, message: 'Vertex AI connection successful' };
      
    } catch (error) {
      console.error('Vertex AI test failed:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        return { 
          success: false, 
          message: 'OAuth token expired or invalid. Please refresh your authentication.' 
        };
      }
      
      return { 
        success: false, 
        message: `Vertex AI test failed: ${error.response?.data?.error?.message || error.message}` 
      };
    }
  }

  async generateRecommendations(provider, prompt, apiKey, endpoint = null, model = null) {
    try {
      this.createAIClient(provider, apiKey, endpoint, model);
      
      let response;
      
      switch (provider) {
        case 'openai':
          response = await this.openai.chat.completions.create({
            model: model || 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1000,
            temperature: 0.7
          });
          return response.choices[0].message.content;
          
        case 'azure':
          response = await this.azureOpenai.chat.completions.create({
            model: model || 'gpt-35-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1000,
            temperature: 0.7
          });
          return response.choices[0].message.content;
          
        case 'gemini':
          const genAI = this.gemini;
          const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-pro' });
          const result = await geminiModel.generateContent(prompt);
          return result.response.text();
          
        case 'claude':
          response = await this.claude.messages.create({
            model: model || 'claude-3-sonnet-20240229',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }]
          });
          return response.content[0].text;
          
        case 'vertex':
          // Ensure we have valid OAuth tokens with automatic refresh
          const hasValidToken = await global.tokenManager.ensureValidToken();
          
          if (!hasValidToken) {
            throw new Error('OAuth authentication required or token expired. Please re-authenticate with Google.');
          }
          
          const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'ajgc-mep-app-dev-ccd-01';
          const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
          
          const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-pro:generateContent`;
          
          const payload = {
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              maxOutputTokens: 2000,
              temperature: 0.3, // Lower temperature for more consistent JSON responses
              topP: 0.8,
              topK: 40
            }
          };
          
          console.log('🚀 Making Vertex AI request to Gemini...');
          
          const vertexResponse = await axios.post(url, payload, {
            headers: {
              'Authorization': `Bearer ${global.oauthTokens.access_token}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });
          
          console.log('✅ Vertex AI response received successfully');
          
          if (vertexResponse.data.candidates && vertexResponse.data.candidates[0]) {
            const content = vertexResponse.data.candidates[0].content.parts[0].text;
            console.log('📝 Gemini response content:', content);
            return content;
          } else {
            throw new Error('No response content from Vertex AI');
          }
          
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
      throw error;
    }
  }
}

module.exports = AIService;