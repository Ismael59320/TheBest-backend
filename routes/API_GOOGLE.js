const express = require('express');
const router = express.Router();
const Place = require('../models/place');
const fetch = require('node-fetch');

const GOOGLE_API_KEY = process.env.API_KEY;
const YELP_API_KEY = "VOTRE_CLE_YELP";
const YELP_HEADERS = {
    "Authorization": `Bearer ${YELP_API_KEY}`
};

// Fonctions utilitaires
function normalizeAddress(address) {
    if (!address) return '';
    return address
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Supprimer les accents
        .replace(/,/g, '') // Supprimer les virgules
        .replace(/\s+/g, ' ') // Réduire les espaces multiples
        .trim();
}

async function getRestaurantCategoriesFromYelp(name, street, city, postalCode = '59000') {
    try {
        const normalizedStreet = normalizeAddress(street);
        const locationQuery = `${normalizedStreet}, ${city}, ${postalCode}`;
        const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(name)}&location=${encodeURIComponent(locationQuery)}&limit=1`;
        const response = await fetch(url, { headers: YELP_HEADERS });
        const data = await response.json();

        if (data.businesses && data.businesses.length > 0) {
            const business = data.businesses[0];
            const categories = business.categories.map(category => category.title);
            return categories;
        } else {
            return [];
        }
    } catch (error) {
        console.error(`Error fetching Yelp categories for ${name}:`, error);
        return [];
    }
}

// Zones et paramètres
const BASE_LAT = 50.6292;
const BASE_LNG = 3.0573;
const DELTA = 0.01;
const SUB_ZONES = [];
for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
        SUB_ZONES.push({
            lat: BASE_LAT + (i * DELTA),
            lng: BASE_LNG + (j * DELTA)
        });
    }
}
const RADII = [1000, 2000];

// 1. Route pour récupérer et stocker les restaurants depuis Google uniquement
router.post('/updatePlaces', async (req, res) => {
    try {
        let allRestaurants = [];

        for (const zone of SUB_ZONES) {
            for (const radius of RADII) {
                let pageToken = '';
                do {
                    const baseUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${zone.lat},${zone.lng}&radius=${radius}&type=restaurant&key=${GOOGLE_API_KEY}`;
                    const url = pageToken ? `${baseUrl}&pagetoken=${pageToken}` : baseUrl;

                    const response = await fetch(url);
                    const data = await response.json();

                    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                        console.warn(`Google API response: ${data.status}`);
                        break;
                    }

                 // Filtre sur rating et reviews
const goodRestaurants = (data.results || []).filter(place =>
    place.rating >= 4 && place.user_ratings_total >= 200
);

// Définir les catégories indésirables en dehors du filtre
const unwantedCategories = ["movie_theater", "casino", "lodging"];

// Filtrer les restaurants pour retirer ceux avec des catégories indésirables
const filteredRestaurants = goodRestaurants.filter(place => {
    const placeCategories = place.types || [];
    return !unwantedCategories.some(cat => placeCategories.includes(cat));
});

// Maintenant, utilisez filteredRestaurants pour l’enregistrement en base :
for (const place of filteredRestaurants) {
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,opening_hours&key=${GOOGLE_API_KEY}`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

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
        },
        { upsert: true, new: true }
    );
}


                    allRestaurants = [...allRestaurants, ...filteredRestaurants];
                    pageToken = data.next_page_token;
                    if (pageToken) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } while (pageToken);
            }
        }

        const uniqueCount = new Set(allRestaurants.map(r => r.place_id)).size;

        res.json({
            success: true,
            message: `Fetched and stored ${uniqueCount} unique restaurants from Google only.`
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 2. Route pour enrichir les restaurants existants en base avec Yelp
router.post('/enrichWithYelp', async (req, res) => {
    try {
        const places = await Place.find();
        let enrichedCount = 0;
        let nullCount = 0;

        for (const place of places) {
            // Récupérer les catégories Yelp
            const categories = await getRestaurantCategoriesFromYelp(
                place.name,
                place.address?.street || '',
                place.address?.city || 'Lille',
                "59000"
            );
            const type = categories.length > 0 ? categories.join(', ') : null;

            if (type) {
                await Place.findOneAndUpdate(
                    { place_id: place.place_id },
                    { type },
                    { new: true }
                );
                enrichedCount++;
            } else {
                nullCount++;
            }
        }

        res.json({
            success: true,
            message: "Enriched restaurants with Yelp data.",
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
            place_id: place.place_id,
            name: place.name,
            address: place.address?.street,
            rating: place.rating,
            photo: place.photo_reference
                ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photo_reference}&key=${GOOGLE_API_KEY}`
                : 'placeholder_url',
            phoneNumber: place.phone,
            location : place.location,
            openingHours: place.openingHours,
            categories: place.categories,
            type: place.type
        }));

        res.json(formattedPlaces);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
