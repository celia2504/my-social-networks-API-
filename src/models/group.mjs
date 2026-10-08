import mongoose from 'mongoose';
import { urlValidator, nonEmptyArray } from '../utils/validators.mjs';

const { ObjectId } = mongoose.Schema.Types;

const Schema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom du groupe est obligatoire'],
    trim: true,
    minlength: 3,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 2000
  },
  icon: {
    type: String,
    validate: urlValidator
  },
  cover_photo: {
    type: String,
    validate: urlValidator
  },
  type: {
    type: String,
    enum: {
      values: ['public', 'private', 'secret'],
      message: 'Le type doit être public, private ou secret'
    },
    default: 'public'
  },
  allow_members_to_post: {
    type: Boolean,
    default: true
  },
  allow_members_to_create_events: {
    type: Boolean,
    default: false
  },
  administrators: {
    type: [{ type: ObjectId, ref: 'User' }],
    validate: nonEmptyArray
  },
  members: {
    type: [{ type: ObjectId, ref: 'User' }],
    validate: nonEmptyArray
  },
  created_by: {
    type: ObjectId,
    ref: 'User',
    required: true
  }
}, {
  collection: 'groups',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export default Schema;
