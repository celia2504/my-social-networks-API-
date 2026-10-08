import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const Schema = new mongoose.Schema({
  poll: {
    type: ObjectId,
    ref: 'Poll',
    required: true
  },
  user: {
    type: ObjectId,
    ref: 'User',
    required: true
  },
  answers: [{
    _id: false,
    question: { type: ObjectId, required: true },
    option: { type: ObjectId, required: true }
  }]
}, {
  collection: 'poll_answers',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

Schema.index({ poll: 1, user: 1 }, { unique: true });

export default Schema;
