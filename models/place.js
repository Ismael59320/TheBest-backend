const mongoose = require('mongoose');

const placeSchema = mongoose.Schema({

    instagramUrl: String,
     name: String,
    phone: String,
    location: {
        type: {
            type: String,
            default: "Point"
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    address: {
        street : String,
        city : String,
    },

    photo_reference: String,
    all_photos : [String],
    videos: [{
        url: String,
        thumbnail: String
    }],
    place_id: String,
    rating: Number,
    reviews: [{
        author_name: String,
        rating: Number,
        text: String,
        time: Date,
        profile_photo_url: String
      }],
    review_count: Number,
    categories: [String],
    type : String,
    openingHours: [String],
    lastUpdated: { type: Date },
    isActive: { type: Boolean, default: true }
});

placeSchema.index({ location: "2dsphere" });
placeSchema.index({ place_id: 1 });

const Place = mongoose.model('places', placeSchema);
module.exports = Place;