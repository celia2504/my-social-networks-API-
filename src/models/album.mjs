import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const Schema = new mongoose.Schema({
  event: {
    type: ObjectId,
    ref: 'Event',
    required: [true, "L'album doit être lié à un événement"],
    index: true
  },
  title: {
    type: String,
    required: [true, "Le titre de l'album est obligatoire"],
    trim: true,
    maxlength: 150
  },
  description: {
    type: String,
    maxlength: 2000
  },
  created_by: {
    type: ObjectId,
    ref: 'User',
    required: true
  }
}, {
  collection: 'albums',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export default Schema;
