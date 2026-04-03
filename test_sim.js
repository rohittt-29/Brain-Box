const mongoose = require('mongoose');
const Item = require('./src/models/Item');
const { generateEmbedding, calculateCosineSimilarity } = require('./src/utils/embedding');
const dotenv = require('dotenv');
dotenv.config();

async function testSim() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const coldEmailItem = await Item.findOne({ title: /cold email/i }, 'title content embedding').lean();
  if (!coldEmailItem) {
    console.log('Item not found');
    process.exit(1);
  }

  const userQuery = 'Give me the cold email strategy I saved';
  const queryVector = await generateEmbedding(userQuery);

  const score = calculateCosineSimilarity(queryVector, coldEmailItem.embedding);
  console.log('Cosine similarity between user query and item:', score);

  console.log('Item title:', coldEmailItem.title);
  console.log('Item content:', coldEmailItem.content ? coldEmailItem.content.substring(0,100) : 'none');
  
  // Also check top 5 from DB using vector search to see what Atlas returns!
  const results = await Item.aggregate([
    {
      $vectorSearch: {
        index: 'vector_index',
        path: 'embedding',
        queryVector,
        numCandidates: 100,
        limit: 5,
      },
    },
    {
      $project: {
        _id: 1, title: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ]);
  console.log('\nTop 5 vector search results from Atlas:');
  results.forEach((r, i) => console.log(`${i+1}. ${r.title} (Score: ${r.score})`));

  process.exit(0);
}
testSim().catch(console.error);
