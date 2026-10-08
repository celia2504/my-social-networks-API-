import mongoose from 'mongoose';
import { urlValidator } from '../utils/validators.mjs';

const { ObjectId } = mongoose.Schema.Types;

const Schema = new mongoose.Schema({
  album: {
    type: ObjectId,
    ref: 'Album',
    required: true,
    index: true
  },
  author: {
    type: ObjectId,
    ref: 'User',
    required: true
  },
  url: {
    type: String,
    required: [true, "L'URL de la photo est obligatoire"],
    validate: urlValidator
  },
  caption: {
    type: String,
    maxlength: 500
  }
}, {
  collection: 'photos',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export default Schema;
