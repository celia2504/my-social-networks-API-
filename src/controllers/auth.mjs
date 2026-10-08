import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import rateLimit from 'express-rate-limit';
import { pick, badRequest, HttpError } from '../utils/http.mjs';

const Auth = class Auth {
  constructor(app, models, config) {
    this.app = app;
    this.User = models.User;
    this.config = config;

    this.limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: { code: 429, message: 'Trop de tentatives, réessayez plus tard' }
    });

    this.run();
  }

  createToken(user) {
    return jwt.sign({ sub: String(user._id) }, this.config.jwtSecret, { expiresIn: this.config.jwtExpiresIn });
  }

  register() {
    this.app.post('/auth/register', this.limiter, async (req, res) => {
      const data = pick(req.body, ['firstname', 'lastname', 'email', 'password', 'birthdate', 'avatar', 'bio', 'city']);

      if (typeof data.password !== 'string' || !validator.isStrongPassword(data.password, { minSymbols: 0 })) {
        throw badRequest('Le mot de passe doit faire au moins 8 caractères avec une majuscule, une minuscule et un chiffre');
      }

      const exists = await this.User.exists({ email: String(data.email || '').toLowerCase().trim() });
      if (exists) throw new HttpError(409, 'Cet email est déjà utilisé');

      data.password = await bcrypt.hash(data.password, 10);
      const user = await this.User.create(data);

      const safeUser = user.toObject();
      delete safeUser.password;

      res.status(201).json({ user: safeUser, token: this.createToken(user) });
    });
  }

  login() {
    this.app.post('/auth/login', this.limiter, async (req, res) => {
      const { email, password } = req.body || {};

      if (typeof email !== 'string' || typeof password !== 'string') {
        throw badRequest('email et password sont obligatoires');
      }

      const user = await this.User.findOne({ email: email.toLowerCase().trim() }).select('+password');

      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new HttpError(401, 'Email ou mot de passe incorrect');
      }

      res.status(200).json({ token: this.createToken(user) });
    });
  }

  run() {
    this.register();
    this.login();
  }
};

export default Auth;
