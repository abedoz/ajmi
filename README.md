# Training Center Management System

A comprehensive web application for managing training courses, trainees, and enrollments with AI-powered insights and recommendations.

## Features

- **Single File Upload**: Upload one Excel file with three sheets (Courses, Trainees, Enrollments)
- **Data Processing**: Automatic processing of Excel (.xlsx, .xls) and CSV files
- **Dashboard Analytics**: Real-time statistics and insights
- **AI Integration**: Multiple AI providers support (OpenAI, Azure OpenAI, Google Gemini, Claude, Vertex AI)
- **Recommendation Engine**: AI-powered course recommendations for trainees
- **Outreach Generation**: Automated outreach message creation
- **Export Functionality**: Export data to CSV format

## File Upload Format

The system expects a single Excel file with three sheets:

### 1. Courses Sheet
- **CourseBasicDatald**: Unique course identifier
- **CustomName**: Course name/title
- **Status**: Course status (1=Created, 2=Opened, 3=Running, 4=Closed, 5=Archived)

### 2. Trainees Sheet
- **Memberld**: Unique trainee identifier
- **Name**: Trainee's full name
- **Email**: Email address
- **Phone**: Phone number

### 3. Enrollments Sheet
- **Memberld**: Trainee identifier (must match Trainees sheet)
- **Courseld**: Course identifier (must match Courses sheet)

## Quick Start

1. **Download Template**: Use the "Download Excel Template" button in the Data Upload section
2. **Fill Your Data**: Populate the template with your training data
3. **Upload File**: Upload the completed Excel file
4. **View Dashboard**: See your data visualized in the dashboard
5. **Generate Insights**: Use AI-powered analysis and recommendations

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd training-center-system
   ```

2. Install dependencies:
   ```bash
   npm install
   cd client && npm install
   cd ..
   ```

3. Create a `.env` file in the root directory:
   ```env
   # AI Provider Configuration
   OPENAI_API_KEY=your_openai_api_key
   AZURE_OPENAI_API_KEY=your_azure_api_key
   AZURE_OPENAI_ENDPOINT=your_azure_endpoint
   GOOGLE_API_KEY=your_gemini_api_key
   ANTHROPIC_API_KEY=your_claude_api_key
   
   # Google Cloud Vertex AI (Optional)
   GOOGLE_CLOUD_PROJECT=your_project_id
   GOOGLE_CLOUD_LOCATION=us-central1
   GOOGLE_GENAI_USE_VERTEXAI=True
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## AI Providers

### OpenAI
- Models: GPT-3.5-turbo, GPT-4
- Configuration: API key only

### Azure OpenAI
- Models: Custom endpoint models
- Configuration: API key + endpoint URL

### Google Gemini (AI Studio)
- Models: gemini-pro, gemini-1.5-pro
- Configuration: API key only

### Anthropic Claude
- Models: claude-3-sonnet-20240229
- Configuration: API key only

### Google Cloud Vertex AI
- Models: gemini-2.0-flash, text-bison, chat-bison
- Configuration: Project ID + location + API key
- Requires Google Cloud authentication setup

## Usage

### Data Upload
1. Navigate to the Data Upload section
2. Download the Excel template to understand the format
3. Fill in your data following the template structure
4. Upload the completed file
5. Verify the upload summary

### Dashboard
- View overall statistics and data quality
- Monitor course status distribution
- Track enrollment trends
- Identify top-performing courses

### AI Features
- Generate course recommendations
- Create personalized outreach messages
- Analyze training patterns
- Get insights on trainee behavior

## API Endpoints

- `POST /api/upload` - Upload training data file
- `GET /api/data` - Retrieve processed data
- `GET /api/template` - Download Excel template
- `POST /api/test-ai-key` - Test AI provider configuration
- `POST /api/generate-recommendations` - Generate AI recommendations
- `POST /api/generate-outreach` - Create outreach messages

## Development

### Project Structure
```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   └── App.js         # Main application
├── server/                 # Node.js backend
│   ├── services/          # Business logic services
│   └── index.js           # Express server
├── uploads/               # Temporary file storage
└── package.json           # Dependencies and scripts
```

### Available Scripts
- `npm run dev` - Start development server (both frontend and backend)
- `npm run server` - Start backend server only
- `npm run client` - Start frontend development server only
- `npm run build` - Build production frontend

## Troubleshooting

### Common Issues

1. **Port Conflicts**: If ports 3000 or 5000 are in use, the system will automatically find available ports
2. **File Upload Errors**: Ensure your Excel file has the correct sheet names and column headers
3. **AI API Errors**: Verify your API keys and provider configuration in Settings
4. **Data Not Loading**: Check that your file was uploaded successfully and contains valid data

### Vertex AI Setup
1. Enable Vertex AI API in Google Cloud Console
2. Set up authentication: `gcloud auth application-default login`
3. Set project: `gcloud config set project YOUR_PROJECT_ID`
4. Configure environment variables in `.env` file

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.