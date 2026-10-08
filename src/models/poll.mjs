import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const OptionSchema = new mongoose.Schema({
  label: {
    type: String,
    required: [true, 'Une réponse possible doit avoir un libellé'],
    trim: true,
    maxlength: 200
  }
});

const QuestionSchema = new mongoose.Schema({
  label: {
    type: String,
    required: [true, 'Une question doit avoir un libellé'],
    trim: true,
    maxlength: 300
  },
  options: {
    type: [OptionSchema],
    validate: {
      validator: (value) => Array.isArray(value) && value.length >= 2,
      message: 'Chaque question doit proposer au moins 2 réponses possibles'
    }
  }
});

const Schema = new mongoose.Schema({
  event: {
    type: ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Le titre du sondage est obligatoire'],
    trim: true,
    maxlength: 200
  },
  questions: {
    type: [QuestionSchema],
    validate: {
      validator: (value) => Array.isArray(value) && value.length >= 1,
      message: 'Un sondage doit comporter au moins 1 question'
    }
  },
  created_by: {
    type: ObjectId,
    ref: 'User',
    required: true
  }
}, {
  collection: 'polls',
  minimize: false,
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export default Schema;
