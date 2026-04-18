const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const router = express.Router();

// Helper: retry a fetch up to `retries` times
async function fetchWithRetry(url, retries = 3, delayMs = 1000) {
    for (let i = 0; i < retries; i++) {
        const response = await fetch(url);
        if (response.ok) return response;

        const isLastAttempt = i === retries - 1;
        if (isLastAttempt) return response; // return the failed response on last try

        console.warn(`⚠️ Attempt ${i + 1} failed (${response.status}), retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
    }
}

router.get("/", async (req, res) => {
    const { q, startIndex = 0, maxResults = 10 } = req.query;

    if (!q) return res.status(400).json({ error: "Query parameter 'q' is required" });
    if (!process.env.GOOGLE_API_URL) return res.status(500).json({ error: 'GOOGLE_API_URL not configured' });
    if (!process.env.GOOGLE_API_KEY) return res.status(500).json({ error: 'GOOGLE_API_KEY not configured' });

    try {
        const url = `${process.env.GOOGLE_API_URL}?q=${encodeURIComponent(q)}&startIndex=${startIndex}&maxResults=${maxResults}&key=${process.env.GOOGLE_API_KEY}`;
        const response = await fetchWithRetry(url, 3, 1000);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`❌ Google Books API error ${response.status}:`, errorBody);
            return res.status(response.status).json({ error: 'Google Books API error', status: response.status, detail: errorBody });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("❌ Error fetching books:", error.message);
        res.status(500).json({ error: "Error fetching books", detail: error.message });
    }
});

router.get("/category/:category", async (req, res) => {
    const { category } = req.params;
    const { startIndex = 0, maxResults = 10 } = req.query;

    try {
        const url = `${process.env.GOOGLE_API_URL}?q=subject:${encodeURIComponent(category)}&startIndex=${startIndex}&maxResults=${maxResults}&key=${process.env.GOOGLE_API_KEY}`;
        const response = await fetchWithRetry(url, 3, 1000);

        if (!response.ok) {
            const errorBody = await response.text();
            return res.status(response.status).json({ error: 'Google Books API error', status: response.status, detail: errorBody });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error fetching category books:", error.message);
        res.status(500).json({ error: "Error fetching category books", detail: error.message });
    }
});

// Get single book by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Fetching book with ID:', id); // Debug log

        const url = `https://www.googleapis.com/books/v1/volumes/${id}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Google Books API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Book data received:', data.volumeInfo?.title); // Debug log

        res.json(data);
    } catch (error) {
        console.error('Error fetching book:', error);
        res.status(500).json({ error: 'Failed to fetch book details' });
    }
});

module.exports = router;
