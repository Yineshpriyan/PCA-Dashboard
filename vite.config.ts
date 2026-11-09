import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // Inject environment variables into process.env for server-side code execution in development
  Object.assign(process.env, env);

  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'vercel-api-dev-server',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith('/api/')) {
              try {
                const urlObj = new URL(req.url, 'http://localhost:3000');
                const pathname = urlObj.pathname;
                const endpoint = pathname.replace(/^\/api\//, '').replace(/\/$/, '');
                const filePath = `/api/${endpoint}.ts`;

                // Parse query parameters
                const query: Record<string, string> = {};
                urlObj.searchParams.forEach((val, key) => {
                  query[key] = val;
                });

                // Parse request body for POST/PUT requests
                let body: any = {};
                if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                  const buffers = [];
                  for await (const chunk of req) {
                    buffers.push(chunk);
                  }
                  const dataStr = Buffer.concat(buffers).toString();
                  if (dataStr) {
                    try {
                      body = JSON.parse(dataStr);
                    } catch {
                      body = dataStr;
                    }
                  }
                }

                // Dynamically load the serverless function using Vite's internal SSR loader
                const apiModule = await server.ssrLoadModule(filePath);
                const handler = apiModule.default;

                if (typeof handler !== 'function') {
                  throw new Error(`${filePath} does not export a default handler function`);
                }

                // Construct mock VercelRequest and VercelResponse objects
                const vercelReq = Object.assign(req, { body, query });
                const vercelRes = {
                  status(statusCode: number) {
                    res.statusCode = statusCode;
                    return this;
                  },
                  json(data: any) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                    return this;
                  },
                  send(data: any) {
                    res.end(data);
                    return this;
                  },
                  setHeader(name: string, value: string) {
                    res.setHeader(name, value);
                    return this;
                  }
                };

                // Execute the handler
                await handler(vercelReq, vercelRes);
              } catch (error) {
                console.error('Local API Error:', error);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ 
                  error: error instanceof Error ? error.message : 'Unknown dev-server API error' 
                }));
              }
            } else {
              next();
            }
          });
        }
      }
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
