const Item = require('../models/Item');
const { generateEmbedding } = require('../utils/embedding');
const { uploadBuffer } = require('../utils/cloudinary');

exports.createItem = async (req, res, next) => {
  try {
    console.log('req.file:', req.file);
    console.log('req.body:', req.body);
    
    const payload = {
      ...req.body,
      userId: req.user.id,
      fileUrl: null
    };
    
    // If a file is present, upload to Cloudinary
    if (req.file && req.file.buffer) {
      const result = await uploadBuffer(req.file.buffer, {
        folder: 'brain-box',
        originalFilename: req.file.originalname
      })
      payload.fileUrl = result.secure_url
    }

    console.log('Final payload:', payload);

    // Build semantic text from content, title, url and tags so tags influence search
    const tagText = Array.isArray(payload.tags) ? payload.tags.join(' ') : ''
    const textForEmbedding = (payload.content && payload.content.trim().length > 0)
      ? payload.content
      : `${payload.title || ''} ${payload.url || ''} ${tagText}`.trim();
    if (textForEmbedding) {
      payload.embedding = await generateEmbedding(textForEmbedding);
    }

    const item = await Item.create(payload);
    return res.status(201).json(item);
  } catch (err) {
    return next(err);
  }
};


exports.getItems = async (req, res, next) => {
  try {
    const items = await Item.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
};

exports.getItemById = async (req, res, next) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, userId: req.user.id });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    return res.json(item);
  } catch (err) {
    return next(err);
  }
};

exports.updateItem = async (req, res, next) => {
  try {
    const updateData = { ...req.body };
    
    // Generate new embedding if any semantic fields are being updated (content/title/url/tags)
    const tagText = Array.isArray(updateData.tags) ? updateData.tags.join(' ') : ''
    const textForEmbedding = (updateData.content && updateData.content.trim().length > 0)
      ? updateData.content
      : `${updateData.title || ''} ${updateData.url || ''} ${tagText}`.trim();
    if (textForEmbedding) {
      updateData.embedding = await generateEmbedding(textForEmbedding);
    }
    
    const updated = await Item.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updateData,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Item not found' });
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
};

exports.deleteItem = async (req, res, next) => {
  try {
    const deleted = await Item.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ message: 'Item not found' });
    return res.json({ message: 'Item deleted' });
  } catch (err) {
    return next(err);
  }
};


