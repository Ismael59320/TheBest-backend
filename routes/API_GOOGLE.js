const express = require('express');
const router = express.Router();
const Place = require('../models/place');

const GOOGLE_API_KEY = process.env.API_KEY;
const YELP_API_KEY = "JXYlcDSjvG7X1gDjaou7ELS74gnMHrFuDvqCeHJ22nZAYM9agkS14KHOk1niwQUNkLZXc-AkKzzDuSXas-xotOx1SOveJQJBbP0jZCC5aiAVYninOrfKVbNPhu5bZ3Yx";

const YELP_HEADERS = {
    "Authorization": `Bearer ${YELP_API_KEY}`
};

// Fonction pour normaliser une adresse
function normalizeAddress(address) {
    if (!address) return '';
    return address
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Supprimer les accents
        .replace(/,/g, '') // Supprimer les virgules
        .replace(/\s+/g, ' ') // Réduire les espaces multiples
        .trim();
}

// Fonction pour récupérer les catégories de Yelp
async function getRestaurantCategoriesFromYelp(name, street, city, postalCode = '59000') {
    try {
        // Normalisation des champs pour Yelp
        const normalizedStreet = normalizeAddress(street);
        const locationQuery = `${normalizedStreet}, ${city}, ${postalCode}`;

        // URL pour la requête Yelp
        const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(name)}&location=${encodeURIComponent(locationQuery)}&limit=1`;
        console.log(`Sending Yelp request for ${name} at ${locationQuery}`);

        const response = await fetch(url, { headers: YELP_HEADERS });
        const data = await response.json();

        // Logs détaillés
        if (data.businesses && data.businesses.length > 0) {
            const business = data.businesses[0];
            console.log(`Match found for ${name} - Yelp Address: ${business.location.display_address.join(', ')}`);

            // Extraction des catégories
            const categories = business.categories.map(category => category.title);
            return categories;
        } else {
            console.log(`No match found for ${name} at ${locationQuery}`);
            return [];
        }
    } catch (error) {
        console.error(`Error fetching Yelp categories for ${name}:`, error);
        return [];
    }
}

// Route pour mettre à jour les restaurants à partir des zones définies et les enrichir
router.post('/updatePlaces', async (req, res) => {
    try {
        const SUB_ZONES = [
            { lat: 50.6292, lng: 3.0573 }, // Centre
            { lat: 50.6392, lng: 3.0573 }, // Nord
            { lat: 50.6192, lng: 3.0573 }, // Sud   
            { lat: 50.6292, lng: 3.0673 }, // Est
            { lat: 50.6292, lng: 3.0473 }  // Ouest
        ];

        let allRestaurants = [];

        for (const zone of SUB_ZONES) {
            let pageToken = '';
            do {
                const baseUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${zone.lat},${zone.lng}&radius=2000&type=restaurant&key=${GOOGLE_API_KEY}`;
                const url = pageToken ? `${baseUrl}&pagetoken=${pageToken}` : baseUrl;

                const response = await fetch(url);
                const data = await response.json();

                const goodRestaurants = data.results.filter(place =>
                    place.rating >= 4 && place.user_ratings_total >= 200
                );

                allRestaurants = [...allRestaurants, ...goodRestaurants];
                pageToken = data.next_page_token;

                if (pageToken) {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre pour éviter les limites d'API
                }
            } while (pageToken);
        }

        const uniqueRestaurants = Array.from(
            new Map(allRestaurants.map(r => [r.place_id, r])).values()
        );

        let enrichedCount = 0;
        let nullCount = 0;

        for (const place of uniqueRestaurants) {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,opening_hours&key=${GOOGLE_API_KEY}`;
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();

            // Récupérer les catégories Yelp
            const categories = await getRestaurantCategoriesFromYelp(
                place.name,
                place.vicinity || '',
                "Lille", // Remplacer par la ville dynamique si disponible
                "59000" // Remplacer par un code postal dynamique si disponible
            );
            const type = categories.length > 0 ? categories.join(', ') : null;

            // Mettre à jour ou insérer le restaurant avec enrichissement
            await Place.findOneAndUpdate(
                { place_id: place.place_id },
                {
                    name: place.name,
                    phone: detailsData.result?.formatted_phone_number || 'Not available',
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
                    openingHours: detailsData.result?.opening_hours?.weekday_text || [],
                    type 
                },
                { upsert: true, new: true }
            );

            // Comptabiliser les mises à jour
            if (type) enrichedCount++;
            else nullCount++;
        }

        res.json({
            success: true,
            message: `Updated and enriched all restaurants.`,
            enrichedCount,
            nullCount,
            total: enrichedCount + nullCount
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route pour retourner les 5 meilleurs restaurants
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
            photo: place.photo_reference
                ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photo_reference}&key=${GOOGLE_API_KEY}`
                : 'placeholder_url',
            phoneNumber: place.phone,
            openingHours: place.openingHours,
            categories: place.categories,
            type: place.type // Inclure le champ `type` pour le filtrage
        }));

        res.json(formattedPlaces);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;










// const express = require('express');
// const router = express.Router();
// const Place = require('../models/place');

// const GOOGLE_API_KEY = process.env.API_KEY;
// const YELP_API_KEY = "JXYlcDSjvG7X1gDjaou7ELS74gnMHrFuDvqCeHJ22nZAYM9agkS14KHOk1niwQUNkLZXc-AkKzzDuSXas-xotOx1SOveJQJBbP0jZCC5aiAVYninOrfKVbNPhu5bZ3Yx";

// const YELP_HEADERS = {
//     "Authorization": `Bearer ${YELP_API_KEY}`
// };

// // Fonction pour normaliser une adresse
// function normalizeAddress(address) {
//     if (!address) return '';
//     return address
//         .toLowerCase()
//         .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Supprimer les accents
//         .replace(/,/g, '') // Supprimer les virgules
//         .replace(/\s+/g, ' ') // Réduire les espaces multiples
//         .trim();
// }

// // Fonction pour récupérer les catégories de Yelp
// async function getRestaurantCategoriesFromYelp(name, address, city, postalCode = '59000') {
//     try {
//         // Construire une adresse complète pour la recherche Yelp
//         const locationQuery = `${normalizeAddress(address)}, ${normalizeAddress(city)}, ${postalCode}`;

//         // Construire l'URL pour la recherche Yelp
//         const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(name)}&location=${encodeURIComponent(locationQuery)}&limit=1`;

//         const response = await fetch(url, { headers: YELP_HEADERS });
//         const data = await response.json();

//         if (data.businesses && data.businesses.length > 0) {
//             const business = data.businesses[0];
//             const categories = business.categories.map(category => category.title);
//             return categories;
//         } else {
//             return [];
//         }
//     } catch (error) {
//         console.error('Error fetching Yelp categories:', error);
//         return [];
//     }
// }

// // Route pour mettre à jour les restaurants à partir des zones définies et les enrichir
// router.post('/updatePlaces', async (req, res) => {
//     try {
//         const SUB_ZONES = [
//             { lat: 50.6292, lng: 3.0573 }, // Centre
//             { lat: 50.6392, lng: 3.0573 }, // Nord
//             { lat: 50.6192, lng: 3.0573 }, // Sud   
//             { lat: 50.6292, lng: 3.0673 }, // Est
//             { lat: 50.6292, lng: 3.0473 }  // Ouest
//         ];

//         let allRestaurants = [];

//         for (const zone of SUB_ZONES) {
//             let pageToken = '';
//             do {
//                 const baseUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${zone.lat},${zone.lng}&radius=2000&type=restaurant&key=${GOOGLE_API_KEY}`;
//                 const url = pageToken ? `${baseUrl}&pagetoken=${pageToken}` : baseUrl;

//                 const response = await fetch(url);
//                 const data = await response.json();

//                 const goodRestaurants = data.results.filter(place =>
//                     place.rating >= 4 && place.user_ratings_total >= 200
//                 );

//                 allRestaurants = [...allRestaurants, ...goodRestaurants];
//                 pageToken = data.next_page_token;

//                 if (pageToken) {
//                     await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre pour éviter les limites d'API
//                 }
//             } while (pageToken);
//         }

//         const uniqueRestaurants = Array.from(
//             new Map(allRestaurants.map(r => [r.place_id, r])).values()
//         );

//         let enrichedCount = 0;
//         let nullCount = 0;

//         for (const place of uniqueRestaurants) {
//             const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,opening_hours&key=${GOOGLE_API_KEY}`;
//             const detailsResponse = await fetch(detailsUrl);
//             const detailsData = await detailsResponse.json();

//             // Récupérer les catégories Yelp
//             const categories = await getRestaurantCategoriesFromYelp(
//                 place.name,
//                 place.vicinity || '',
//                 "Lille", // Remplacer par la ville dynamique si disponible
//                 "59000" // Remplacer par un code postal dynamique si disponible
//             );
//             const type = categories.length > 0 ? categories.join(', ') : null;

//             // Mettre à jour ou insérer le restaurant avec enrichissement
//             await Place.findOneAndUpdate(
//                 { place_id: place.place_id },
//                 {
//                     name: place.name,
//                     phone: detailsData.result?.formatted_phone_number || 'Not available',
//                     location: {
//                         type: "Point",
//                         coordinates: [place.geometry.location.lng, place.geometry.location.lat]
//                     },
//                     address: {
//                         street: place.vicinity,
//                         city: "Lille"
//                     },
//                     photo_reference: place.photos?.[0]?.photo_reference || null,
//                     place_id: place.place_id,
//                     rating: place.rating,
//                     review_count: place.user_ratings_total,
//                     categories: place.types,
//                     openingHours: detailsData.result?.opening_hours?.weekday_text || [],
//                     type // Champ enrichi avec Yelp ou `null`
//                 },
//                 { upsert: true, new: true }
//             );

//             // Comptabiliser les mises à jour
//             if (type) enrichedCount++;
//             else nullCount++;
//         }

//         res.json({
//             success: true,
//             message: `Updated and enriched all restaurants.`,
//             enrichedCount,
//             nullCount,
//             total: enrichedCount + nullCount
//         });
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

// // Route pour retourner les 5 meilleurs restaurants
// router.get('/findNearbyRestaurants', async (req, res) => {
//     try {
//         const places = await Place.find()
//             .sort({ rating: -1, review_count: -1 })
//             .limit(5);

//         if (!places || places.length === 0) {
//             return res.status(404).json({ message: "No restaurants found" });
//         }

//         const formattedPlaces = places.map(place => ({
//             id: place.place_id,
//             name: place.name,
//             address: place.address?.street,
//             rating: place.rating,
//             photo: place.photo_reference
//                 ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photo_reference}&key=${GOOGLE_API_KEY}`
//                 : 'placeholder_url',
//             phoneNumber: place.phone,
//             openingHours: place.openingHours,
//             categories: place.categories,
//             type: place.type // Inclure le champ `type` pour le filtrage
//         }));

//         res.json(formattedPlaces);
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

// module.exports = router;
