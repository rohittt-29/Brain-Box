const mongoose = require('mongoose');
const Item = require('./src/models/Item');
const dotenv = require('dotenv');
dotenv.config();

async function checkVector() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  const coldEmailItem = await Item.findOne({ title: /cold email/i }, 'title content type tags embedding').lean();
  if (coldEmailItem) {
    console.log('FOUND COLD EMAIL ITEM:');
    console.log(`Title: ${coldEmailItem.title}`);
    console.log(`Has Embedding: ${Array.isArray(coldEmailItem.embedding)}`);
    if(Array.isArray(coldEmailItem.embedding)){
        console.log(`Embedding Length: ${coldEmailItem.embedding.length}`);
    }
  } else {
    console.log('NO COLD EMAIL ITEM FOUND');
  }
  process.exit(0);
}
checkVector().catch(console.error);
