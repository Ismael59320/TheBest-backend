const express = require('express');
const router = express.Router();
require('dotenv').config();

const GOOGLE_API_KEY = process.env.API_KEY;
const LILLE_COORDINATES = { lat: 50.6292, lng: 3.0573 };

// Fonction pour récupérer les restaurants à proximité
async function findNearbyRestaurants() {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${LILLE_COORDINATES.lat},${LILLE_COORDINATES.lng}&radius=1500&type=restaurant&key=${GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        return data.results
            .sort((a, b) => b.rating - a.rating) // Trier par note
            .slice(0, 5); // Limiter à 5 établissements
    } catch (error) {
        console.error('Erreur lors de la récupération des restaurants:', error);
        throw error;
    }
}

// Fonction pour récupérer le numéro de téléphone pour un restaurant
async function getRestaurantDetails(placeId) {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number&key=${GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        return data.result?.formatted_phone_number || 'Non disponible';
    } catch (error) {
        console.error('Erreur lors de la récupération des détails:', error);
        return 'Non disponible';
    }
}

// Route pour récupérer les restaurants enrichis avec les numéros de téléphone
router.get('/findNearbyRestaurants', async (req, res) => {
    try {
        // 1. Récupérer les restaurants
        const restaurants = await findNearbyRestaurants();

        // 2. Ajouter le numéro de téléphone pour chaque restaurant
        const enrichedRestaurants = await Promise.all(
            restaurants.map(async (place) => {
                const phoneNumber = await getRestaurantDetails(place.place_id);
                return {
                    id: place.place_id,
                    name: place.name,
                    address: place.vicinity,
                    rating: place.rating || 0,
                    photo: place.photos
                        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
                        : 'placeholder_url',
                    phoneNumber, // Ajouter le numéro de téléphone ici
                };
            })
        );

        // 3. Retourner les résultats enrichis
        res.json(enrichedRestaurants);
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
