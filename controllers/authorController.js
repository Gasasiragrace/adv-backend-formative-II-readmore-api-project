const Author = require('../models/Author');
const mongoose = require('mongoose');

// POST /authors - create a new author
exports.createAuthor = async (req, res) => {
  try {
    const author = await Author.create(req.body);
    res.status(201).json(author);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /authors - get all authors
exports.getAuthors = async (req, res) => {
  try {
    const authors = await Author.find();
    res.json(authors);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /authors/:id - get one author
exports.getAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: `Author not found: ${id} is not a valid id` });
    }
    const author = await Author.findById(id);
    if (!author) {
      return res.status(404).json({ message: `Author with id ${id} not found` });
    }
    res.json(author);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
