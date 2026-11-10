const Author = require('../models/Author');
const Book = require('../models/Book');
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

// PUT /authors/:id - update an author
exports.updateAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: `Author not found: ${id} is not a valid id` });
    }
    const author = await Author.findByIdAndUpdate(id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!author) {
      return res.status(404).json({ message: `Author with id ${id} not found` });
    }
    res.json(author);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /authors/:id - delete an author (policy A: block if they still have books)
exports.deleteAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: `Author not found: ${id} is not a valid id` });
    }
    const author = await Author.findById(id);
    if (!author) {
      return res.status(404).json({ message: `Author with id ${id} not found` });
    }
    const bookCount = await Book.countDocuments({ author: id });
    if (bookCount > 0) {
      return res.status(409).json({
        message: `Cannot delete ${author.name}: they still have ${bookCount} book(s). Delete or reassign those books first.`,
      });
    }
    await author.deleteOne();
    res.json({ message: `Author ${author.name} deleted` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
