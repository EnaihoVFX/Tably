# Smart Tab Organizer with AI // {Tably}

A Chrome extension that uses AI to automatically organize tabs, save browsing sessions, and provide intelligent assistance for daily browsing workflows.

## Problem Being Solved

- **Tab Clutter**: Users often have dozens of open tabs, making it difficult to find relevant content
- **Context Switching**: Difficulty maintaining focus when switching between different projects or tasks
- **Session Loss**: Important browsing sessions are lost when closing the browser
- **Inefficient Organization**: Manual tab organization is time-consuming and often forgotten

## Solution
<img width="1407" height="496" alt="Screenshot 2025-10-30 at 14 50 23" src="https://github.com/user-attachments/assets/3d115139-4cba-4e97-94f8-35ce86064701" />

Smart Tab Organizer uses Chrome's built-in AI models (Gemini Nano) to automatically:
- Categorize tabs based on content analysis
- Generate intelligent group names and descriptions
- Save and restore complete browsing sessions
- Provide context-aware organization

## APIs Used

This extension leverages Chrome's built-in AI APIs:

1. **Prompt API for Web** - Intelligent tab categorization and content analysis
2. **Summarizer API** - Creating concise group descriptions and session summaries
3. **Writer API** - Generating smart group names and contextual descriptions
4. **Rewriter API** - Optimizing tab titles and improving readability
5. **Translator API** - Handling multilingual content and international websites
6. **Proofreader API** - Ensuring accuracy in AI-generated content

## Features

### Core Functionality
- **AI-Powered Tab Grouping**: Automatically categorizes tabs using content analysis
- **Smart Naming**: Generates intelligent group names using AI
- **Session Saving**: Save and restore complete browsing sessions
- **Color Coding**: Automatic color assignment based on content type
- **Context Awareness**: Adapts to different work contexts and times

### AI-Enhanced Features
- **Intelligent Summaries**: AI-generated summaries of tab groups
- **Smart Descriptions**: Contextual descriptions for saved sessions
- **Content Analysis**: Deep understanding of page content for better grouping
- **Multilingual Support**: Handles content in multiple languages
- **Adaptive Learning**: Improves over time based on user behavior

### Advanced Features
- **Auto-Save**: Automatically saves important sessions
- **Session Management**: Organize and manage multiple saved sessions
- **Visual Indicators**: Subtle visual feedback for organized tabs
- **Performance Optimization**: Efficient tab analysis and organization
- **Privacy-Focused**: All AI processing happens locally in the browser

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory
5. The extension will be installed and ready to use

## Usage

1. **Automatic Organization**: The extension automatically organizes tabs as you browse
2. **Manual Organization**: Click the extension icon and use "Organize Tabs with AI"
3. **Save Sessions**: Enter a session name and description, then click "Save Current Session"
4. **Load Sessions**: Click on any saved session to restore it
5. **Settings**: Configure auto-save and auto-organize preferences

## Technical Architecture

### Files Structure
```
smart-tab-organizer/
├── manifest.json          # Extension manifest
├── background.js          # Service worker with AI integration
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── content.js             # Content script for page analysis
├── ai-apis.js            # AI API integration layer
└── icons/                # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### AI Integration
- **Local Processing**: All AI analysis happens in the browser
- **API Abstraction**: Clean interface to Chrome's AI APIs
- **Fallback Handling**: Graceful degradation when AI APIs are unavailable
- **Performance Optimization**: Efficient processing and caching

### Data Management
- **Local Storage**: Sessions stored locally in browser
- **Privacy-Focused**: No data sent to external servers
- **Efficient Storage**: Optimized data structures and compression
- **Cleanup**: Automatic cleanup of old or unused data

## Development

### Prerequisites
- Chrome browser with AI APIs enabled
- Basic knowledge of JavaScript and Chrome extension development

### Building
1. Ensure all files are in the correct directory structure
2. Load the extension in Chrome developer mode
3. Test functionality with various websites and tab configurations

### Testing
- Test with different types of websites (work, social, shopping, etc.)
- Verify AI categorization accuracy
- Test session save/load functionality
- Ensure performance with large numbers of tabs

## Privacy & Security

- **Local Processing**: All AI analysis happens locally in your browser
- **No External Data**: No personal data sent to external servers
- **User Control**: Full control over what gets organized and saved
- **Transparent Operation**: Clear indication of what the extension is doing
- **Secure Storage**: Local storage with appropriate security measures

## Future Enhancements

- **Cross-Device Sync**: Optional cloud sync for sessions
- **Team Collaboration**: Share sessions with team members
- **Advanced Analytics**: Insights into browsing patterns and productivity
- **Custom Rules**: User-defined organization rules and preferences
- **Integration**: Integration with productivity tools and calendars

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Screenshots

<img width="420" height="597" alt="Screenshot 2025-10-30 at 14 54 12" src="https://github.com/user-attachments/assets/203253aa-3ca5-40bd-bd60-a8e3573cf617" />

<img width="1915" height="1191" alt="Screenshot 2025-10-30 at 14 51 56" src="https://github.com/user-attachments/assets/8691ae86-4938-41cc-8043-464180eef39c" />

<img width="421" height="600" alt="Screenshot 2025-10-30 at 14 54 34" src="https://github.com/user-attachments/assets/6db2ee3e-53bb-4eda-960a-8b17600e6dc2" />

<img width="423" height="599" alt="Screenshot 2025-10-30 at 14 53 08" src="https://github.com/user-attachments/assets/a51c0628-72c6-4e5c-a9e0-10997165913b" />

<img width="422" height="599" alt="Screenshot 2025-10-30 at 14 53 36" src="https://github.com/user-attachments/assets/ab117bcc-89ae-42c0-b298-65e84e946a90" />

<img width="421" height="599" alt="Screenshot 2025-10-30 at 14 53 55" src="https://github.com/user-attachments/assets/79d3cf29-1546-4d04-8634-60cfe9025bde" />


## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues, questions, or contributions, please open an issue on the GitHub repository.

---

Easter Egg

<img width="414" height="563" alt="Screenshot 2025-10-30 at 14 52 19" src="https://github.com/user-attachments/assets/7dd52503-a1c6-49e5-8f44-74dde9eefd31" />

**Note**: This extension requires Chrome with AI APIs enabled. Ensure your Chrome browser supports the required AI functionality before installation.







# Tably
