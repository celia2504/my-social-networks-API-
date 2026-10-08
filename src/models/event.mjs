import mongoose from 'mongoose';
import { urlValidator, nonEmptyArray } from '../utils/validators.mjs';

const { ObjectId } = mongoose.Schema.Types;

const Schema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Le nom de l'événement est obligatoire"],
    trim: true,
    minlength: 3,
    maxlength: 150
  },
  description: {
    type: String,
    maxlength: 5000
  },
  start_date: {
    type: Date,
    required: [true, 'La date de début est obligatoire']
  },
  end_date: {
    type: Date,
    required: [true, 'La date de fin est obligatoire']
  },
  location: {
    type: String,
    required: [true, 'Le lieu est obligatoire'],
    trim: true,
    maxlength: 300
  },
  cover_photo: {
    type: String,
    validate: urlValidator
  },
  is_private: {
    type: Boolean,
    default: false
  },
  organizers: {
    type: [{ type: ObjectId, ref: 'User' }],
    validate: nonEmptyArray
  },
  participants: [{ type: ObjectId, ref: 'User' }],
  group: {
    type: ObjectId,
    ref: 'Group',
    default: null
  },
  ticketing_enabled: { type: Boolean, default: false },
  shopping_list_enabled: { type: Boolean, default: false },
  carpooling_enabled: { type: Boolean, default: false },
  created_by: {
    type: ObjectId,
    ref: 'User',
    required: true
  }
}, {
  collection: 'events',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

Schema.pre('validate', function checkEvent(next) {
  if (this.start_date && this.end_date && this.end_date <= this.start_date) {
    this.invalidate('end_date', 'La date de fin doit être après la date de début');
  }
  if (this.ticketing_enabled && this.is_private) {
    this.invalidate('ticketing_enabled', 'La billetterie est réservée aux événements publics');
  }
  next();
});

export default Schema;
