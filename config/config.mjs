import 'dotenv/config';

const base = {
  port: Number(process.env.PORT) || 3000,
  mongodb: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/my_social_networks',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  useHttps: process.env.USE_HTTPS === 'true',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000'
};

export default {
  development: { type: 'development', ...base },
  production: { type: 'production', ...base }
};
