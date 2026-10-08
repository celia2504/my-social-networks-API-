import mongoose from 'mongoose';

export class HttpError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);
export const forbidden = (message = 'Forbidden') => new HttpError(403, message);
export const badRequest = (message, details) => new HttpError(400, message, details);

export const pick = (source = {}, keys = []) => {
  const result = {};
  keys.forEach((key) => {
    if (source[key] !== undefined) result[key] = source[key];
  });
  return result;
};

export const pagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

export const checkId = (value, name = 'id') => {
  if (!mongoose.isValidObjectId(value)) {
    throw badRequest(`${name} invalide`);
  }
  return value;
};

export const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.code).json({ code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ code: 400, message: 'Validation error', details });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ code: 400, message: `Valeur invalide pour ${err.path}` });
  }

  if (err && err.code === 11000) {
    return res.status(409).json({ code: 409, message: 'Conflict: cette ressource existe déjà', details: err.keyValue });
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 400, message: 'JSON invalide' });
  }

  console.error('[ERROR]', err);
  return res.status(500).json({ code: 500, message: 'Internal Server Error' });
};
