const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

const {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem
} = require('../controllers/itemController');

router.use(auth);

// router.post('/', createItem);
router.post('/', upload.single('pdf'), createItem);


router.get('/', getItems);
router.get('/:id', getItemById);
// Accept multipart form-data on update to allow both field edits and optional file replacement
router.put('/:id', upload.single('pdf'), updateItem);
router.delete('/:id', deleteItem);


module.exports = router;


