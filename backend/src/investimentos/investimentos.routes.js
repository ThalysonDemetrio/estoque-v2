const express = require("express");
const router = express.Router();
const { query } = require("../db");

/**
 * GET /api/investimentos/comparativo?q=modelo+marca
 * Busca preços no Google Shopping via SerpAPI
 */
router.get("/comparativo", async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 3) {
    return res.status(400).json({ success: false, message: "Parâmetro de busca 'q' é obrigatório (mínimo 3 caracteres)." });
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return res.status(503).json({ success: false, message: "SERPAPI_KEY não configurada no ambiente." });
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      engine: "google_shopping",
      q: q.toString(),
      gl: "br",
      hl: "pt",
      google_domain: process.env.SERPAPI_GOOGLE_DOMAIN || "google.com.br",
      location: process.env.SERPAPI_LOCATION || "Brazil",
      num: "10",
      currency: "BRL",
    });

    const response = await fetch(`https://serpapi.com/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`SerpAPI responded with status ${response.status}`);
    }

    const data = await response.json();
    const allowedStores = [
      "amazon", "magazine luiza", "magalu", "mercado livre", "kabum", 
      "pichau", "shopee", "shoppe", "casas bahia", "kalunga", "miranda", "aliexpress"
    ];

    const results = (data.shopping_results || [])
      .filter((item) => {
        const source = (item.source || "").toLowerCase();
        return allowedStores.some(store => source.includes(store));
      })
      .map((item) => {
        let link = item.link || item.product_link || item.serpapi_link || "#";
        if (link !== "#" && !link.startsWith("http")) {
          link = `https://${link}`;
        }
        return {
          titulo: item.title,
          preco: item.price,
          preco_numerico: parseFloat((item.price || "0").replace(/[^\d,]/g, "").replace(",", ".")) || null,
          loja: item.source,
          link: link,
          thumbnail: item.thumbnail,
          avaliacao: item.rating,
          num_avaliacoes: item.reviews,
          entrega: item.delivery,
        };
      });

    // Ordena por preço
    results.sort((a, b) => (a.preco_numerico || 9999999) - (b.preco_numerico || 9999999));

    return res.json({ success: true, data: results, query: q, total: results.length });
  } catch (err) {
    console.error("Erro na busca SERPAPI:", err);
    return res.status(500).json({ success: false, message: "Erro ao buscar preços. Verifique a chave SERPAPI.", error: err.message });
  }
});

/**
 * GET /api/investimentos/comparativo/sugestoes
 * Retorna lista de modelos do inventário para sugestões de busca
 */
router.get("/comparativo/sugestoes", async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT DISTINCT TRIM(marca || ' ' || modelo) AS sugestao, COUNT(*) AS qtd
      FROM equipamentos
      WHERE marca IS NOT NULL AND modelo IS NOT NULL
      GROUP BY marca, modelo
      ORDER BY qtd DESC
      LIMIT 20
    `);
    return res.json({ success: true, data: rows.map(r => r.sugestao) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
