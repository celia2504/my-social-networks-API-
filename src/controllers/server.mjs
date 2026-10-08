import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import https from 'https';
import fs from 'fs';
import config from '../../config/config.mjs';
import registerModels from '../models/index.mjs';
import routes from './routes.mjs';
import { errorHandler } from '../utils/http.mjs';

const Server = class Server {
  constructor() {
    this.app = express();
    this.config = config[process.argv[2]] || config.development;
  }

  async dbConnect() {
    const host = this.config.mongodb;

    this.connect = await mongoose.createConnection(host).asPromise();
    console.log('[OK] MongoDB connecté');

    this.connect.on('error', (err) => console.error('[ERROR] MongoDB :', err.message));
    this.connect.on('disconnected', () => console.error('[WARN] MongoDB déconnecté'));

    process.on('SIGINT', async () => {
      await this.connect.close();
      console.log('[CLOSE] MongoDB fermé');
      process.exit(0);
    });
  }

  middleware() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use((req, res, next) => {
      if (req.body === undefined || req.body === null || typeof req.body !== 'object') req.body = {};
      next();
    });
  }

  async routes() {
    this.models = registerModels(this.connect);
    await Promise.all(Object.values(this.models).map((model) => model.init()));

    this.app.get('/', (req, res) => {
      res.status(200).json({ name: 'My Social Networks API', version: '1.0.0', documentation: 'voir README.md' });
    });

    Object.values(routes).forEach((Controller) => new Controller(this.app, this.models, this.config));

    this.app.use((req, res) => {
      res.status(404).json({ code: 404, message: 'Not Found' });
    });

    this.app.use(errorHandler);
  }

  async run() {
    try {
      if (!this.config.jwtSecret) {
        throw new Error('JWT_SECRET manquant : crée le fichier .env (voir .env.example)');
      }

      await this.dbConnect();
      this.middleware();
      await this.routes();

      const { port } = this.config;

      if (this.config.useHttps) {
        const options = {
          key: fs.readFileSync('./cert/server.key'),
          cert: fs.readFileSync('./cert/server.crt')
        };
        https.createServer(options, this.app).listen(port, () => {
          console.log(`[OK] API lancée sur https://localhost:${port}`);
        });
      } else {
        this.app.listen(port, () => {
          console.log(`[OK] API lancée sur http://localhost:${port}`);
        });
      }
    } catch (err) {
      console.error('[ERROR] Impossible de démarrer :', err.message);
      process.exit(1);
    }
  }
};

export default Server;
