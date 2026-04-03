const mongoose = require('mongoose');
const Item = require('./src/models/Item');
const { generateEmbedding } = require('./src/utils/embedding');
const dotenv = require('dotenv');
dotenv.config();

async function fixEmbeddings() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  const items = await Item.find({});
  let updatedCount = 0;
  for (const item of items) {
    const tagText = Array.isArray(item.tags) ? item.tags.join(' ') : '';
    const textForEmbedding = `${item.title || ''} ${item.content || ''} ${item.url || ''} ${tagText}`.trim();
    if (!textForEmbedding) continue;
    
    // Check if the text matches the old text... actually just re-generate all to be safe
    const embedding = await generateEmbedding(textForEmbedding);
    item.embedding = embedding;
    await item.save();
    updatedCount++;
    console.log(`Re-embedded: ${item.title}`);
  }
  console.log(`Updated ${updatedCount} items.`);
  process.exit(0);
}
fixEmbeddings().catch(console.error);
