import mongoose from 'mongoose';
import { emailValidator, nameValidator, urlValidator } from '../utils/validators.mjs';

const Schema = new mongoose.Schema({
  firstname: {
    type: String,
    required: [true, 'Le prénom est obligatoire'],
    trim: true,
    maxlength: 50,
    validate: nameValidator
  },
  lastname: {
    type: String,
    required: [true, 'Le nom est obligatoire'],
    trim: true,
    maxlength: 50,
    validate: nameValidator
  },
  email: {
    type: String,
    required: [true, "L'email est obligatoire"],
    unique: true, // deux utilisateurs ne peuvent pas avoir le même email
    lowercase: true,
    trim: true,
    validate: emailValidator
  },
  password: {
    type: String,
    required: true,
    select: false // le mot de passe (haché) n'est jamais renvoyé par défaut
  },
  birthdate: {
    type: Date,
    validate: {
      validator: (value) => !value || value < new Date(),
      message: 'La date de naissance doit être dans le passé'
    }
  },
  avatar: {
    type: String,
    validate: urlValidator
  },
  bio: {
    type: String,
    maxlength: 500
  },
  city: {
    type: String,
    maxlength: 100
  }
}, {
  collection: 'users',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export default Schema;
