const mongoose = require('mongoose');

const placieSchema = mongoose.Schema({
    name: String,
    phone: Number,
    location: {
        type: String, // remplacer string  par "Point"
        coordinates: [Number,Number] // a tester Pour créer un périmètre de recherche automatique autour d'une localisation donnée 
    },
    address:{ 
        Street : String,
        city: String,
    },
    asset: {
        video: String,
        photo: String,
    },
});
const Placie = mongoose.model('placies', placieSchema);

module.exports  = Placie