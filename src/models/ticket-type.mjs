import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const Schema = new mongoose.Schema({
  event: {
    type: ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Le nom du type de billet est obligatoire'],
    trim: true,
    maxlength: 100
  },
  price: {
    type: Number,
    required: [true, 'Le montant est obligatoire'],
    min: [0, 'Le montant ne peut pas être négatif']
  },
  quantity: {
    type: Number,
    required: [true, 'La quantité est obligatoire'],
    min: [1, 'La quantité doit être au moins 1'],
    validate: {
      validator: Number.isInteger,
      message: 'La quantité doit être un nombre entier'
    }
  },
  remaining: {
    type: Number,
    min: 0
  }
}, {
  collection: 'ticket_types',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

Schema.pre('validate', function initRemaining(next) {
  if (this.isNew && this.remaining === undefined) {
    this.remaining = this.quantity;
  }
  next();
});

export default Schema;
