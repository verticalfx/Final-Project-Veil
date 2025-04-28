/**
 * route-analyzer.js
 * 
 * This script analyzes the backend routes and documents the expected responses
 * for both success and error cases. This documentation can be used to inform
 * AI models about the API behavior.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ROUTES_DIR = path.join(__dirname, 'routes');
const SERVER_FILE = path.join(__dirname, 'server.js');
const OUTPUT_FILE = path.join(__dirname, 'api-documentation.json');

// Main function to analyze routes
async function analyzeRoutes() {
  console.log('Analyzing backend routes...');
  
  const routeFiles = fs.readdirSync(ROUTES_DIR).filter(file => file.endsWith('.js'));
  const apiDocs = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    endpoints: [],
    socketEvents: []
  };
  
  // Process RESTful routes
  for (const file of routeFiles) {
    console.log(`Processing ${file}...`);
    const filePath = path.join(ROUTES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract route category from filename (e.g., 'auth' from 'auth.js')
    const category = path.basename(file, '.js');
    
    // Find all route definitions
    const routeRegex = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const route = match[2];
      const fullRoute = `/${category}${route === '/' ? '' : route}`;
      
      // Find the route handler function
      const handlerStart = content.indexOf(match[0]);
      const handlerEnd = findHandlerEnd(content, handlerStart);
      const handlerCode = content.substring(handlerStart, handlerEnd);
      
      // Extract response patterns
      const responses = extractResponses(handlerCode);
      
      // Extract request parameters
      const parameters = extractParameters(handlerCode);
      
      // Add to API docs
      apiDocs.endpoints.push({
        path: fullRoute,
        method,
        category,
        parameters,
        responses
      });
    }
  }
  
  // Process Socket.IO events
  console.log('Processing Socket.IO events from server.js...');
  const serverContent = fs.readFileSync(SERVER_FILE, 'utf8');
  
  // Extract Socket.IO event handlers
  apiDocs.socketEvents = extractSocketEvents(serverContent);
  
  // Write documentation to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(apiDocs, null, 2));
  console.log(`API documentation written to ${OUTPUT_FILE}`);
  
  // Also generate a markdown version for human readability
  generateMarkdownDocs(apiDocs);
  
  return apiDocs;
}

// Helper function to find the end of a route handler function
function findHandlerEnd(content, start) {
  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  let i = start;
  
  // Find the opening brace of the handler function
  while (i < content.length) {
    if (content[i] === '{' && !inString) {
      braceCount = 1;
      i++;
      break;
    }
    
    // Handle strings to avoid counting braces inside strings
    if ((content[i] === '"' || content[i] === "'") && (i === 0 || content[i-1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = content[i];
      } else if (content[i] === stringChar) {
        inString = false;
      }
    }
    
    i++;
  }
  
  // Now count braces until we find the matching closing brace
  while (i < content.length && braceCount > 0) {
    if (!inString) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
    }
    
    // Handle strings
    if ((content[i] === '"' || content[i] === "'") && (i === 0 || content[i-1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = content[i];
      } else if (content[i] === stringChar) {
        inString = false;
      }
    }
    
    i++;
    
    if (braceCount === 0) break;
  }
  
  return i;
}

// Extract Socket.IO events from server.js
function extractSocketEvents(content) {
  const events = [];
  
  // Find socket.on event handlers
  const socketOnRegex = /socket\.on\(['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = socketOnRegex.exec(content)) !== null) {
    const eventName = match[1];
    const handlerStart = content.indexOf(match[0]);
    const handlerEnd = findHandlerEnd(content, handlerStart);
    const handlerCode = content.substring(handlerStart, handlerEnd);
    
    // Extract parameters from the handler function
    const paramRegex = /socket\.on\(['"][^'"]+['"],\s*(?:async\s*)?\(?([^)]*)\)?\s*=>/;
    const paramMatch = handlerCode.match(paramRegex);
    const parameters = paramMatch ? 
      paramMatch[1].split(',').map(p => p.trim()).filter(p => p && p !== 'socket') : 
      [];
    
    // Extract emitted events (responses)
    const emittedEvents = extractEmittedEvents(handlerCode);
    
    events.push({
      name: eventName,
      type: 'incoming',
      parameters,
      emits: emittedEvents
    });
  }
  
  // Find io.on and io.emit events
  const ioEmitRegex = /io\.emit\(['"]([^'"]+)['"]/g;
  while ((match = ioEmitRegex.exec(content)) !== null) {
    const eventName = match[1];
    
    // Check if this event is already in our list as an incoming event
    if (!events.some(e => e.name === eventName)) {
      events.push({
        name: eventName,
        type: 'outgoing',
        parameters: [],
        emits: []
      });
    }
  }
  
  return events;
}

// Extract emitted events from a Socket.IO handler
function extractEmittedEvents(code) {
  const emittedEvents = [];
  
  // socket.emit
  const socketEmitRegex = /socket\.emit\(['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = socketEmitRegex.exec(code)) !== null) {
    const eventName = match[1];
    if (!emittedEvents.some(e => e.target === 'sender' && e.event === eventName)) {
      emittedEvents.push({
        target: 'sender',
        event: eventName
      });
    }
  }
  
  // socket.broadcast.emit
  const broadcastEmitRegex = /socket\.broadcast\.emit\(['"]([^'"]+)['"]/g;
  while ((match = broadcastEmitRegex.exec(code)) !== null) {
    const eventName = match[1];
    if (!emittedEvents.some(e => e.target === 'others' && e.event === eventName)) {
      emittedEvents.push({
        target: 'others',
        event: eventName
      });
    }
  }
  
  // io.emit
  const ioEmitRegex = /io\.emit\(['"]([^'"]+)['"]/g;
  while ((match = ioEmitRegex.exec(code)) !== null) {
    const eventName = match[1];
    if (!emittedEvents.some(e => e.target === 'all' && e.event === eventName)) {
      emittedEvents.push({
        target: 'all',
        event: eventName
      });
    }
  }
  
  return emittedEvents;
}

// Extract response patterns from route handler code
function extractResponses(code) {
  const responses = {
    success: [],
    error: []
  };
  
  // Match success responses (2xx status codes or res.json without explicit status)
  const successRegex = /res\.(?:status\((2\d\d)\)\.)?json\(\s*({[^}]+}|\[[^\]]+\]|[^)]+)\s*\)/g;
  let successMatch;
  
  while ((successMatch = successRegex.exec(code)) !== null) {
    const statusCode = successMatch[1] || '200';
    let responseBody = successMatch[2];
    
    // Clean up the response body
    responseBody = responseBody.replace(/\s+/g, ' ').trim();
    
    // Add to success responses if not already included
    if (!responses.success.some(r => r.statusCode === statusCode && r.body === responseBody)) {
      responses.success.push({
        statusCode,
        body: responseBody
      });
    }
  }
  
  // Match error responses (4xx and 5xx status codes)
  const errorRegex = /res\.status\((4\d\d|5\d\d)\)\.json\(\s*({[^}]+}|[^)]+)\s*\)/g;
  let errorMatch;
  
  while ((errorMatch = errorRegex.exec(code)) !== null) {
    const statusCode = errorMatch[1];
    let responseBody = errorMatch[2];
    
    // Clean up the response body
    responseBody = responseBody.replace(/\s+/g, ' ').trim();
    
    // Add to error responses if not already included
    if (!responses.error.some(r => r.statusCode === statusCode && r.body === responseBody)) {
      responses.error.push({
        statusCode,
        body: responseBody
      });
    }
  }
  
  return responses;
}

// Extract request parameters from route handler code
function extractParameters(code) {
  const parameters = {
    path: [],
    query: [],
    body: []
  };
  
  // Extract path parameters
  const pathParamRegex = /req\.params\.(\w+)/g;
  let pathMatch;
  
  while ((pathMatch = pathParamRegex.exec(code)) !== null) {
    const param = pathMatch[1];
    if (!parameters.path.includes(param)) {
      parameters.path.push(param);
    }
  }
  
  // Extract query parameters
  const queryParamRegex = /req\.query\.(\w+)/g;
  let queryMatch;
  
  while ((queryMatch = queryParamRegex.exec(code)) !== null) {
    const param = queryMatch[1];
    if (!parameters.query.includes(param)) {
      parameters.query.push(param);
    }
  }
  
  // Extract body parameters
  const bodyParamRegex = /(?:const|let|var)\s*{\s*([^}]+)\s*}\s*=\s*req\.body/g;
  let bodyMatch;
  
  while ((bodyMatch = bodyParamRegex.exec(code)) !== null) {
    const paramList = bodyMatch[1].split(',').map(p => p.trim());
    
    for (const param of paramList) {
      // Handle destructuring with renaming (e.g., originalName: newName)
      const paramName = param.split(':')[0].trim();
      if (paramName && !parameters.body.includes(paramName)) {
        parameters.body.push(paramName);
      }
    }
  }
  
  // Also catch direct body parameter access
  const directBodyRegex = /req\.body\.(\w+)/g;
  let directBodyMatch;
  
  while ((directBodyMatch = directBodyRegex.exec(code)) !== null) {
    const param = directBodyMatch[1];
    if (!parameters.body.includes(param)) {
      parameters.body.push(param);
    }
  }
  
  return parameters;
}

// Generate markdown documentation for human readability
function generateMarkdownDocs(apiDocs) {
  let markdown = `# API Documentation\n\n`;
  markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
  
  // Table of Contents
  markdown += `## Table of Contents\n\n`;
  markdown += `- [RESTful Endpoints](#restful-endpoints)\n`;
  markdown += `- [Socket.IO Events](#socketio-events)\n\n`;
  
  // RESTful Endpoints
  markdown += `## RESTful Endpoints\n\n`;
  
  // Group endpoints by category
  const categories = {};
  for (const endpoint of apiDocs.endpoints) {
    if (!categories[endpoint.category]) {
      categories[endpoint.category] = [];
    }
    categories[endpoint.category].push(endpoint);
  }
  
  // Generate markdown for each category
  for (const [category, endpoints] of Object.entries(categories)) {
    markdown += `### ${category.toUpperCase()} Routes\n\n`;
    
    for (const endpoint of endpoints) {
      markdown += `#### ${endpoint.method} ${endpoint.path}\n\n`;
      
      // Parameters
      if (Object.values(endpoint.parameters).some(arr => arr.length > 0)) {
        markdown += `##### Parameters\n\n`;
        
        if (endpoint.parameters.path.length > 0) {
          markdown += `**Path Parameters:**\n\n`;
          for (const param of endpoint.parameters.path) {
            markdown += `- \`${param}\`\n`;
          }
          markdown += `\n`;
        }
        
        if (endpoint.parameters.query.length > 0) {
          markdown += `**Query Parameters:**\n\n`;
          for (const param of endpoint.parameters.query) {
            markdown += `- \`${param}\`\n`;
          }
          markdown += `\n`;
        }
        
        if (endpoint.parameters.body.length > 0) {
          markdown += `**Body Parameters:**\n\n`;
          for (const param of endpoint.parameters.body) {
            markdown += `- \`${param}\`\n`;
          }
          markdown += `\n`;
        }
      }
      
      // Success Responses
      if (endpoint.responses.success.length > 0) {
        markdown += `##### Success Responses\n\n`;
        for (const response of endpoint.responses.success) {
          markdown += `**Status Code:** ${response.statusCode}\n\n`;
          markdown += `**Response Body:**\n\`\`\`json\n${response.body}\n\`\`\`\n\n`;
        }
      }
      
      // Error Responses
      if (endpoint.responses.error.length > 0) {
        markdown += `##### Error Responses\n\n`;
        for (const response of endpoint.responses.error) {
          markdown += `**Status Code:** ${response.statusCode}\n\n`;
          markdown += `**Response Body:**\n\`\`\`json\n${response.body}\n\`\`\`\n\n`;
        }
      }
      
      markdown += `---\n\n`;
    }
  }
  
  // Socket.IO Events
  markdown += `## Socket.IO Events\n\n`;
  
  // Incoming events (client to server)
  const incomingEvents = apiDocs.socketEvents.filter(e => e.type === 'incoming');
  if (incomingEvents.length > 0) {
    markdown += `### Incoming Events (Client to Server)\n\n`;
    
    for (const event of incomingEvents) {
      markdown += `#### \`${event.name}\`\n\n`;
      
      if (event.parameters.length > 0) {
        markdown += `##### Parameters\n\n`;
        for (const param of event.parameters) {
          markdown += `- \`${param}\`\n`;
        }
        markdown += `\n`;
      }
      
      if (event.emits.length > 0) {
        markdown += `##### May Emit\n\n`;
        for (const emit of event.emits) {
          markdown += `- \`${emit.event}\` (to ${emit.target})\n`;
        }
        markdown += `\n`;
      }
      
      markdown += `---\n\n`;
    }
  }
  
  // Outgoing events (server to client)
  const outgoingEvents = apiDocs.socketEvents.filter(e => e.type === 'outgoing');
  if (outgoingEvents.length > 0) {
    markdown += `### Outgoing Events (Server to Client)\n\n`;
    
    for (const event of outgoingEvents) {
      markdown += `#### \`${event.name}\`\n\n`;
      markdown += `---\n\n`;
    }
  }
  
  fs.writeFileSync(path.join(__dirname, 'api-documentation.md'), markdown);
  console.log(`Markdown documentation written to api-documentation.md`);
}

// Run the analysis
analyzeRoutes()
  .then(() => console.log('Analysis complete!'))
  .catch(err => console.error('Error analyzing routes:', err)); 