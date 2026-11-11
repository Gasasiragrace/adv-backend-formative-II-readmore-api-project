const mongoose = require('mongoose');
const Book = require('../models/Book');
const Author = require('../models/Author');

const MIN_YEAR = 1450;

// Rule 2: the same author cannot have two books with the same title (case-insensitive)
const findDuplicateTitle = (author, title, excludeId) => {
  const filter = { author, title: String(title).trim() };
  if (excludeId) filter._id = { $ne: excludeId };
  return Book.findOne(filter).collation({ locale: 'en', strength: 2 });
};

// Rule 3: checks the schema can't express. Only checks fields that are present,
// so missing required fields are still reported by the schema as 400.
const validateBookRules = ({ price, publishedYear }) => {
  if (price !== undefined && Number(price) <= 0) {
    return 'Price must be greater than zero.';
  }
  if (publishedYear !== undefined) {
    const currentYear = new Date().getFullYear();
    if (Number(publishedYear) > currentYear) {
      return `Published year cannot be in the future (latest allowed: ${currentYear}).`;
    }
    if (Number(publishedYear) < MIN_YEAR) {
      return `Published year cannot be before ${MIN_YEAR}.`;
    }
  }
  return null;
};

// POST /books - create a book for an existing author
exports.createBook = async (req, res) => {
  try {
    // Rule 3: reject invalid price/year with 422 before touching the database
    const ruleError = validateBookRules(req.body);
    if (ruleError) {
      return res.status(422).json({ message: ruleError });
    }

    const { author } = req.body;

    // Rule 1: no orphan books. The author id must belong to a real author.
    if (!author || !mongoose.isValidObjectId(author) || !(await Author.exists({ _id: author }))) {
      return res.status(400).json({ message: 'Author does not exist. A book must belong to a real author.' });
    }

    // Rule 2: no duplicate titles for the same author (case-insensitive)
    if (req.body.title && (await findDuplicateTitle(author, req.body.title))) {
      return res.status(409).json({ message: 'This author already has a book with that title.' });
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

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTABLE_FIELDS = ['price', 'title', 'publishedYear'];

// GET /books - list books with optional filters and sorting (Rule 5)
// Example: /books?genre=Thriller&minPrice=10&maxPrice=30&search=sea&sort=price&order=asc
exports.getBooks = async (req, res) => {
  try {
    const { genre, minPrice, maxPrice, author, search, sort, order } = req.query;
    const filter = {};

    // Only the parameters that are present get added to the filter
    if (genre) {
      filter.genre = new RegExp(`^${escapeRegex(genre)}$`, 'i');
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) {
        if (Number.isNaN(Number(minPrice))) {
          return res.status(400).json({ message: 'minPrice must be a number.' });
        }
        filter.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined) {
        if (Number.isNaN(Number(maxPrice))) {
          return res.status(400).json({ message: 'maxPrice must be a number.' });
        }
        filter.price.$lte = Number(maxPrice);
      }
    }

    if (author) {
      if (!mongoose.isValidObjectId(author)) {
        return res.status(400).json({ message: 'author must be a valid author id.' });
      }
      filter.author = author;
    }

    if (search) {
      filter.title = new RegExp(escapeRegex(search), 'i');
    }

    // Sorting: only price, title or publishedYear are allowed
    let sortOption = {};
    if (sort) {
      if (!SORTABLE_FIELDS.includes(sort)) {
        return res.status(400).json({ message: `sort must be one of: ${SORTABLE_FIELDS.join(', ')}.` });
      }
      if (order && !['asc', 'desc'].includes(order)) {
        return res.status(400).json({ message: 'order must be asc or desc.' });
      }
      sortOption[sort] = order === 'desc' ? -1 : 1;
    }

    const books = await Book.find(filter)
      .collation({ locale: 'en' })
      .sort(sortOption)
      .populate('author');
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

// PUT /books/:id - update a book
exports.updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: `Book not found: ${id} is not a valid id` });
    }

    // Rule 3 also applies on update
    const ruleError = validateBookRules(req.body);
    if (ruleError) {
      return res.status(422).json({ message: ruleError });
    }

    // Rule 1 also applies on update: if the author is being changed, the new author must exist.
    if (req.body.author !== undefined) {
      const { author } = req.body;
      if (!mongoose.isValidObjectId(author) || !(await Author.exists({ _id: author }))) {
        return res.status(400).json({ message: 'Author does not exist. A book must belong to a real author.' });
      }
    }

    // Rule 2 also applies on update: check the final author + title combination,
    // ignoring the book being updated.
    if (req.body.title !== undefined || req.body.author !== undefined) {
      const existing = await Book.findById(id);
      if (!existing) {
        return res.status(404).json({ message: `Book with id ${id} not found` });
      }
      const finalAuthor = req.body.author || existing.author;
      const finalTitle = req.body.title !== undefined ? req.body.title : existing.title;
      if (await findDuplicateTitle(finalAuthor, finalTitle, id)) {
        return res.status(409).json({ message: 'This author already has a book with that title.' });
      }
    }

    const book = await Book.findByIdAndUpdate(id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    }).populate('author');
    if (!book) {
      return res.status(404).json({ message: `Book with id ${id} not found` });
    }
    res.json(book);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /books/:id - delete a book
exports.deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: `Book not found: ${id} is not a valid id` });
    }
    const book = await Book.findByIdAndDelete(id);
    if (!book) {
      return res.status(404).json({ message: `Book with id ${id} not found` });
    }
    res.json({ message: `Book "${book.title}" deleted` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
