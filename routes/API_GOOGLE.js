const express = require('express');
const router = express.Router();
const Place = require('../models/place');
const fetch = require('node-fetch');

const GOOGLE_API_KEY = process.env.API_KEY;
const YELP_API_KEY = process.env.YELP_API_KEY;
const YELP_HEADERS = {
    "Authorization": `Bearer ${YELP_API_KEY}`
};

// NOUVEAU: Fonction pour récupérer les 20 derniers avis en français
async function getAllReviews(placeId) {
    let allReviews = [];
    let nextPageToken = '';
    
    for (let i = 0; i < 4 && (i === 0 || nextPageToken); i++) {
        const pageUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&reviews_sort=newest&language=fr${nextPageToken ? `&pagetoken=${nextPageToken}` : ''}&key=${GOOGLE_API_KEY}`;
        
        const response = await fetch(pageUrl);
        const data = await response.json();
        
        if (data.result?.reviews) {
            allReviews = [...allReviews, ...data.result.reviews];
        }
        
        nextPageToken = data.next_page_token;
        if (nextPageToken) {
            // Délai requis par Google entre les requêtes
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    return allReviews.slice(0, 20);  // On s'assure d'avoir max 20 avis
}

// Fonctions utilitaires
function normalizeAddress(address) {
    if (!address) return '';
    return address
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/,/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function getRestaurantCategoriesFromYelp(name, street, city, postalCode = '59000', phone) {
    try {
        if (phone && phone !== 'Non disponible') {
            const phoneResponse = await fetch(
                `https://api.yelp.com/v3/businesses/search/phone?phone=+${phone}`,
                { headers: YELP_HEADERS }
            );

            const phoneData = await phoneResponse.json();
            console.log(phoneData)
            const business = phoneData.businesses?.find(b => b.display_phone === phone);
            if (business?.categories) {
                return business.categories.map(category => category.title);
            }
        }

        const normalizedStreet = normalizeAddress(street);
        const locationQuery = `${normalizedStreet}, ${city}, ${postalCode}`;
        const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(name)}&location=${encodeURIComponent(locationQuery)}&limit=1`;

        const response = await fetch(url, { headers: YELP_HEADERS });
        const data = await response.json();
        return data.businesses?.[0]?.categories?.map(category => category.title) || [];

    } catch (error) {
        console.error(`Error fetching Yelp categories for ${name}:`, error);
        return [];
    }
}

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

                    const goodRestaurants = (data.results || []).filter(place =>
                        place.rating >= 4 && place.user_ratings_total >= 200
                    );

                    const unwantedCategories = ["movie_theater", "casino", "lodging"];

                    const filteredRestaurants = goodRestaurants.filter(place => {
                        const placeCategories = place.types || [];
                        return !unwantedCategories.some(cat => placeCategories.includes(cat));
                    });

                    for (const place of filteredRestaurants) {
                        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,opening_hours&key=${GOOGLE_API_KEY}`;
                        const detailsResponse = await fetch(detailsUrl);
                        const detailsData = await detailsResponse.json();

                        // NOUVEAU: Utilisation de la fonction getAllReviews pour récupérer les 20 derniers avis en français
                        const reviews = await getAllReviews(place.place_id);

                        // NOUVEAU: Formatage des avis
                        const formattedReviews = reviews.map(review => ({
                            author_name: review.author_name,
                            rating: review.rating,
                            text: review.text,
                            time: new Date(review.time * 1000),
                            profile_photo_url: review.profile_photo_url
                        }));

                        await Place.findOneAndUpdate(
                            { place_id: place.place_id },
                            {
                                name: place.name,
                                phone: detailsData.result?.formatted_phone_number?.replace(/^0/, '+33 ') || 'Non disponible',
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
                                review: place.text,
                                review_count: place.user_ratings_total,
                                categories: place.types,
                                openingHours: detailsData.result?.opening_hours?.weekday_text || [],
                                // NOUVEAU: Sauvegarde des 20 avis formatés
                                reviews: formattedReviews
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
            // MODIFIÉ: Message mis à jour pour inclure l'info sur les avis
            message: `Fetched and stored ${uniqueCount} unique restaurants with their 20 most recent reviews in French.`
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/enrichWithYelp', async (req, res) => {
    try {
        const places = await Place.find();
        let enrichedCount = 0;
        let nullCount = 0;

        for (const place of places) {
            const categories = await getRestaurantCategoriesFromYelp(
                place.name,
                place.address?.street || '',
                place.address?.city || 'Lille',
                "59000",
                place.phone
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
            city: place.address?.city,
            rating: place.rating,
            photo: place.photo_reference
                ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photo_reference}&key=${GOOGLE_API_KEY}`
                : 'placeholder_url',
            phoneNumber: place.phone,
            location: place.location,
            openingHours: place.openingHours,
            categories: place.categories,
            type: place.type,
            // Ici, on revoie les 5 avis les plus recent au front
            reviews: (place.reviews || [])
                .sort((a, b) => b.time - a.time)  // Tri par date la plus récente
                .slice(0, 5)                      // Ne prend que les 5 premiers
                .map(review => ({
                    author: review.author_name,
                    rating: review.rating,
                    text: review.text,
                    date: review.time,
                    profilePhoto: review.profile_photo_url
                }))
        }));

        res.json(formattedPlaces);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/findRestaurantsByCategory', async (req, res) => {
    try {
        const { category } = req.query;
        
        if (!category) {
            return res.status(400).json({ message: "Category needed" });
        }

        const categoryMapping = {
            'Asiatique': ['Asian', "Asiatique", 'Japanese', 'chinese', 'thai', 'Vietnamese', 'sushi', 'pan asian'],
            'Italien': ['Italian', 'Pizza', 'pasta'],
            'Fast food': ['fast food', 'Burgers', 'Sandwich', 'quick', 'Kebab'],
            'Gastronomique': ['gastronomic','Gastronomique', 'French', 'fine dining', 'gourmet', "French"]
        };

        const keywords = categoryMapping[category];
        if (!keywords) {
            return res.status(400).json({ message: "Invalid category" });
        }

        const places = await Place.find({
            type: { $regex: keywords.join('|')}
        })
        .sort({ rating: -1, review_count: -1 })
        .limit(5);

        if (!places || places.length === 0) {
            return res.status(404).json({ 
                message: `Pas de best dans cette Categorie !: ${category}` 
            });
        }

        const formattedPlaces = places.map(place => ({
            place_id: place.place_id,
            name: place.name,
            address: place.address?.street,
            rating: place.rating,
            photo: place.photo_reference
                ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photo_reference}&key=${process.env.API_KEY}`
                : 'placeholder_url',
            phoneNumber: place.phone,
            location: place.location,
            openingHours: place.openingHours,
            categories: place.categories,
            type: place.type,
            //Même logique que findNearbyRestaurants pour les avis
            reviews: (place.reviews || [])
                .sort((a, b) => b.time - a.time)  // Tri par date la plus récente
                .slice(0, 5)                      // Ne prend que les 5 premiers
                .map(review => ({
                    author: review.author_name,
                    rating: review.rating,
                    text: review.text,
                    date: review.time,
                    profilePhoto: review.profile_photo_url
                }))
        }));

        res.json(formattedPlaces);
    } catch (error) {
        console.error('Error in findRestaurantsByCategory:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;