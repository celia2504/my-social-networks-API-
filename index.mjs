import 'dotenv/config';
import Server from './src/controllers/server.mjs';

const server = new Server();

server.run();
