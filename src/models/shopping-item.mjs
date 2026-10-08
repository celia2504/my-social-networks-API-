import mongoose from 'mongoose';
import { hourValidator } from '../utils/validators.mjs';

const { ObjectId } = mongoose.Schema.Types;

const Schema = new mongoose.Schema({
  event: {
    type: ObjectId,
    ref: 'Event',
    required: true
  },
  user: {
    type: ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, "Le nom de l'objet est obligatoire"],
    trim: true,
    maxlength: 100
  },
  name_key: {
    type: String,
    select: false
  },
  quantity: {
    type: Number,
    required: [true, 'La quantité est obligatoire'],
    min: [1, 'La quantité doit être au moins 1'],
    validate: { validator: Number.isInteger, message: 'La quantité doit être un entier' }
  },
  arrival_time: {
    type: String,
    required: [true, "L'heure d'arrivée est obligatoire (HH:mm)"],
    validate: hourValidator
  }
}, {
  collection: 'shopping_items',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

Schema.pre('validate', function setKey(next) {
  if (this.name) this.name_key = this.name.trim().toLowerCase();
  next();
});

Schema.index({ event: 1, name_key: 1 }, { unique: true });

export default Schema;
