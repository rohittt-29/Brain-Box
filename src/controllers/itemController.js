const Item = require('../models/Item');
const { generateEmbedding } = require('../utils/embedding');
const { uploadBuffer } = require('../utils/cloudinary');
const { URL } = require('url')

function computeCategoriesForItem({ type, url, fileUrl, title }) {
  try {
    if (type === 'document') {
      const src = String(fileUrl || title || '').toLowerCase()
      const extMatch = src.match(/\.([a-z0-9]+)(?:$|\?)/i)
      const ext = extMatch ? extMatch[1] : ''
      return { categoryTop: 'Docs', categorySub: ext || 'file' }
    }
    if (type === 'link' || type === 'video') {
      const u = new URL(String(url || ''))
      const host = (u.hostname || '').replace(/^www\./, '').toLowerCase()
      let domain = host.split('.').slice(-2).join('.') // e.g., twitter.com
      if (host.includes('youtube') || host.includes('youtu.be')) domain = 'youtube.com'
      return { categoryTop: 'Links', categorySub: domain || 'external' }
    }
    if (type === 'note') {
      // Notes stay flat under Notes without subcategory
      return { categoryTop: 'Notes', categorySub: '' }
    }
  } catch (_) {}
  return { categoryTop: '', categorySub: '' }
}

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

    // Categorization
    const cats = computeCategoriesForItem({ type: payload.type, url: payload.url, fileUrl: payload.fileUrl, title: payload.title })
    payload.categoryTop = cats.categoryTop
    payload.categorySub = cats.categorySub

    const item = await Item.create(payload);
    return res.status(201).json(item);
  } catch (err) {
    return next(err);
  }
};


exports.getItems = async (req, res, next) => {
  try {
    const items = await Item.find({ userId: req.user.id }).sort({ createdAt: -1 });
    const withCategories = items.map((doc) => {
      const obj = doc.toObject({ getters: false, virtuals: false })
      if (!obj.categoryTop) {
        const cats = computeCategoriesForItem({ type: obj.type, url: obj.url, fileUrl: obj.fileUrl, title: obj.title })
        obj.categoryTop = cats.categoryTop
        obj.categorySub = cats.categorySub
      }
      return obj
    })
    return res.json(withCategories);
  } catch (err) {
    return next(err);
  }
};

exports.getItemById = async (req, res, next) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, userId: req.user.id });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    const obj = item.toObject({ getters: false, virtuals: false })
    if (!obj.categoryTop) {
      const cats = computeCategoriesForItem({ type: obj.type, url: obj.url, fileUrl: obj.fileUrl, title: obj.title })
      obj.categoryTop = cats.categoryTop
      obj.categorySub = cats.categorySub
    }
    return res.json(obj);
  } catch (err) {
    return next(err);
  }
};

exports.updateItem = async (req, res, next) => {
  try {
    const existing = await Item.findOne({ _id: req.params.id, userId: req.user.id })
    if (!existing) return res.status(404).json({ message: 'Item not found' })

    // sanitize and coerce types
    const updateData = { ...req.body };
    if (typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map(t => String(t).trim()).filter(Boolean)
    }
    if (updateData.title !== undefined) updateData.title = String(updateData.title).trim()
    if (updateData.content !== undefined) updateData.content = String(updateData.content)
    if (updateData.url !== undefined) updateData.url = String(updateData.url).trim()
    // If request is multipart and includes a new file, upload and set fileUrl
    if (req.file && req.file.buffer) {
      try {
        const result = await uploadBuffer(req.file.buffer, {
          folder: 'brain-box',
          originalFilename: req.file.originalname
        })
        updateData.fileUrl = result.secure_url
      } catch (e) {
        // Non-fatal: proceed without changing fileUrl
      }
    }
    
    // Recompute embedding from merged data (so unchanged fields are included)
    const merged = {
      title: updateData.title !== undefined ? updateData.title : existing.title,
      content: updateData.content !== undefined ? updateData.content : existing.content,
      url: updateData.url !== undefined ? updateData.url : existing.url,
      tags: Array.isArray(updateData.tags) ? updateData.tags : (existing.tags || [])
    }
    const tagText = Array.isArray(merged.tags) ? merged.tags.join(' ') : ''
    const textForEmbedding = (merged.content && merged.content.trim().length > 0)
      ? merged.content
      : `${merged.title || ''} ${merged.url || ''} ${tagText}`.trim();
    if (textForEmbedding) {
      updateData.embedding = await generateEmbedding(textForEmbedding);
    }

    // Categorization
    const cats = computeCategoriesForItem({ type: existing.type, url: merged.url, fileUrl: updateData.fileUrl || existing.fileUrl, title: merged.title })
    updateData.categoryTop = cats.categoryTop
    updateData.categorySub = cats.categorySub
    
    const updated = await Item.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: updateData },
      { new: true, runValidators: true }
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


