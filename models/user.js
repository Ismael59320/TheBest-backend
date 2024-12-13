const mongoose = require('mongoose');


const userSchema = mongoose.Schema({
    username: String,
    email: String,
    password: String,
    token: String,
    favorites: [{type: mongoose.Schema.Types.ObjectId, ref: 'places'}],
    history: [String],
    role: String,
    notification: [String],
    avatarUrl: String,
})

const User = mongoose.model('users', userSchema);

module.exports  = User