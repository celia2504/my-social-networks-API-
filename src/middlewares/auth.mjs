import jwt from 'jsonwebtoken';
import config from '../../config/config.mjs';

const auth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ code: 401, message: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, config.development.jwtSecret);
    req.user = { id: decoded.sub };
    return next();
  } catch (error) {
    return res.status(401).json({ code: 401, message: 'Token invalide ou expiré' });
  }
};

export default auth;
