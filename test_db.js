const mongoose = require('mongoose');
const Item = require('./src/models/Item');
const dotenv = require('dotenv');
dotenv.config();

async function checkItems() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  const items = await Item.find({}, 'title content type tags embedding').lean();
  console.log(`Found ${items.length} total items`);
  
  const coldEmailItem = items.find(i => i.title && i.title.toLowerCase().includes('cold email'));
  if (coldEmailItem) {
    console.log('FOUND COLD EMAIL ITEM:');
    console.log(`Title: ${coldEmailItem.title}`);
    console.log(`Content: ${coldEmailItem.content ? coldEmailItem.content.substring(0, 50) + '...' : 'none'}`);
    console.log(`Tags: ${coldEmailItem.tags}`);
    console.log(`Has Embedding: ${Array.isArray(coldEmailItem.embedding) && coldEmailItem.embedding.length > 0}`);
  } else {
    console.log('NO COLD EMAIL ITEM FOUND');
  }

  // Print all titles to see if those listed strings are there
  console.log('First 10 item titles:', items.slice(0, 10).map(i => i.title).join(', '));
  
  process.exit(0);
}
checkItems().catch(console.error);
