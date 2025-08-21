const OpenAI = require('openai');

class AIService {
  
  // Enhance recommendations with AI-generated insights
  async enhanceRecommendations(recommendations, courses, apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const openai = new OpenAI({ apiKey });

    try {
      // Group recommendations by course for efficiency
      const courseGroups = recommendations.reduce((acc, rec) => {
        if (!acc[rec.recommendedCourseId]) {
          acc[rec.recommendedCourseId] = [];
        }
        acc[rec.recommendedCourseId].push(rec);
        return acc;
      }, {});

      const enhancedRecommendations = [];

      for (const courseId of Object.keys(courseGroups)) {
        const course = courses.find(c => c.CourseBasicDataId === courseId);
        if (!course) continue;

        const courseRecommendations = courseGroups[courseId];
        
        // Generate AI-enhanced description for the course
        const aiDescription = await this.generateCourseDescription(course, openai);
        
        // Generate personalized insights
        for (const rec of courseRecommendations.slice(0, 10)) { // Limit to avoid API costs
          const personalizedInsight = await this.generatePersonalizedInsight(rec, course, openai);
          
          enhancedRecommendations.push({
            ...rec,
            aiDescription,
            personalizedInsight,
            enhanced: true
          });
        }

        // Add remaining recommendations without AI enhancement
        enhancedRecommendations.push(...courseRecommendations.slice(10).map(rec => ({
          ...rec,
          aiDescription,
          enhanced: false
        })));
      }

      return enhancedRecommendations;

    } catch (error) {
      console.error('AI enhancement error:', error);
      // Return original recommendations if AI fails
      return recommendations.map(rec => ({ ...rec, enhanced: false }));
    }
  }

  // Generate AI-powered course description
  async generateCourseDescription(course, openai) {
    try {
      const prompt = `Create a compelling, professional course description for "${course.CustomName}". 
      The description should be 2-3 sentences, highlight key benefits, and appeal to potential trainees. 
      Make it engaging and focused on practical outcomes.`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.7
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating course description:', error);
      return `${course.CustomName} - A comprehensive training program designed to enhance your professional skills.`;
    }
  }

  // Generate personalized insight for a recommendation
  async generatePersonalizedInsight(recommendation, course, openai) {
    try {
      const prompt = `Generate a brief, personalized insight for why ${recommendation.Name} should consider taking "${course.CustomName}". 
      Context: ${recommendation.reason}
      Keep it under 50 words and make it compelling and specific.`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 80,
        temperature: 0.8
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating personalized insight:', error);
      return `This course aligns well with ${recommendation.Name}'s learning path and interests.`;
    }
  }

  // Generate outreach messages
  async generateOutreachMessages(prospects, course, messageType, apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const openai = new OpenAI({ apiKey });
    const messages = [];

    try {
      for (const prospect of prospects.slice(0, 20)) { // Limit to control costs
        let prompt = '';
        
        switch (messageType) {
          case 'email':
            prompt = `Write a professional email to ${prospect.Name} recommending the course "${course.CustomName}". 
            Context: ${prospect.reason}
            Keep it concise, friendly, and include a clear call-to-action. 
            Subject line should be compelling.`;
            break;
          
          case 'sms':
            prompt = `Write a brief SMS message (under 160 characters) to ${prospect.Name} about the course "${course.CustomName}". 
            Context: ${prospect.reason}
            Make it friendly and include a call-to-action.`;
            break;
          
          case 'whatsapp':
            prompt = `Write a WhatsApp message to ${prospect.Name} recommending "${course.CustomName}". 
            Context: ${prospect.reason}
            Keep it conversational, friendly, and under 200 words. Use appropriate emojis.`;
            break;
          
          default:
            prompt = `Write a personalized message to ${prospect.Name} about "${course.CustomName}". 
            Context: ${prospect.reason}
            Keep it professional and engaging.`;
        }

        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          max_tokens: messageType === 'sms' ? 50 : 200,
          temperature: 0.7
        });

        messages.push({
          prospect: prospect,
          messageType: messageType,
          content: response.choices[0].message.content.trim(),
          generated: true
        });

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return messages;

    } catch (error) {
      console.error('Error generating outreach messages:', error);
      
      // Return fallback messages
      return prospects.slice(0, 20).map(prospect => ({
        prospect: prospect,
        messageType: messageType,
        content: this.generateFallbackMessage(prospect, course, messageType),
        generated: false
      }));
    }
  }

  // Fallback message generation (non-AI)
  generateFallbackMessage(prospect, course, messageType) {
    switch (messageType) {
      case 'email':
        return `Subject: New Course Recommendation - ${course.CustomName}

Hi ${prospect.Name},

I hope this email finds you well. Based on your learning profile, I'd like to recommend our course "${course.CustomName}" which I believe would be a great fit for your professional development.

${prospect.reason}

Would you be interested in learning more about this opportunity? Please let me know if you'd like additional details or have any questions.

Best regards,
Training Center Team`;

      case 'sms':
        return `Hi ${prospect.Name}! We recommend "${course.CustomName}" for you. ${prospect.reason.slice(0, 50)}... Interested? Reply YES for details.`;

      case 'whatsapp':
        return `Hi ${prospect.Name}! 👋

Hope you're doing well! I wanted to reach out about our course "${course.CustomName}" which I think would be perfect for you.

${prospect.reason}

Would you like to know more about it? Let me know if you're interested! 😊`;

      default:
        return `Hi ${prospect.Name}, we recommend "${course.CustomName}" for you. ${prospect.reason} Let us know if you're interested!`;
    }
  }

  // Generate predictive analytics insights
  async generateAnalyticsInsights(data, apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const openai = new OpenAI({ apiKey });

    try {
      const prompt = `Analyze this training center data and provide 3-5 key insights for improving sales and course recommendations:
      
      Total Courses: ${data.courses.total}
      Course Status Distribution: ${JSON.stringify(data.courses.byStatus)}
      Total Trainees: ${data.trainees.total}
      Total Enrollments: ${data.enrollments.total}
      
      Focus on actionable insights for increasing enrollment and revenue.`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.6
      });

      return response.choices[0].message.content.trim();

    } catch (error) {
      console.error('Error generating analytics insights:', error);
      return "Unable to generate AI insights at this time. Please check your API key and try again.";
    }
  }

  // Test API key validity
  async testApiKey(apiKey) {
    if (!apiKey) {
      return { success: false, error: 'API key is required' };
    }

    const openai = new OpenAI({ apiKey });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 5
      });

      return { success: true };
    } catch (error) {
      console.error('API key test failed:', error);
      if (error.status === 401) {
        return { success: false, error: 'Invalid API key' };
      } else if (error.status === 429) {
        return { success: false, error: 'Rate limit exceeded or quota exceeded' };
      } else {
        return { success: false, error: 'API connection failed' };
      }
    }
  }
}

module.exports = new AIService();