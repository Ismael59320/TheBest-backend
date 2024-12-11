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

async function fetchRestaurantsFromZone(zone, pageToken = '') {
    try {
        const baseUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${zone.lat},${zone.lng}&radius=2000&type=restaurant&key=${GOOGLE_API_KEY}`;
        const url = pageToken ? `${baseUrl}&pagetoken=${pageToken}` : baseUrl;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Fetched data from API:', data.results.map(place => ({
            name: place.name,
            photo: place.photos?.[0]?.photo_reference || 'No photo'
        })));

        return data;
    } catch (error) {
        console.error('Error fetching from zone:', error);
        throw error;
    }
}

async function getRestaurantDetails(placeId) {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,opening_hours&key=${GOOGLE_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            phoneNumber: data.result?.formatted_phone_number || 'Not available',
            openingHours: data.result?.opening_hours?.weekday_text || []
        };
    } catch (error) {
        console.error('Error fetching details:', error);
        return { phoneNumber: 'Not available', openingHours: [] };
    }
}

router.get('/findNearbyRestaurants', async (req, res) => {
    try {
        const places = await Place.find()
            .sort({ rating: -1, review_count: -1 })
            .limit(5);

        if (!places || places.length === 0) {
            return res.status(404).json({ message: "No restaurants found" });
        }

        const formattedPlaces = places.map(place => ({
            id: place.place_id,
            name: place.name,
            address: place.address?.street,
            rating: place.rating,
            photo: place.photo_reference ?
                `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photo_reference}&key=${GOOGLE_API_KEY}` :
                'placeholder_url',
            phoneNumber: place.phone,
            openingHours: place.openingHours
        }));

        console.log('Formatted places:', formattedPlaces);
        res.json(formattedPlaces);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

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

        const uniqueRestaurants = Array.from(
            new Map(allRestaurants.map(r => [r.place_id, r])).values()
        );

        for (const place of uniqueRestaurants) {
            const details = await getRestaurantDetails(place.place_id);

            console.log('Details for place:', {
                name: place.name,
                phone: details.phoneNumber,
                photo_reference: place.photos?.[0]?.photo_reference || 'No photo'
            });

            const updatedPlace = await Place.findOneAndUpdate(
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
                    photo_reference: place.photos?.[0]?.photo_reference || null,
                    place_id: place.place_id,
                    rating: place.rating,
                    review_count: place.user_ratings_total,
                    categories: place.types,
                    openingHours: details.openingHours
                },
                { upsert: true, new: true }
            );

            console.log(`Updated place in DB:`, updatedPlace);
        }

        res.json({ success: true, count: uniqueRestaurants.length });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;


































// const express = require('express');
// const router = express.Router();
// const Place = require('../models/place');
// require('dotenv').config();

// const GOOGLE_API_KEY = process.env.API_KEY;
// const SUB_ZONES = [
//     { lat: 50.6292, lng: 3.0573 }, // Centre
//     { lat: 50.6392, lng: 3.0573 }, // Nord
//     { lat: 50.6192, lng: 3.0573 }, // Sud
//     { lat: 50.6292, lng: 3.0673 }, // Est
//     { lat: 50.6292, lng: 3.0473 }  // Ouest
// ];

// async function fetchRestaurantsFromZone(zone, pageToken = '') {
//     try {
//         const baseUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${zone.lat},${zone.lng}&radius=2000&type=restaurant&key=${GOOGLE_API_KEY}`;
//         const url = pageToken ? `${baseUrl}&pagetoken=${pageToken}` : baseUrl;

//         const response = await fetch(url);
//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }

//         const data = await response.json();
//         console.log('API Response:', data.results[0].photos); // Voir la structure des photos
//         console.log('Fetched data from API:', data.results.map(place => ({
//             name: place.name,
//             photos: place.photos ? place.photos[0].photo_reference : 'No photo'
//         })));

//         return data;
//     } catch (error) {
//         console.error('Error fetching from zone:', error);
//         throw error;
//     }
// }

// async function getRestaurantDetails(placeId) {
//     try {
//         const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,opening_hours&key=${GOOGLE_API_KEY}`;
//         const response = await fetch(url);
//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }

//         const data = await response.json();
//         return {
//             phoneNumber: data.result?.formatted_phone_number || 'Not available',
//             openingHours: data.result?.opening_hours?.weekday_text || []
//         };
//     } catch (error) {
//         console.error('Error fetching details:', error);
//         return { phoneNumber: 'Not available', openingHours: [] };
//     }
// }

// router.get('/findNearbyRestaurants', async (req, res) => {
//     try {
//         const places = await Place.find()
//             .sort({ rating: -1, review_count: -1 })
//             .limit(5);

//         if (!places || places.length === 0) {
//             return res.status(404).json({ message: "No restaurants found" });
//         }

//         const formattedPlaces = places.map(place => {
//             console.log('Raw place:', place);
//             console.log('Asset photo:', place.asset?.photo);

//             return {


//                 id: place.place_id,
//                 name: place.name,
//                 address: place.address.street,
//                 rating: place.rating,
//                 photo: place.photo_reference ?
//                     `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photo_reference}&key=${GOOGLE_API_KEY}` :
//                     'placeholder_url',
//                 phoneNumber: place.phone,
//                 openingHours: place.openingHours
//             }
//         });
//         console.log('Formatted places:', formattedPlaces);
//         res.json(formattedPlaces);
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

// router.post('/updatePlaces', async (req, res) => {

//     try {
//         let allRestaurants = [];

//         for (const zone of SUB_ZONES) {
//             let pageToken = '';
//             do {
//                 const data = await fetchRestaurantsFromZone(zone, pageToken);
//                 console.log('Fetched data from API:', data.results);

//                 const goodRestaurants = data.results.filter(place =>
//                     place.rating >= 4 && place.user_ratings_total >= 500


//                 );

//                 allRestaurants = [...allRestaurants, ...goodRestaurants];
//                 pageToken = data.next_page_token;

//                 if (pageToken) {
//                     await new Promise(resolve => setTimeout(resolve, 2000));
//                 }
//             } while (pageToken);
//         }

//         const uniqueRestaurants = Array.from(
//             new Map(allRestaurants.map(r => [r.place_id, r])).values()
//         );

//         for (const place of uniqueRestaurants) {
//             const details = await getRestaurantDetails(place.place_id);


//             console.log('Photos data:', place.photos);
//             if (place.photos && place.photos.length > 0) {
//                 console.log('Photo reference:', place.photos[0].photo_reference);
//             } else {
//                 console.log(`No photos found for place: ${place.name}`);
//             }
//             await Place.findOneAndUpdate(
//                 { place_id: place.place_id },
//                 {
//                     name: place.name,
//                     phone: details.phoneNumber,
//                     location: {
//                         type: "Point",
//                         coordinates: [place.geometry.location.lng, place.geometry.location.lat]
//                     },
//                     address: {
//                         street: place.vicinity,
//                         city: "Lille"
//                     },
                    
//                         photo_reference: place.photos?.[0]?.photo_reference || null,
                 
//                     place_id: place.place_id,
//                     rating: place.rating,
//                     review_count: place.user_ratings_total,
//                     categories: place.types,
//                     openingHours: details.openingHours
//                 },
//                 { upsert: true }
//             );
//             console.log("Data sent to DB for place_id:", place.place_id, {
//                 name: place.name,
//                 phone: details.phoneNumber,
//                 photo_reference: place.photos?.[0]?.photo_reference,
//             });

//         }
//             res.json({ success: true, count: uniqueRestaurants.length });
//         } catch (error) {
//             console.error('Error:', error);
//             res.status(500).json({ error: 'Internal server error' });
//         }
//     });

// module.exports = router;