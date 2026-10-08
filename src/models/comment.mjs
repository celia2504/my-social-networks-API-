import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const Schema = new mongoose.Schema({
  photo: {
    type: ObjectId,
    ref: 'Photo',
    required: true,
    index: true
  },
  author: {
    type: ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Le commentaire ne peut pas être vide'],
    trim: true,
    maxlength: 1000
  }
}, {
  collection: 'comments',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export default Schema;
