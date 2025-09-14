const mongoose = require('mongoose');

const allowedTypes = ['note', 'link', 'document', 'video'];

const itemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: allowedTypes, required: true },
    content: { type: String, default: '' },
    url: { type: String, default: '' },
    filePath: { type: String, default: '' },
    tags: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: false }
);

module.exports = mongoose.model('Item', itemSchema);


