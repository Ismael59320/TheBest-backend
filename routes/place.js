var express = require("express");
var router = express.Router();
const Place = require('../models/place');

const MongoURL = process.env.MongoURL;

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


router.get('/', (req, res) => {
    Place.find()
    .then(data => {
      res.json({places: data})
    })
  });


module.exports = router;
