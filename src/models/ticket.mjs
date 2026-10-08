import mongoose from 'mongoose';
import { emailValidator, nameValidator } from '../utils/validators.mjs';

const { ObjectId } = mongoose.Schema.Types;

const AddressSchema = new mongoose.Schema({
  street: { type: String, required: [true, 'La rue est obligatoire'], trim: true, maxlength: 200 },
  zip_code: {
    type: String,
    required: [true, 'Le code postal est obligatoire'],
    trim: true,
    match: [/^[A-Za-z0-9 -]{3,10}$/, 'Code postal invalide']
  },
  city: { type: String, required: [true, 'La ville est obligatoire'], trim: true, maxlength: 100 },
  country: { type: String, required: [true, 'Le pays est obligatoire'], trim: true, maxlength: 100 }
}, { _id: false });

const Schema = new mongoose.Schema({
  event: {
    type: ObjectId,
    ref: 'Event',
    required: true
  },
  ticket_type: {
    type: ObjectId,
    ref: 'TicketType',
    required: [true, 'Le type de billet est obligatoire']
  },
  buyer: {
    firstname: { type: String, required: [true, 'Le prénom est obligatoire'], trim: true, maxlength: 50, validate: nameValidator },
    lastname: { type: String, required: [true, 'Le nom est obligatoire'], trim: true, maxlength: 50, validate: nameValidator },
    email: { type: String, required: [true, "L'email est obligatoire"], lowercase: true, trim: true, validate: emailValidator },
    address: { type: AddressSchema, required: [true, "L'adresse complète est obligatoire"] }
  },
  purchased_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'tickets',
  minimize: false,
  versionKey: false
});

Schema.index({ event: 1, 'buyer.email': 1 }, { unique: true });

export default Schema;
