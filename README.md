# ONDC-FAQs with Feedback System

A comprehensive FAQ system for ONDC (Open Network for Digital Commerce) with integrated user feedback functionality.

ONDC FAQs repository for rendering official FAQs from ONDC with a feedback collection system that saves user responses to an Excel file.

## Features

- Comprehensive FAQ system with search and filtering
- Like/Dislike feedback buttons for each FAQ
- Comment functionality for detailed feedback
- Real-time feedback statistics
- Automatic Excel file generation for feedback data
- ONDC-specific tags and terminology

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ONDC-FAQs
```

2. Install dependencies:
```bash
npm install
```

### Running the Application

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. The server will automatically:
   - Create a `data/feedback.xlsx` file if it doesn't exist
   - Save all user feedback to this Excel file
   - Display feedback statistics in real-time

### Accessing Feedback Data

- All feedback is automatically saved to: `data/feedback.xlsx`
- The Excel file contains:
  - Timestamp
  - Question text
  - Feedback type (like/dislike/comment)
  - User comments
  - Category
  - User agent
  - IP address

### Development Mode

For development with auto-restart:
```bash
npm run dev
```

## How Feedback Works

1. **Like/Dislike**: Users can click thumbs up/down on any FAQ
2. **Comments**: Users can add detailed feedback via the comment button
3. **Storage**: All feedback is immediately saved to the Excel file on the server
4. **Statistics**: View feedback stats by clicking the "Feedback" button in the header

## File Structure

```
ONDC-FAQs/
├── data/
│   ├── domains/         # YAML files with FAQ content
│   └── feedback.xlsx    # Auto-generated feedback file
├── js/
│   ├── feedback-component.js  # Feedback UI component
│   ├── faq-manager.js        # FAQ data management
│   ├── search-engine.js      # Search functionality
│   └── ui-controller.js      # UI control logic
├── server.js            # Express server for API
├── index.html          # Main application page
└── package.json        # Dependencies and scripts
```

## Notes

- The feedback Excel file is created automatically when the server starts
- Feedback is saved in real-time as users interact with the system
- The server must be running for feedback collection to work
- All feedback data persists across server restarts