var express = require("express");
var router = express.Router();
const Place = require("../models/place");

const GOOGLE_API_KEY = process.env.API_KEY;

// const nearbyPlaces = await Place.find({
//   location: {
//       $near: {
//           $geometry: {
//               type: "Point",
//               coordinates: [longitude, latitude]
//           },
//           $maxDistance: 2000 // en mètres
//       }
//   }
// }

router.get("/", (req, res) => {
  Place.find().then((data) => {

    const formattedPlaces = data.map(place => ({
      _id: place._id,
      id: place.place_id,
      name: place.name,
      address: place.address?.street,
      rating: place.rating,
      photo: place.photo_reference ?
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photo_reference}&key=${GOOGLE_API_KEY}` :
          'placeholder_url',
      phoneNumber: place.phone,
      openingHours: place.openingHours,
      location: place.location
  }));

    res.json({ places: formattedPlaces });
  });
});

module.exports = router;
