# Smart Document Q&A Frontend

A modern, responsive web interface for chatting with your documents using AI.

## Features

- 📁 **File Upload**: Upload PDF, DOCX, TXT, and MD files
- 🗂️ **Dataset Management**: Organize documents into datasets
- 💬 **Real-time Chat**: Stream responses from AI
- 🎨 **Modern UI**: Clean, responsive design
- ⚡ **Fast**: Optimized for performance

## Getting Started

### Prerequisites

- Node.js 16+ 
- Backend server running on `http://localhost:8000`

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

## Usage

### Uploading Documents

1. Select a dataset from the dropdown (default: "demo")
2. Click "Choose File" to select your document
3. Wait for the upload to complete
4. Start chatting with your document!

### Supported File Types

- **PDF** (.pdf) - Research papers, reports, manuals
- **DOCX** (.docx) - Word documents
- **TXT** (.txt) - Plain text files
- **MD** (.md) - Markdown files

### Chat Interface

- Type your questions in the input box
- Press Enter to send (Shift+Enter for new line)
- Responses stream in real-time
- View conversation history with timestamps

## Architecture

- **React 18** with TypeScript
- **Vite** for fast development
- **Axios** for API communication
- **Streaming responses** for real-time chat
- **Responsive design** for all devices

## API Endpoints

The frontend communicates with these backend endpoints:

- `POST /ingest/file` - Upload documents
- `POST /query` - Ask questions (with streaming)
- `GET /health` - Health check

## Customization

### Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8000
```

### Styling

The app uses modern CSS with:
- CSS Grid and Flexbox for layout
- CSS Variables for theming
- Smooth animations and transitions
- Mobile-first responsive design

## Troubleshooting

### Common Issues

1. **Upload fails**: Check your backend is running and API keys are configured
2. **Chat not working**: Verify OpenAI API key and quota
3. **Slow responses**: Check your internet connection and OpenAI service status

### Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
