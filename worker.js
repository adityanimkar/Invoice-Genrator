import { httpServerHandler } from 'cloudflare:node';
import app from './server.js';
import http from 'node:http';

const expressApp = app.default || app;
const server = http.createServer(expressApp);

export default httpServerHandler(server);
