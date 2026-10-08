import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const Schema = new mongoose.Schema({
  event: {
    type: ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  driver: {
    type: ObjectId,
    ref: 'User',
    required: true
  },
  departure_location: {
    type: String,
    required: [true, 'Le lieu de départ est obligatoire'],
    trim: true,
    maxlength: 300
  },
  departure_time: {
    type: Date,
    required: [true, "L'heure de départ est obligatoire"]
  },
  price: {
    type: Number,
    required: [true, 'Le prix est obligatoire'],
    min: [0, 'Le prix ne peut pas être négatif']
  },
  seats_available: {
    type: Number,
    required: [true, 'Le nombre de places est obligatoire'],
    min: [1, 'Il faut au moins 1 place'],
    max: [8, '8 places maximum'],
    validate: { validator: Number.isInteger, message: 'Le nombre de places doit être un entier' }
  },
  max_detour_minutes: {
    type: Number,
    required: [true, "Le temps maximum d'écart est obligatoire"],
    min: [0, "Le temps d'écart ne peut pas être négatif"],
    max: [240, "Le temps d'écart ne peut pas dépasser 240 minutes"]
  },
  passengers: [{ type: ObjectId, ref: 'User' }]
}, {
  collection: 'carpools',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export default Schema;
