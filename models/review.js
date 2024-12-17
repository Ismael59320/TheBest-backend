const mongoose = require('mongoose');

const reviewSchema = mongoose.Schema({
    user: {type: mongoose.Schema.ObjectId, ref: 'users'},
    place_id: String,
    rating: Number,
    username: String,
    text: String,
    photo: String,
    created: Date,
})

const Review = mongoose.model('reviews', reviewSchema);

module.exports = Review