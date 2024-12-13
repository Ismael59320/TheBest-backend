// require("dotenv").config()

const GOOGLE_SEARCH_API_KEY = "AIzaSyD-j0FOhrEAFaPILlA1IxFdpCM6q62j2l0";
const SEARCH_ENGINE_ID = 'a65294144259b4840';

async function findRestaurantInstagram(restaurantName) {
    try {
        // 1. Recherche du site officiel
        console.log("Recherche du site officiel...");
        const searchQuery = `${restaurantName} site officiel`;
        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(searchQuery)}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        // Afficher la réponse complète pour debug
        console.log("Réponse de l'API Google:", JSON.stringify(data, null, 2));
        
        if (!data.items || data.items.length === 0) {
            console.log("Aucun site officiel trouvé");
            return null;
        }
        
        const officialSite = data.items[0].link;
        console.log("Site officiel trouvé:", officialSite);
        
        // 2. Scraping du site
        console.log("\nScraping du site...");
        const siteResponse = await fetch(officialSite);
        const html = await siteResponse.text();
        
        // 3. Recherche du lien Instagram
        const instagramRegex = /(?:https?:)?\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_](?:(?:[A-Za-z0-9_]|(?:\.(?!\.))){0,28}(?:[A-Za-z0-9_]))?)/;
        const match = html.match(instagramRegex);
        
        if (match) {
            const handle = match[1];
            console.log("Handle Instagram trouvé:", handle);
            return {
                handle,
                url: `https://www.instagram.com/${handle}`,
                source: officialSite
            };
        }
        
        console.log("Aucun Instagram trouvé sur le site");
        return null;

    } catch (error) {
        console.error('Erreur détaillée:', error);
        return null;
    }
}

// Test
console.log("Démarrage du test...");
findRestaurantInstagram("Quai38")
    .then(result => {
        console.log("\nRésultat final:", result);
    })
    .catch(error => {
        console.error("\nErreur:", error);
    });

    module.exports = { findRestaurantInstagram };