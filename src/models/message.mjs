import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const Schema = new mongoose.Schema({
  thread: {
    type: ObjectId,
    ref: 'Thread',
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
    required: [true, 'Le message ne peut pas être vide'],
    trim: true,
    maxlength: 2000
  },
  parent_message: {
    type: ObjectId,
    ref: 'Message',
    default: null
  }
}, {
  collection: 'messages',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export default Schema;
