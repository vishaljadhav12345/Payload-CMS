// index.js
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json()); // to parse JSON bodies

// MongoDB connection string
const mongoURI = 'mongodb://localhost:27017/mydb';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Define a Mongoose schema and model
const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
});

const Product = mongoose.model('Product', ProductSchema);

// Routes
app.get('/', (req, res) => {
  res.send('Hello from Express + MongoDB!');
});

app.get('/products', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.post('/products', async (req, res) => {
  const newProduct = new Product(req.body);
  await newProduct.save();
  res.status(201).send(newProduct);
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
