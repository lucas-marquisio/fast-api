# Simple Http Api
#### _SimpleHttpApi is a Node.js library that provides an uncomplicated approach to building HTTP servers with support for routes and middlewares. Developed in TypeScript and leveraging native http and url modules._

## Features

- Flexibility with Middlewares
- Detailed Request Logging [debugg]
- Minimal Configuration for Quick Start
- Event-Driven Request Handling

## How Use
``` typescript
import { SimpleHttpApi } from 'simple-http-api'
const simpleHttpApi = new SimpleHttpApi();

// simpleHttpApi.enableRequestLogging(); enable logs 

simpleHttpApi.start(4000); // start at port 4000
```
#### Middleware Example
``` typescript
const middleware = (request, response, pass) => { 
  pass() // to Calls the next function/middleware in the chain
}
simpleHttpApi.useGlobal(middleware)
```

#### params and body
``` typescript
route params  $myRouteParams
default config for body json
```

#### Methods Http
``` typescript
simpleHttpApi.get('/', (req, res) => {
  simpleHttpApi.sendResponse(res, 200, {}); // response, statusCode, body
}, [middlewares]);
    
simpleHttpApi.post('/', (req, res) => {
  simpleHttpApi.sendResponse(res, 200, {}); // response, statusCode, body
}, [middlewares]);
    
simpleHttpApi.put('/', (req, res) => {
  simpleHttpApi.sendResponse(res, 200, {}); // response, statusCode, body
}, [middlewares]);

impleHttpApi.delete('/$id', (req, res) => {
  simpleHttpApi.sendResponse(res, 200, {}); // response, statusCode, body
}, [middlewares]);
```
