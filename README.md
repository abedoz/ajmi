# Training Center Recommendation Tool

An AI-powered recommendation system designed to help training centers increase sales by analyzing historical data and generating targeted prospect lists with personalized outreach messages.

## 🚀 Features

### Core Functionality
- **4 Recommendation Strategies**: Similar courses, skill progression, popular courses, and skill gap analysis
- **CSV Data Import**: Easy upload of courses, trainees, and enrollment data
- **Interactive Dashboard**: Real-time analytics and data visualization
- **Flexible Filtering**: Course status filtering and customizable recommendation parameters
- **Export Capabilities**: Download prospect lists as CSV files

### AI-Powered Enhancements
- **Enhanced Course Descriptions**: AI-generated compelling course descriptions
- **Personalized Insights**: Customized recommendations for each trainee
- **Automated Outreach**: Generate personalized emails, SMS, and WhatsApp messages
- **Predictive Analytics**: AI-powered insights for sales optimization

### Modern UI/UX
- **Material-UI Design**: Clean, professional interface
- **Responsive Layout**: Works on desktop and mobile devices
- **Real-time Updates**: Live data processing and visualization
- **Intuitive Navigation**: Tab-based interface for easy access

## 📋 Requirements

### System Requirements
- Node.js 16+ 
- npm or yarn
- Modern web browser
- OpenAI API key (for AI features)

### Data Requirements
Your CSV files should contain:

#### Courses Data
- `CourseBasicDataId`: Unique course identifier
- `CustomName`: Course name/title
- `Status`: Course status (1=Created, 2=Opened, 3=Running, 4=Closed, 5=Archived)

#### Trainees Data
- `MemberId`: Unique trainee identifier
- `Name`: Trainee's full name
- `Mobile`: Phone number (optional)
- `Email`: Email address (optional)

#### Enrollments Data
- `MemberId`: Trainee identifier (matches trainees data)
- `CourseId`: Course identifier (matches courses data)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd training-center-recommendations

# Install server dependencies
npm install

# Install client dependencies
cd client && npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your configuration
# Note: OpenAI API key is configured through the web interface
```

### 3. Start the Application

```bash
# Development mode (runs both server and client)
npm run dev

# Or run separately:
# Terminal 1 - Server
npm run server

# Terminal 2 - Client
npm run client
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📊 Usage Guide

### 1. Data Upload
1. Navigate to the **Data Upload** tab
2. Upload your CSV files in the correct format:
   - **Courses**: CourseBasicDataId, CustomName, Status
   - **Trainees**: MemberId, Name, Mobile, Email
   - **Enrollments**: MemberId, CourseId
3. Verify the upload was successful

### 2. Configure AI Settings (Optional)
1. Go to **Settings** tab
2. Enter your OpenAI API key
3. Enable AI features
4. Test the connection

### 3. Generate Recommendations
1. Open the **Recommendations** tab
2. Select recommendation strategy:
   - **Similar Courses**: Find prospects based on enrollment patterns
   - **Skill Progression**: Suggest next steps in learning paths
   - **Popular Courses**: Recommend trending courses
   - **Skill Gaps**: Identify missing competencies
3. Choose course statuses to include
4. Enable AI enhancement if desired
5. Click "Generate Recommendations"

### 4. Create Outreach Messages
1. Copy recommendations from the previous step
2. Go to **Outreach** tab
3. Paste prospect data
4. Select message type (Email, SMS, WhatsApp)
5. Enter target course ID
6. Generate personalized messages

### 5. Export and Use
- Export prospect lists as CSV files
- Copy generated messages for your outreach campaigns
- Monitor performance through the dashboard

## 🎯 Recommendation Strategies Explained

### Similar Courses
Analyzes enrollment patterns to find courses frequently taken together. Recommends prospects who took similar courses but haven't enrolled in the target course.

**Best for**: Cross-selling related courses, expanding enrollment in complementary programs.

### Skill Progression
Identifies logical learning paths and recommends next-step courses based on completed coursework and similar trainee patterns.

**Best for**: Upselling advanced courses, creating learning journeys.

### Popular Courses
Recommends high-enrollment courses to prospects with similar interests or backgrounds.

**Best for**: Promoting successful courses, attracting new trainees.

### Skill Gaps
Identifies missing courses in common learning sequences and recommends prospects who have gaps in their training.

**Best for**: Completing learning paths, improving course completion rates.

## 🤖 AI Features

### Course Descriptions
AI generates compelling, professional descriptions for your courses that highlight key benefits and appeal to potential trainees.

### Personalized Insights
Each recommendation includes a personalized explanation of why the course is relevant to that specific trainee.

### Outreach Messages
Generate three types of personalized messages:
- **Email**: Professional format with subject lines
- **SMS**: Brief, action-oriented messages (160 characters)
- **WhatsApp**: Conversational tone with emojis

### Predictive Analytics
AI analyzes your data to provide actionable insights for improving sales and course recommendations.

## 📁 Project Structure

```
training-center-recommendations/
├── server/                 # Backend Express.js application
│   ├── services/          # Business logic services
│   │   ├── aiService.js   # OpenAI integration
│   │   ├── dataProcessor.js # Data processing utilities
│   │   └── recommendationEngine.js # Recommendation algorithms
│   └── index.js           # Main server file
├── client/                # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── Dashboard.js
│   │   │   ├── DataUpload.js
│   │   │   ├── RecommendationEngine.js
│   │   │   ├── OutreachGenerator.js
│   │   │   └── Settings.js
│   │   ├── App.js         # Main app component
│   │   └── index.js       # React entry point
│   └── public/            # Static assets
├── uploads/               # Temporary file uploads (auto-created)
├── package.json           # Server dependencies
└── README.md             # This file
```

## 🔧 API Endpoints

### Data Management
- `POST /api/upload/courses` - Upload courses CSV
- `POST /api/upload/trainees` - Upload trainees CSV  
- `POST /api/upload/enrollments` - Upload enrollments CSV
- `GET /api/data/summary` - Get data summary

### Recommendations
- `POST /api/recommendations` - Generate recommendations
- `POST /api/export/prospects` - Export prospects as CSV

### AI Features
- `POST /api/test-openai` - Test OpenAI API key
- `POST /api/outreach/generate` - Generate outreach messages
- `POST /api/analytics/insights` - Generate AI insights

## 🔐 Security & Privacy

- **Local Storage**: OpenAI API keys are stored locally in your browser
- **No Data Transmission**: Your API key is never sent to our servers
- **Secure Processing**: All data processing happens on your infrastructure
- **HTTPS Ready**: Production deployment supports SSL/TLS

## 💰 Cost Considerations

AI features use the OpenAI API, which incurs costs based on usage:

- **Course Descriptions**: ~$0.002 per course
- **Personalized Insights**: ~$0.001 per recommendation  
- **Outreach Messages**: ~$0.003 per message
- **Analytics Insights**: ~$0.01 per analysis

**Cost Optimization Tips**:
- Limit AI enhancement to high-priority prospects
- Test with small batches first
- Monitor usage in OpenAI dashboard
- Use AI features selectively

## 🚀 Production Deployment

### Build for Production
```bash
# Build the React client
cd client && npm run build

# The built files will be in client/build/
# The Express server serves these files automatically
```

### Environment Variables
```bash
# .env file for production
OPENAI_API_KEY=your_key_here  # Optional: can be set via UI
PORT=5000
NODE_ENV=production
```

### Deployment Options
- **Self-hosted**: Deploy on your own servers
- **Cloud Platforms**: Heroku, AWS, DigitalOcean, etc.
- **Docker**: Container-ready application

## 🤝 Support & Contributing

### Getting Help
1. Check the troubleshooting section below
2. Review the API documentation
3. Open an issue with detailed information

### Troubleshooting

**Common Issues**:

1. **CSV Upload Fails**
   - Check file format and column headers
   - Ensure UTF-8 encoding
   - Remove empty rows/columns

2. **AI Features Not Working**
   - Verify OpenAI API key in Settings
   - Check API key permissions and quota
   - Test connection using the built-in test

3. **No Recommendations Generated**
   - Ensure all three data files are uploaded
   - Check course status filters
   - Verify data relationships (matching IDs)

4. **Performance Issues**
   - Limit recommendation batch sizes
   - Use pagination for large datasets
   - Consider upgrading server resources

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔄 Version History

- **v1.0.0**: Initial release with core recommendation features
- **v1.1.0**: Added AI integration and outreach generation
- **v1.2.0**: Enhanced UI/UX and analytics dashboard

---

**Built with ❤️ for training centers worldwide**