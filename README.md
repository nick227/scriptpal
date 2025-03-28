# ScriptPal

ScriptPal is an AI-powered script writing assistant that helps users create, edit, and improve their scripts through natural language interaction.

## Features

- Natural language script editing and analysis
- Story element management
- Creative brainstorming assistance
- Context-aware responses
- Interactive follow-up suggestions

## Tech Stack

- Node.js
- Express.js
- LangChain
- OpenAI GPT-4
- MongoDB

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/scriptpal.git
cd scriptpal
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

4. Start the development server:
```bash
npm run dev
```

## Project Structure

```
scriptpal/
├── server/
│   ├── controllers/
│   │   └── langchain/      # LangChain integration
│   │   └── scripts/        # Script-related routes
│   ├── models/            # Database models
│   └── routes/            # API routes
├── client/                # Frontend application
└── package.json
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 