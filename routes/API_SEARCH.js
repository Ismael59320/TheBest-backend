// const express = require('express');
// const router = express.Router();
// const GOOGLE_SEARCH_API_KEY = process.env.API_KEY;
// const SEARCH_ENGINE_ID = 'a65294144259b4840'

// async function googleSearch(searchQuery) {
//   const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(searchQuery)}`;

//   try {
//     const response = await fetch(url);
//     const data = await response.json();
//     return data.items; 
//   } catch (error) {
//     console.error('Erreur lors de la recherche:', error);
  
//   }
// }


// googleSearch("Quai38 instagram")
//   .then(results => {
//     console.log(results);
//   })


const express = require('express');
const router = express.Router();
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const SEARCH_ENGINE_ID = 'a65294144259b4840';

async function findInstagramHandle(restaurantName) {
    const searchQuery = `${restaurantName} instagram`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(searchQuery)}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            return null;
        }

        // Filtrer les résultats pour ne garder que les liens Instagram
        const instagramResults = data.items.filter(item => 
            item.link.includes('instagram.com/') && !item.link.includes('/explore/')
        );

        if (instagramResults.length === 0) {
            return null;
        }

        // Prendre le premier résultat Instagram
        const instagramUrl = instagramResults[0].link;
        
        // Extraire le handle du lien Instagram
        // Exemple : https://www.instagram.com/lequai38lille/?hl=en → lequai38lille
        const handle = instagramUrl
            .split('instagram.com/')[1] // Prend tout après instagram.com/
            .split('/')[0] // Prend la première partie avant un éventuel /
            .split('?')[0]; // Enlève les paramètres d'URL

        return {
            handle: handle || null,
            url: instagramUrl,
            title: instagramResults[0].title || null
        };

    } catch (error) {
        console.error('Erreur:', error);
        return null;
    }
}

// Test
findInstagramHandle("Quai38")
    .then(result => {
        console.log("Résultat:", result);
    });