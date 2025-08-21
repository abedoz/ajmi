# Quick Setup Guide

## Prerequisites
- Node.js 16 or higher
- npm or yarn package manager
- OpenAI API key (for AI features)

## Installation Steps

### 1. Install Dependencies
```bash
# Install server dependencies
npm install

# Install client dependencies  
cd client && npm install && cd ..
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env if needed (optional - API key can be set via UI)
```

### 3. Start Development Server
```bash
# Run both server and client
npm run dev
```

Access the application at: http://localhost:3000

## Data Format Examples

### courses.csv
```csv
CourseBasicDataId,CustomName,Status
COURSE001,Introduction to Python,2
COURSE002,Advanced JavaScript,3
COURSE003,Data Science Basics,2
```

### trainees.csv
```csv
MemberId,Name,Mobile,Email
MEMBER001,John Doe,+1234567890,john@example.com
MEMBER002,Jane Smith,+1234567891,jane@example.com
```

### enrollments.csv
```csv
MemberId,CourseId
MEMBER001,COURSE001
MEMBER002,COURSE001
MEMBER001,COURSE002
```

## Course Status Values
- 1: Created
- 2: Opened  
- 3: Running
- 4: Closed
- 5: Archived

## Quick Start Workflow
1. Upload your CSV files in Data Upload tab
2. Configure OpenAI API key in Settings (optional)
3. Generate recommendations in Recommendations tab
4. Create outreach messages in Outreach tab
5. Export results as CSV

That's it! You're ready to start generating recommendations.