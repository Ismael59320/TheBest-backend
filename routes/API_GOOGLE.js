// Importation des modules nécessaires
const express = require('express');
const router = express.Router();
const Place = require('../models/place');

// Définition des clés API pour Google et Yelp
const GOOGLE_API_KEY = process.env.API_KEY;
const YELP_API_KEY = process.env.YELP_API_KEY;
const YELP_HEADERS = {
    "Authorization": `Bearer ${YELP_API_KEY}`
};

// Fonction pour récupérer les 20 derniers avis en français
async function getAllReviews(placeId) {
    let allReviews = [];
    let nextPageToken = '';

    // Boucle pour récupérer jusqu'à 4 pages d'avis
    for (let i = 0; i < 4 && (i === 0 || nextPageToken); i++) {
        // Construction de l'URL pour la requête à l'API Google Places
        const pageUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&reviews_sort=newest&language=fr${nextPageToken ? `&pagetoken=${nextPageToken}` : ''}&key=${GOOGLE_API_KEY}`;

        // Envoi de la requête et attente de la réponse
        const response = await fetch(pageUrl);
        const data = await response.json();

        // Ajout des avis récupérés à la liste
        if (data.result?.reviews) {
            allReviews = [...allReviews, ...data.result.reviews];
        }

        // Récupération du token pour la page suivante
        nextPageToken = data.next_page_token;
        if (nextPageToken) {
            // Attente de 2 secondes entre chaque requête (exigence de Google)
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Retourne les 20 premiers avis
    return allReviews.slice(0, 20);
}

// Fonction pour normaliser une adresse
function normalizeAddress(address) {
    if (!address) return '';
    return address
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Supprime les accents
        .replace(/,/g, '') // Supprime les virgules
        .replace(/\s+/g, ' ') // Remplace les espaces multiples par un seul espace
        .trim(); // Supprime les espaces au début et à la fin
}

// Fonction pour récupérer les catégories d'un restaurant depuis Yelp
async function getRestaurantCategoriesFromYelp(name, street, city, postalCode = '59000', phone) {
    try {
        // Si un numéro de téléphone est disponible, on essaie d'abord de chercher par téléphone
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

        // Si la recherche par téléphone n'a pas fonctionné, on cherche par adresse
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

// Définition des coordonnées de base et des sous-zones pour la recherche
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

// Route pour mettre à jour les restaurants
router.post('/updatePlaces', async (req, res) => {
    try {
        let allRestaurants = [];

        // Parcours de chaque sous-zone et rayon
        for (const zone of SUB_ZONES) {
            for (const radius of RADII) {
                let pageToken = '';
                do {
                    // Construction de l'URL pour la requête à l'API Google Places
                    const baseUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${zone.lat},${zone.lng}&radius=${radius}&type=restaurant&key=${GOOGLE_API_KEY}`;
                    const url = pageToken ? `${baseUrl}&pagetoken=${pageToken}` : baseUrl;

                    // Envoi de la requête et attente de la réponse
                    const response = await fetch(url);
                    const data = await response.json();

                    // Vérification du statut de la réponse
                    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                        console.warn(`Google API response: ${data.status}`);
                        break;
                    }

                    // Filtrage des restaurants avec une note >= 4 et au moins 200 avis
                    const goodRestaurants = (data.results || []).filter(place =>
                        place.rating >= 4 && place.user_ratings_total >= 200
                    );

                    // Exclusion de certaines catégories
                    const unwantedCategories = ["movie_theater", "casino", "lodging"];
                    const filteredRestaurants = goodRestaurants.filter(place => {
                        const placeCategories = place.types || [];
                        return !unwantedCategories.some(cat => placeCategories.includes(cat));
                    });

                    // Pour chaque restaurant filtré
                    for (const place of filteredRestaurants) {
                        // Récupération des détails supplémentaires (numéro de téléphone, horaires d'ouverture)
                        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,opening_hours&key=${GOOGLE_API_KEY}`;
                        const detailsResponse = await fetch(detailsUrl);
                        const detailsData = await detailsResponse.json();

                        // Récupération des 20 derniers avis en français
                        const reviews = await getAllReviews(place.place_id);

                        // Formatage des avis
                        const formattedReviews = reviews.map(review => ({
                            author_name: review.author_name,
                            rating: review.rating,
                            text: review.text,
                            time: new Date(review.time * 1000),
                            profile_photo_url: review.profile_photo_url
                        }));

                        // Mise à jour ou création du restaurant dans la base de données
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
                                reviews: formattedReviews
                            },
                            { upsert: true, new: true }
                        );
                    }

                    // Ajout des restaurants filtrés à la liste globale
                    allRestaurants = [...allRestaurants, ...filteredRestaurants];
                    pageToken = data.next_page_token;
                    if (pageToken) {
                        // Attente de 2 secondes entre chaque requête (exigence de Google)
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } while (pageToken);
            }
        }

        // Calcul du nombre de restaurants uniques
        const uniqueCount = new Set(allRestaurants.map(r => r.place_id)).size;

        // Envoi de la réponse
        res.json({
            success: true,
            message: `Fetched and stored ${uniqueCount} unique restaurants with their 20 most recent reviews in French.`
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route pour enrichir les données des restaurants avec Yelp
router.post('/enrichWithYelp', async (req, res) => {
    try {
        const places = await Place.find();
        let enrichedCount = 0;
        let nullCount = 0;

        // Pour chaque restaurant
        for (const place of places) {
            // Récupération des catégories depuis Yelp
            const categories = await getRestaurantCategoriesFromYelp(
                place.name,
                place.address?.street || '',
                place.address?.city || 'Lille',
                "59000",
                place.phone
            );

            const type = categories.length > 0 ? categories.join(', ') : null;

            if (type) {
                // Mise à jour du type dans la base de données
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

        // Envoi de la réponse
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

// Route pour trouver les restaurants à proximité
router.get('/findNearbyRestaurants', async (req, res) => {
    try {
        // Récupération des 5 meilleurs restaurants (triés par note et nombre d'avis)
        const places = await Place.find()
            .sort({ rating: -1, review_count: -1 })
            .limit(5);

        if (!places || places.length === 0) {
            return res.status(404).json({ message: "No restaurants found" });
        }

        // Formatage des données des restaurants
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
            // Récupération des 5 avis les plus récents
            reviews: (place.reviews || [])
                .sort((a, b) => b.time - a.time)
                .slice(0, 5)
                .map(review => ({
                    author: review.author_name,
                    rating: review.rating,
                    text: review.text,
                    date: review.time,
                    profilePhoto: review.profile_photo_url
                }))
        }));

        // Envoi de la réponse
        res.json(formattedPlaces);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route pour trouver les restaurants par catégorie
router.get('/findRestaurantsByCategory', async (req, res) => {
    try {
        const { category, city } = req.query;

        if (!category && !city) {
            return res.status(400).json({ message: "At least one of category or city is required" });
        }

        // Mapping des catégories
        const categoryMapping = {
            'Asiatique': ['Asian', "Asiatique", 'Japanese', 'chinese', 'thai', 'Vietnamese', 'sushi', 'pan asian'],
            'Italien': ['Italian', 'Pizza', 'pasta'],
            'Fast food': ['fast food', 'Burgers', 'Sandwich', 'quick', 'Kebab'],
            'Gastronomique': ['gastronomic', 'Gastronomique', 'French', 'fine dining', 'gourmet', "French"]
        };

        let query = {};

        // Construction de la requête en fonction de la catégorie et de la ville
        if (category) {
            const keywords = categoryMapping[category];
            if (!keywords) {
                return res.status(400).json({ message: "Invalid category" });
            }
            query.type = { $regex: keywords.join('|'), $options: 'i' };
        }

        if (city) {
            query['address.city'] = { $regex: new RegExp(city, 'i') };
        }

        // Recherche des restaurants correspondants
        const places = await Place.find(query)
            .sort({ rating: -1, review_count: -1 })
            .limit(5);

        if (!places || places.length === 0) {
            return res.status(404).json({
                message: `No restaurants found for the given criteria`
            });
        }

        // Formatage des données des restaurants
        
        const formattedPlaces = places.map(place => ({
            place_id: place.place_id,
            name: place.name,
            address: place.address?.street,
            city: place.address?.city,
            rating: place.rating,
            photo: place.photo_reference
                ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photo_reference}&key=${process.env.API_KEY}`
                : 'placeholder_url',
            phoneNumber: place.phone,
            location: place.location,
            openingHours: place.openingHours,
            categories: place.categories,
            type: place.type,
            reviews: (place.reviews || [])
                .sort((a, b) => b.time - a.time)
                .slice(0, 5)
                .map(review => ({
                    author: review.author_name,
                    rating: review.rating,
                    text: review.text,
                    date: review.time,
                    profilePhoto: review.profile_photo_url
                }))
        }));

        // Envoi de la réponse
        res.json(formattedPlaces);
    } catch (error) {
        console.error('Error in findRestaurantsByCategory:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route POST : Met à jour les photos pour tous les restaurants
router.post('/fetchPhotosForRestaurant', async (req, res) => {
    try {
        const places = await Place.find(); // Récupère tous les restaurants
        const updatedPlaces = [];

        for (const place of places) {
            // Requête pour obtenir les détails du lieu, y compris les photos
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,photos&key=${GOOGLE_API_KEY}`;
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();

            if (detailsData.status === 'OK') {
                const photos = detailsData.result.photos || [];
                // Filtre les photos pour ne garder que celles attribuées au restaurant
                const filteredPhotos = photos.filter(photo =>
                    photo.html_attributions &&
                    photo.html_attributions.some(attribution => attribution.includes(detailsData.result.name))
                );

                // Crée les URLs des photos
                const allPhotos = filteredPhotos.map(photo =>
                    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`
                );
                // Récupération des vidéos avec leurs thumbnails
                const videos = detailsData.result.videos || [];
                const videoData = videos.map(video => ({
                    url: video.url,
                    thumbnail: video.thumbnail_url
                }));
                // Mise à jour du champ `all_photos` dans la DB
                await Place.findOneAndUpdate(
                    { place_id: place.place_id },
                    {
                    $set: { all_photos: allPhotos,
                    videos: videoData }
                    },
                    { new: true }
                );

                updatedPlaces.push(place.place_id);
            }

            // Délai pour respecter les limites de l'API Google
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        res.json({
            success: true,
            message: `Updated photos for ${updatedPlaces.length} restaurants`,
            updatedPlaces,
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route GET : Récupère les informations d'un restaurant spécifique
router.get('/restaurant/:place_id', async (req, res) => {
    const { place_id } = req.params;

    try {
        // Recherche dans la base de données
        const place = await Place.findOne({ place_id });

        if (!place) {
            return res.status(404).json({
                success: false,
                message: "Restaurant non trouvé.",
            });
        }

        // Retourne les données du restaurant
        res.json({
            success: true,
            data: place,
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
        res.status(500).json({
            success: false,
            message: "Erreur interne du serveur.",
        });
    }
});

module.exports = router;