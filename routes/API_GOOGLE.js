const express = require('express');
const router = express.Router();
const Place = require('../models/place');
require('dotenv').config();

const GOOGLE_API_KEY = process.env.API_KEY;
const SUB_ZONES = [
   { lat: 50.6292, lng: 3.0573 }, // Centre
   { lat: 50.6392, lng: 3.0573 }, // Nord
   { lat: 50.6192, lng: 3.0573 }, // Sud
   { lat: 50.6292, lng: 3.0673 }, // Est
   { lat: 50.6292, lng: 3.0473 }  // Ouest
];

// Récupère les restaurants d'une zone
async function fetchRestaurantsFromZone(zone, pageToken = '') {
   const baseUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${zone.lat},${zone.lng}&radius=2000&type=restaurant&key=${GOOGLE_API_KEY}`;
   const url = pageToken ? `${baseUrl}&pagetoken=${pageToken}` : baseUrl;

   const response = await fetch(url);
   const data = await response.json();
   return data;
}



// test


// router.post('/test', (req, res) => {
//   res.json({ message: "Test réussi" });
// });

// module.exports = router;


// Récupère les détails d'un restaurant
async function getRestaurantDetails(placeId) {
   const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,opening_hours&key=${GOOGLE_API_KEY}`;
   const response = await fetch(url);
   const data = await response.json();
   
   return {
       phoneNumber: data.result?.formatted_phone_number || 'Non disponible',
       openingHours: data.result?.opening_hours?.weekday_text || []
   };
}

// Route pour mettre à jour la base de données
router.post('/updatePlaces', async (req, res) => {
   try {
       let allRestaurants = [];

       for (const zone of SUB_ZONES) {
           let pageToken = '';
           do {
               const data = await fetchRestaurantsFromZone(zone, pageToken);
               
               const goodRestaurants = data.results.filter(place => 
                   place.rating >= 4 && place.user_ratings_total >= 500
               );
               
               allRestaurants = [...allRestaurants, ...goodRestaurants];
               pageToken = data.next_page_token;

               if (pageToken) {
                   await new Promise(resolve => setTimeout(resolve, 2000));
               }
           } while (pageToken);
       }

       // Supprime les doublons
       const uniqueRestaurants = Array.from(
           new Map(allRestaurants.map(r => [r.place_id, r])).values()
       );

       // Sauvegarde en base de données
       for (const place of uniqueRestaurants) {
           const details = await getRestaurantDetails(place.place_id);

           await Place.findOneAndUpdate(
               { place_id: place.place_id },
               {
                   name: place.name,
                   phone: details.phoneNumber,
                   location: {
                       type: "Point",
                       coordinates: [place.geometry.location.lng, place.geometry.location.lat]
                   },
                   address: {
                       street: place.vicinity,
                       city: "Lille"
                   },
                   asset: {
                       photo: place.photos ? 
                           `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}` 
                           : 'placeholder_url'
                   },
                   place_id: place.place_id,
                   rating: place.rating,
                   review_count: place.user_ratings_total,
                   categories: place.types,
                   openingHours: details.openingHours
               },
               { upsert: true }
           );
       }

       res.json({ success: true });
   } catch (error) {
       console.error('Erreur:', error);
       res.status(500).json({ error: error.message });
   }
});

// Route pour récupérer les restaurants
router.get('/findNearbyRestaurants', async (req, res) => {
   try {
       let places = await Place.find()
           .sort({ rating: -1, review_count: -1 })
           .limit(5);

       if (places.length === 0) {
           res.status(404).json({ message: "Aucun restaurant trouvé" });
           return;
       }

       res.json(places);
   } catch (error) {
       console.error('Erreur:', error);
       res.status(500).json({ error: error.message });
   }
});

module.exports = router;