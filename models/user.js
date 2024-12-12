const mongoose = require('mongoose');

const favoritesSchema = mongoose.Schema({
    id: {type: mongoose.Schema.Types.ObjectId, ref: 'places'},
})

const userSchema = mongoose.Schema({
    username: String,
    email: String,
    password: String,
    token: String,
    favorites: [favoritesSchema],
    history: [String],
    role: String,
    notification: [String],
    avatarUrl: String,
})
const User = mongoose.model('users', userSchema);
// const Favorite = mongoose.model('favorites', favoritesSchema)

module.exports  = User
// module.exports = Favorite