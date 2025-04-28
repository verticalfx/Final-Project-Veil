# API Route Analyzer

This tool analyzes your backend routes and Socket.IO events to generate comprehensive documentation of your API's expected responses, both for success and error cases.

## Purpose

The main purpose of this tool is to:

1. Automatically document all API endpoints and their expected responses
2. Capture both RESTful routes and Socket.IO events
3. Generate documentation that can be used to inform AI models about your API behavior
4. Provide a clear reference for developers working with your API

## Features

- Analyzes Express routes in your `routes/` directory
- Extracts Socket.IO events from `server.js`
- Documents request parameters (path, query, body)
- Documents success and error responses
- Generates both JSON and Markdown documentation

## Usage

Simply run the script from your project root:

```bash
node route-analyzer.js
```

This will generate two files:
- `api-documentation.json` - Machine-readable JSON documentation
- `api-documentation.md` - Human-readable Markdown documentation

## Output Format

### JSON Documentation

The JSON documentation has the following structure:

```json
{
  "version": "1.0",
  "generatedAt": "2023-05-01T12:00:00.000Z",
  "endpoints": [
    {
      "path": "/auth/login",
      "method": "POST",
      "category": "auth",
      "parameters": {
        "path": [],
        "query": [],
        "body": ["username", "password"]
      },
      "responses": {
        "success": [
          {
            "statusCode": "200",
            "body": "{ message: 'Login successful', token: token }"
          }
        ],
        "error": [
          {
            "statusCode": "401",
            "body": "{ error: 'Invalid credentials' }"
          }
        ]
      }
    }
  ],
  "socketEvents": [
    {
      "name": "sendMessage",
      "type": "incoming",
      "parameters": ["message", "recipientId"],
      "emits": [
        {
          "target": "sender",
          "event": "messageSent"
        },
        {
          "target": "others",
          "event": "newMessage"
        }
      ]
    }
  ]
}
```

### Markdown Documentation

The Markdown documentation is organized by categories and includes:

- Table of Contents
- RESTful Endpoints (grouped by category)
- Socket.IO Events (incoming and outgoing)

For each endpoint/event, it documents:
- Parameters
- Success responses
- Error responses
- Emitted events (for Socket.IO)

## Limitations

- The tool uses regex pattern matching to extract information, so it may not capture all edge cases
- Complex response structures might not be fully documented
- Conditional responses might not be accurately represented
- The tool doesn't analyze middleware that might affect responses

## Using with AI Models

The generated documentation is particularly useful for informing AI models about your API behavior. You can:

1. Include the JSON documentation in your AI model's context
2. Reference the Markdown documentation when explaining your API to AI
3. Use the documentation to validate AI-generated code that interacts with your API

## Customization

You can modify the script to:
- Add support for additional response formats
- Extract more detailed parameter information
- Document authentication requirements
- Add custom sections to the documentation 