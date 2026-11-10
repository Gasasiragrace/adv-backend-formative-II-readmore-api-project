const mongoose = require('mongoose');
const Book = require('../models/Book');
const Author = require('../models/Author');

// POST /books - create a book for an existing author
exports.createBook = async (req, res) => {
  try {
    const { author } = req.body;

    // Rule 1: no orphan books. The author id must belong to a real author.
    if (!author || !mongoose.isValidObjectId(author) || !(await Author.exists({ _id: author }))) {
      return res.status(400).json({ message: 'Author does not exist. A book must belong to a real author.' });
    }

    const book = await Book.create(req.body);
    res.status(201).json(book);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /books - get all books with full author details
exports.getBooks = async (req, res) => {
  try {
    const books = await Book.find().populate('author');
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /books/:id - get one book with full author details
exports.getBook = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: `Book not found: ${id} is not a valid id` });
    }
    const book = await Book.findById(id).populate('author');
    if (!book) {
      return res.status(404).json({ message: `Book with id ${id} not found` });
    }
    res.json(book);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
