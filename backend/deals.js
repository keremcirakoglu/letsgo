require("dotenv").config();
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const fetch = require("node-fetch");

const adapter = new FileSync("db.json");
const db = low(adapter);

async function analyzeDealsForCategory(category, items) {
  if (items.length < 3) return [];

  const input = items
    .map(
      (item, index) =>
        `${index}. ${item.name} - ${item.price}₺ - ${item.description || ""}`
    )
    .join("\n");

  const prompt = `
Aşağıda aynı kategoriye ait ikinci el ürünler listelenmiştir. Fiyatları karşılaştır ve açıkça diğerlerine göre ucuz olanları seç.

Yanıt sadece aşağıdaki formatta olsun (örnek):
[0, 3, 5]

Ürünler:
${input}
  `;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const result = await response.json();
    const raw = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    const match = raw.match(/\[(.*?)\]/);
    if (!match) return [];

    const indices = match[1]
      .split(",")
      .map((i) => parseInt(i.trim()))
      .filter((i) => !isNaN(i));

    return indices;
  } catch (error) {
    console.error("Gemini API hatası:", error);
    return [];
  }
}

async function analyzeAllDeals() {
  const all = db.get("products").value();
  const byCategory = {};
  all.forEach((item) => {
    const cat = item.category || "belirsiz";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  });

  for (const [category, items] of Object.entries(byCategory)) {
    console.log(`🔍 Kategori: ${category} (${items.length} ürün)`);
    const deals = await analyzeDealsForCategory(category, items);

    items.forEach((item, index) => {
      item.isDeal = deals.includes(index);
    });
  }

  db.set("products", Object.values(byCategory).flat()).write();
  console.log("✅ Günlük fırsatlar analiz edildi ve kaydedildi.");
}

analyzeAllDeals();
