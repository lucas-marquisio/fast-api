import * as http from 'http'
import * as url from 'url'

interface Route {
  method: string;
  path: string;
  handler: (req: ExtendedIncomingMessage, res: http.ServerResponse) => void;
  middlewares?: Middleware[];
}

interface Params {
  [key: string]: string;
}

interface Middleware {
  (req: ExtendedIncomingMessage, res: http.ServerResponse, next: () => void): void;
}

interface ExtendedIncomingMessage extends http.IncomingMessage {
  params?: Params;
  body?: any;
}

export class SimpleHttpApi {
  private routes: Route[];
  private globalMiddlewares: Middleware[];
  private server: http.Server;
  private requestLoggingEnabled: boolean;
  private responseLoggingEnabled: boolean;

  constructor() {
    this.routes = [];
    this.globalMiddlewares = [];
    this.server = http.createServer(this.handleRequest.bind(this));
    this.requestLoggingEnabled = false;
    this.responseLoggingEnabled = false;
  }

  useGlobal(middleware: Middleware): void {
    this.globalMiddlewares.push(middleware);
  }

  use(path: string, middleware: Middleware): void {
    const route = this.routes.find((r) => r.path === path);
    if (route) {
      route.middlewares = route.middlewares || [];
      route.middlewares.push(middleware);
    }
  }

  get(path: string, handler: (req: ExtendedIncomingMessage, res: http.ServerResponse) => void, middlewares: Middleware[] = []): void {
    this.routes.push({ method: 'GET', path, handler, middlewares });
  }

  post(path: string, handler: (req: ExtendedIncomingMessage, res: http.ServerResponse) => void, middlewares: Middleware[] = []): void {
    this.routes.push({ method: 'POST', path, handler, middlewares });
  }

  put(path: string, handler: (req: ExtendedIncomingMessage, res: http.ServerResponse) => void, middlewares: Middleware[] = []): void {
    this.routes.push({ method: 'PUT', path, handler, middlewares });
  }

  delete(path: string, handler: (req: ExtendedIncomingMessage, res: http.ServerResponse) => void, middlewares: Middleware[] = []): void {
    this.routes.push({ method: 'DELETE', path, handler, middlewares });
  }

  start(port: number): void {
    this.server.listen(port, () => {
      console.log(`Server listening on port: \x1b[36m${port}\x1b[0m`);
    });
    this.server.maxConnections = 100000
  }

  stop(): void {
    this.server.close(() => {
      console.log('Server stopped');
    });
  }

  enableRequestLogging(): void {
    this.useGlobal((req, res, next) => {
      let bodyx = ''
      const timestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const method = `\x1b[32m${req.method}\x1b[0m`; // Verde
      const endpoint = `\x1b[32m${req.url}\x1b[0m`; // Verde
      const params = `\x1b[33m${JSON.stringify(req.params)}\x1b[0m`; // Amarelo
      const body = `\x1b[34m${JSON.stringify(bodyx)}\x1b[0m`; // Azul
      const authorization = `\x1b[35m${
        req.headers['authorization'] || 'N/A'
      }\x1b[0m`; // Roxo

      console.log(
        `[${timestamp}]: \x1b[46m${method}\x1b[0m:${endpoint}, params: ${params}, body: ${body}, header-authorization: ${authorization}`
      );

      this.logResponseDetails(res, timestamp);

      next();
    });

    this.requestLoggingEnabled = true;
  }

  logResponseDetails(res: http.ServerResponse, timestamp: string): void {
    const originalWriteHead = res.writeHead;
    const originalEnd = res.end;

    let statusCode: number | undefined;
    let body: string | undefined;

    res.writeHead = function (this: http.ServerResponse, code: number, headers: http.OutgoingHttpHeaders): void {
      statusCode = code;
      originalWriteHead.call(this, code, headers);
    } as any;

    res.end = function (this: http.ServerResponse, data?: any, encoding?: string, callback?: () => void): void {
      body = data;
      originalEnd.call(this, data, encoding, callback);

      const statusColor =
        statusCode! >= 200 && statusCode! < 300
          ? '\x1b[32m'
          : '\x1b[31m';
      const bodyColor = '\x1b[34m';

      console.log(
        `[${timestamp}]: \x1b[46mResponse\x1b[0m: statusCode: ${statusColor}${statusCode}\x1b[0m, body: ${bodyColor}${body}\x1b[0m`
      );
    } as any;
  }

  handleRequest(req: ExtendedIncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = url.parse(req.url!, true);
    const { pathname } = parsedUrl;

    const route = this.routes.find((route) => {
      const regex = this.pathToRegex(route.path);
      return route.method === req.method && regex.test(pathname!);
    });

    if (route) {
      const params = this.extractParams(route.path, pathname!);
      req.params = params;

      this.runMiddlewares(req, res, this.globalMiddlewares, () => {
        if (route.middlewares) {
          this.runMiddlewares(req, res, route.middlewares!, () => {
            if (req.method === 'GET' || req.method === 'DELETE') {
              route.handler(req, res);
            } else {
              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });

              req.on('end', () => {
                try {
                  req.body = JSON.parse(body);
                } catch (error) {
                  req.body = {};
                }

                route.handler(req, res);
              });
            }
          });
        } else {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', () => {
            try {
              req.body = JSON.parse(body);
            } catch (error) {
              req.body = {};
            }

            route.handler(req, res);
          });
        }
      });
    } else {
      this.sendResponse(res, 404, { error: 'Not Found' });
    }
  }

  runMiddlewares(req: ExtendedIncomingMessage, res: http.ServerResponse, middlewares: Middleware[], callback: () => void): void {
    const runNextMiddleware = (index: number): void => {
      if (index < middlewares.length) {
        middlewares[index](req, res, () => runNextMiddleware(index + 1));
      } else {
        callback();
      }
    };

    runNextMiddleware(0);
  }

  pathToRegex(path: string): RegExp {
    const regexString = path.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, '([^\\/]+)');
    return new RegExp(`^${regexString}$`);
  }

  extractParams(routePath: string, pathname: string): Params {
    const keys: string[] = [];
    const regexString = routePath.replace(
      /\$([a-zA-Z_][a-zA-Z0-9_]*)/g,
      (_, key) => {
        keys.push(key);
        return '([^\\/]+)';
      }
    );
    const regex = new RegExp(`^${regexString}$`);
    const match = pathname.match(regex);

    if (match) {
      return keys.reduce((params, key, index) => {
        params[key] = match[index + 1];
        return params;
      }, {} as Params);
    }

    return {};
  }

  sendResponse(res: http.ServerResponse, statusCode: number, data: Record<string, unknown>): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}

const simpleHttpApi = new SimpleHttpApi();
simpleHttpApi.enableRequestLogging();
simpleHttpApi.get('/exatch/$name', (req, res) => {
  simpleHttpApi.sendResponse(res, 200, { datalist: [{ id: 1, task: 'should go to shop'}] });
}, []);

simpleHttpApi.delete('/$id', (req, res) => {
  simpleHttpApi.sendResponse(res, 200, {})
}, [])

simpleHttpApi.start(4000);
