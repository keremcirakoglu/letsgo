const API = "https://letsgo-btkhackhathon25.onrender.com";

document
  .getElementById("product-form")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    await addProduct();
  });

function openModal() {
  document.getElementById("modal").style.display = "block";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

window.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeModal();
});

async function fetchProducts() {
  try {
    const res = await fetch(`${API}/products`);
    const data = await res.json();
    const container = document.getElementById("product-list");
    container.innerHTML = "";

    if (!data.length) {
      container.innerHTML = "<p>Henüz ürün yok.</p>";
      return;
    }

    // Kategori başına ortalama fiyat
    const tags = [...new Set(data.map((p) => p.category || "belirsiz"))];
    const avgMap = {};

    await Promise.all(
      tags.map(async (tag) => {
        try {
          const res = await fetch(
            `${API}/average?category=${encodeURIComponent(tag)}`
          );
          const json = await res.json();
          avgMap[tag] = Number(json.average) || 0;
        } catch {
          avgMap[tag] = 0;
        }
      })
    );

    // Ürünleri oluştur
    data.forEach((p, index) => {
      const isDeal = Number(p.price) < avgMap[p.category] - 1;
      const imgSrc = p.image || "/images/template.png";

      const div = document.createElement("div");
      div.className = isDeal ? "product-card deal" : "product-card";
      div.innerHTML = `
  <img src="${imgSrc}" alt="Ürün Fotoğrafı">
  <div class="info">
    <strong>${p.name}</strong>
    <div class="price">${p.price}₺</div>
    <div class="desc">${p.description}</div>
   <!-- <div><small>Etiket: ${p.category}</small></div> -->
    ${isDeal ? '<span class="badge">Fırsat!</span>' : ""}
  </div>
`;

      container.appendChild(div);
    });

    // Kategori barını oluştur
    renderCategoryBar(data);
  } catch (error) {
    console.error("Ürünleri getirme hatası:", error);
    document.getElementById("product-list").innerHTML =
      "<p>Ürünler yüklenemedi.</p>";
  }
}

async function addProduct() {
  const name = document.getElementById("name").value;
  const price = parseFloat(document.getElementById("price").value);
  const description = document.getElementById("description").value;
  const imageInput = document.getElementById("image");

  if (!name || !price || !description) {
    alert("Tüm alanları doldurun.");
    return;
  }

const data = { name, price, description };

const res = await fetch(`${API}/products`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});


  if (imageInput.files.length > 0) {
    formData.append("image", imageInput.files[0]);
  }

  try {
    const res = await fetch(`${API}/products`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Ürün eklenemedi.");
    document.getElementById("product-form").reset();
    fetchProducts();
  } catch (err) {
    console.error(err);
    alert("Ürün eklenirken hata oluştu.");
  }
}

async function getSuggestedPrice() {
  const name = document.getElementById("name").value;
  const description = document.getElementById("description").value;
  const button = document.querySelector(
    "button[onclick='getSuggestedPrice()']"
  );
  const originalText = button.textContent;

  if (!name || !description) {
    alert("Lütfen ürün adı ve açıklamasını girin.");
    return;
  }

  button.disabled = true;
  button.innerHTML = "🔍 Tahmin ediliyor...";

  try {
    const res = await fetch(`${API}/suggest-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    const data = await res.json();

    if (data.price) {
      document.getElementById("price").value = data.price;
    } else {
      alert("AI fiyat önerisi alınamadı.");
    }
  } catch (err) {
    alert("Fiyat önerisi sırasında hata oluştu.");
    console.error(err);
  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

/*
async function deleteProduct(id) {
  if (!confirm("Bu ürünü silmek istiyor musunuz?")) return;

  await fetch(`${API}/products/${id}`, {
    method: "DELETE",
  });

  fetchProducts();
}
*/

function renderCategoryBar(products) {
  const container = document.getElementById("category-bar");
  if (!container) return;

  container.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.textContent = "Tüm Ürünler 📦";
  allBtn.onclick = () => fetchProducts();

  allBtn.style.backgroundColor = "#ffffff";
  allBtn.style.border = "2px solid #ccc";
  allBtn.style.fontWeight = "bold";
  allBtn.style.color = "#333";
  container.appendChild(allBtn);

  const dealsBtn = document.createElement("button");
  dealsBtn.textContent = "Bütün Fırsatlar 🟢";
  dealsBtn.onclick = () => filterByCategory("fırsatlar");
  container.appendChild(dealsBtn);

  dealsBtn.style.backgroundColor = "#ffffff";
  dealsBtn.style.border = "2px solid #ccc";
  dealsBtn.style.fontWeight = "bold";
  dealsBtn.style.color = "#333";

  const separator = document.createElement("span");
  separator.textContent = " | ";
  separator.style.margin = "0 16px";
  separator.style.color = "#999";
  separator.style.fontWeight = "bold";
  separator.style.fontSize = "1.2rem";
  separator.style.display = "inline-block";
  separator.style.lineHeight = "2.5rem";
  container.appendChild(separator);

  // Sadece %30+ fırsat oranı olan kategoriler
  const categories = [...new Set(products.map((p) => p.category))];
  categories.forEach((cat) => {
    const items = products.filter((p) => p.category === cat);
    const avg =
      items.reduce((sum, p) => sum + Number(p.price), 0) / items.length;
    const dealCount = items.filter((p) => Number(p.price) < avg - 1).length;
    const dealRatio = dealCount / items.length;

    if (dealRatio >= 0.3) {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      const btn = document.createElement("button");
      btn.textContent = label + " 🟢";
      btn.onclick = () => filterByCategory(cat);
      container.appendChild(btn);
    }
  });
}

async function filterByCategory(tag) {
  try {
    const url =
      tag === "bütün"
        ? `${API}/products`
        : `${API}/products${
            tag !== "fırsatlar" ? `?tag=${encodeURIComponent(tag)}` : ""
          }`;
    const res = await fetch(url);
    const data = await res.json();
    const container = document.getElementById("product-list");
    container.innerHTML = "";

    if (!data.length) {
      container.innerHTML = `<p>Ürün bulunamadı.</p>`;
      return;
    }

    const categories = [...new Set(data.map((p) => p.category || "belirsiz"))];
    const avgMap = {};

    await Promise.all(
      categories.map(async (cat) => {
        try {
          const res = await fetch(
            `${API}/average?category=${encodeURIComponent(cat)}`
          );
          const json = await res.json();
          avgMap[cat] = Number(json.average) || 0;
        } catch {
          avgMap[cat] = 0;
        }
      })
    );

    let filteredProducts = data;

    if (tag === "fırsatlar") {
      filteredProducts = data.filter((p) => {
        const avg = avgMap[p.category];
        return avg && Number(p.price) < avg - 1;
      });
    } else if (tag !== "bütün") {
      filteredProducts = data.filter((p) => {
        const avg = avgMap[p.category];
        return p.category === tag && Number(p.price) < avg - 1;
      });
    }

    if (!filteredProducts.length) {
      container.innerHTML = `<p>Fırsat ürünü bulunamadı.</p>`;
      return;
    }

    filteredProducts.forEach((p, index) => {
      const imgSrc = p.image || "/images/template.png";
      const isDeal = Number(p.price) < avgMap[p.category] - 1;
      const div = document.createElement("div");
      div.className = isDeal ? "product-card deal" : "product-card";
      div.innerHTML = `
  <img src="${imgSrc}" alt="Ürün Fotoğrafı">
  <div class="info">
    <strong>${p.name}</strong>
    <div class="price">${p.price}₺</div>
    <div><small>${p.description}</small></div>
    <span class="badge">Fırsat!</span>
  </div>
`;

      container.appendChild(div);
    });
  } catch (error) {
    console.error("Kategori filtreleme hatası:", error);
    document.getElementById(
      "product-list"
    ).innerHTML = `<p>Ürünler yüklenemedi.</p>`;
  }
}

fetchProducts();
