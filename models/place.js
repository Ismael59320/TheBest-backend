const mongoose = require('mongoose');

const placeSchema = mongoose.Schema({
   name: String,
   phoneNumber: String,
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
   address: Object,
   photo: String,
   place_id: String,
   rating: Number,
   review_count: Number,
   categories: [String],
   openingHours: [String],
   lastUpdated: { type: Date },
   isActive: { type: Boolean, default: true }
});

placeSchema.index({ location: "2dsphere" });
placeSchema.index({ place_id: 1 });

const Place = mongoose.model('places', placeSchema);
module.exports = Place;