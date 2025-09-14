const Item = require('../models/Item');

exports.createItem = async (req, res, next) => {
  try {
    const payload = { ...req.body, userId: req.user.id };
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
    const updated = await Item.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
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


