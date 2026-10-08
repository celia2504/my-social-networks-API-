import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const Schema = new mongoose.Schema({
  group: {
    type: ObjectId,
    ref: 'Group',
    default: null
  },
  event: {
    type: ObjectId,
    ref: 'Event',
    default: null
  }
}, {
  collection: 'threads',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

Schema.pre('validate', function checkOwner(next) {
  const hasGroup = Boolean(this.group);
  const hasEvent = Boolean(this.event);

  if (hasGroup === hasEvent) {
    this.invalidate('group', 'Un fil de discussion doit être lié à 1 groupe OU 1 événement (pas les deux, pas aucun)');
  }
  next();
});

export default Schema;
