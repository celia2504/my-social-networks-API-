import validator from 'validator';
import mongoose from 'mongoose';


export const urlValidator = {
  validator: (value) => !value || validator.isURL(String(value), { require_protocol: true }),
  message: (props) => `${props.value} n'est pas une URL valide (ex : https://exemple.com/image.jpg)`
};

export const emailValidator = {
  validator: (value) => validator.isEmail(String(value)),
  message: (props) => `${props.value} n'est pas un email valide`
};

export const nameValidator = {
  validator: (value) => /^[\p{L}][\p{L}\s'-]*$/u.test(String(value)),
  message: (props) => `${props.value} doit contenir uniquement des lettres`
};

export const hourValidator = {
  validator: (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)),
  message: (props) => `${props.value} doit être une heure au format HH:mm`
};

export const nonEmptyArray = {
  validator: (value) => Array.isArray(value) && value.length > 0,
  message: (props) => `${props.path} doit contenir au moins un élément`
};

export const isObjectId = (value) => mongoose.isValidObjectId(value);
