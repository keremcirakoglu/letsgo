require("dotenv").config();
const express = require("express");
const cors = require("cors");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const fetch = require("node-fetch");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Görsel yükleme
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/images"),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Veritabanı
const adapter = new FileSync("db.json");
const db = low(adapter);
db.defaults({ products: [] }).write();

app.get("/products", (req, res) => {
  const tag = req.query.tag;
  let products = db.get("products").value();

  if (tag) {
    products = products.filter((p) => p.category === tag);
  }

  res.json(products);
});

// Ürün ekleme
app.post("/products", async (req, res) => {
  const { name, price, description } = req.body;
  const image = "/images/template.png"; // sabit görsel, kullanıcı yükleyemez

  try {
    const tagRes = await fetch("http://localhost:3000/tagify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    const tagData = await tagRes.json();
    const category = tagData.tag || "belirsiz";

    const product = {
      name,
      price: Number(price),
      description,
      category,
      image,
    };

    db.get("products").push(product).write();
    res.status(201).json({ message: "Ürün başarıyla eklendi." });
  } catch (error) {
    console.error("Ürün eklenemedi:", error);
    res.status(500).json({ error: "Ürün kaydı başarısız." });
  }
});

// AI Etiket oluşturma
app.post("/tagify", async (req, res) => {
  const { name, description } = req.body;

  const prompt = `
Aşağıdaki ürün adı ve açıklamaya göre, sadece MARKA ve MODEL içeren sade bir kategori etiketi üret.

- Ürün adı: ${name}
- Açıklama: ${description}

Kurallar:
- Küçük harf kullan
- Sadece harf ve rakam içersin (boşluk, sembol, özel karakter yok)
- Kısa ve sade bir marka_model formatı döndür ("iphone11", "galaxys22")
- Sadece TEK bir kelime döndür
- Yanıtını sadece bu kategori etiketi olarak ver
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
    const tag = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!tag || tag.length < 3) {
      return res.json({
        tag: name.toLowerCase().replace(/\s+/g, "") + "_manual",
      });
    }

    res.json({ tag });
  } catch (error) {
    console.error("Gemini API hatası:", error);
    res.status(500).json({ error: "Etiket üretilemedi." });
  }
});

// Ortalama fiyat
app.get("/average", (req, res) => {
  const category = req.query.category;
  if (!category) {
    return res.status(400).json({ error: "category parametresi gerekli." });
  }
  const items = db.get("products").filter({ category }).value();
  const avg =
    items.reduce((sum, item) => sum + Number(item.price), 0) / items.length ||
    0;
  res.json({ category, average: avg.toFixed(2) });
});

// AI Fiyat tahmini
app.post("/suggest-price", async (req, res) => {
  const { name, description } = req.body;
  const allProducts = db.get("products").value();
  const similarProducts = allProducts
    .filter(
      (p) =>
        p.name.toLowerCase().includes(name.toLowerCase()) ||
        (description && p.category && p.category.includes(name.toLowerCase()))
    )
    .slice(0, 5);

  const sampleData = similarProducts
    .map((p) => `${p.name} - ${p.price}₺`)
    .join("\n");

  const prompt = `
Elindeki ikinci el ürün örneklerinden yola çıkarak, yeni ürün için mantıklı ve gerçekçi bir fiyat tahmini yap.

Kurallar:
- 1₺, 11₺, 911₺ gibi saçma veya ürün model numarasıyla karışabilecek sayılar ÖNERME.
- Fiyat gerçek piyasa değerine uygun olmalı.
- Ürün açıklamasındaki sayılara aldanma.
- Sadece fiyat olarak bir sayı (₺ olmadan) ver. Örn: 6250
- Ondalık kullanma, tam sayı ver.
- Minimum 100₺ olmalı.

Benzer ürünler:
${sampleData}

Yeni ürün: ${name} - ${description}
Fiyat önerin nedir?
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
    const raw = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = raw.match(/\d+(\.\d+)?/);
    const suggested = match ? parseFloat(match[0]) : null;

    if (suggested) {
      res.json({ price: suggested });
    } else {
      res.status(400).json({ error: "Fiyat tahmini yapılamadı." });
    }
  } catch (err) {
    console.error("Fiyat önerisi hatası:", err);
    res.status(500).json({ error: "AI fiyat önerisi başarısız." });
  }
});

/*
// Ürün silme
app.delete("/products/:id", (req, res) => {
  const id = req.params.id;
  const current = db.get("products").value();
  const updated = current.filter((_, i) => i.toString() !== id);
  db.set("products", updated).write();
  res.json({ message: "Ürün silindi." });
});
*/

app.listen(PORT, () => {
  console.log(`✅ API çalışıyor: http://localhost:${PORT}`);
});
