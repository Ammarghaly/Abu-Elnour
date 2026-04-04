import { db, ref, onValue, push, set, update, remove } from "./firebase.js";

const IMGBB_API_KEY = "21bebe487670b128922c3f919c20b059";
const ADMIN_PASS = "1234";
const defaultCategories = ["سندوتشات", "ميكسات", "إضافات"];

// DOM Elements
const authOverlay = document.getElementById('authOverlay');
const adminDashboard = document.getElementById('adminDashboard');
const loginBtn = document.getElementById('loginBtn');
const adminPassInput = document.getElementById('adminPass');

const productForm = document.getElementById('productForm');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const productsGrid = document.getElementById('adminProductsGrid');
const adminSearch = document.getElementById('adminSearch');

const pPrice = document.getElementById('pPrice');
const pCategorySelect = document.getElementById('pCategorySelect');
const openCatModal = document.getElementById('openCatModal');
const closeCatBtn = document.getElementById('closeCatBtn');
const saveCatBtn = document.getElementById('saveCatBtn');
const catModal = document.getElementById('catModal');
const newCatName = document.getElementById('newCatName');
const pImage = document.getElementById('pImage');
const previewBox = document.getElementById('previewBox');
const productIdInput = document.getElementById('productId');
const imageUrlInput = document.getElementById('imageUrl');

let isEditMode = false;
let currentProducts = [];
let addedCategories = []; // Categories added via popup but not yet in DB

// 1. Simple Authentication
loginBtn.onclick = () => {
  if (adminPassInput.value === ADMIN_PASS) {
    authOverlay.style.display = 'none';
    adminDashboard.style.display = 'block';
    init();
  } else {
    alert("الكود غير صحيح!");
  }
};

// 2. Main Logic Initialization
function init() {
  const productsRef = ref(db, "products");
  
  onValue(productsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const actualData = data.products ? data.products : data;
      currentProducts = Object.entries(actualData).map(([id, p]) => ({
        id,
        ...p
      })).reverse();
    } else {
      currentProducts = [];
    }
    updateCategorySelect();
    renderProducts();
  });
}

// 2.5 Dynamic Category List
function updateCategorySelect() {
  const currentVal = pCategorySelect.value;
  const categories = new Set([...defaultCategories, ...addedCategories]);
  
  currentProducts.forEach(p => {
    if (p.category) categories.add(p.category);
  });

  const sortedCategories = Array.from(categories).sort();
  
  pCategorySelect.innerHTML = '<option value="" disabled selected>اختر التصنيف...</option>';
  sortedCategories.forEach(cat => {
    pCategorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
  
  // Restore previous selection if it still exists
  if (currentVal && Array.from(pCategorySelect.options).some(o => o.value === currentVal)) {
    pCategorySelect.value = currentVal;
  }
}

// 3. Render Product List
function renderProducts() {
  const searchTerm = adminSearch ? adminSearch.value.toLowerCase() : '';
  productsGrid.innerHTML = '';
  
  const filteredProducts = currentProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm) || 
    p.category.toLowerCase().includes(searchTerm)
  );

  filteredProducts.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="card-img-wrapper">
        <div class="price-tag">${p.price} ج.م</div>
        <img src="${p.image}" class="card-img" alt="${p.name}">
      </div>
      <div class="card-body">
        <div class="card-cat">${p.category}</div>
        <div class="card-title">${p.name}</div>
        <div class="action-btns">
          <button class="btn btn-edit" onclick="window.editProduct('${p.id}')">تعديل</button>
          <button class="btn btn-danger" onclick="window.deleteProduct('${p.id}')">حذف</button>
        </div>
      </div>
    `;
    productsGrid.appendChild(card);
  });
}

// 4. Search & Category Implementation
if (adminSearch) {
  adminSearch.oninput = renderProducts;
}

// Category Modal Logic
if (openCatModal) {
  openCatModal.onclick = () => {
    catModal.classList.add('active');
    newCatName.focus();
  };
}

if (closeCatBtn) {
  closeCatBtn.onclick = () => {
    catModal.classList.remove('active');
    newCatName.value = '';
  };
}

if (saveCatBtn) {
  saveCatBtn.onclick = () => {
    const name = newCatName.value.trim();
    if (!name) return alert("يرجى كتابة اسم التصنيف!");
    
    if (!addedCategories.includes(name)) {
      addedCategories.push(name);
    }
    
    updateCategorySelect();
    pCategorySelect.value = name;
    
    catModal.classList.remove('active');
    newCatName.value = '';
  };
}

// 5. Image Handling (Compression + ImgBB)
pImage.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  submitBtn.disabled = true;
  submitBtn.innerText = "⏳ جاري رفع الصورة...";

  try {
    const compressedBase64 = await compressImage(file);
    const uploadedUrl = await uploadToImgBB(compressedBase64);
    
    imageUrlInput.value = uploadedUrl;
    previewBox.innerHTML = `<img src="${uploadedUrl}" />`;
    submitBtn.disabled = false;
    submitBtn.innerText = isEditMode ? "تحديث الطبق" : "حفظ الطبق";
  } catch (err) {
    alert("فشل رفع الصورة. حاول مرة أخرى.");
    console.error(err);
    submitBtn.disabled = false;
    submitBtn.innerText = isEditMode ? "تحديث الطبق" : "حفظ الطبق";
  }
};

function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadToImgBB(base64) {
  const body = new FormData();
  body.append('image', base64);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: body
  });
  const data = await res.json();
  if (data.success) return data.data.url;
  throw new Error("ImgBB Upload Failed");
}

// 6. Form Submission (Add/Edit)
productForm.onsubmit = async (e) => {
  e.preventDefault();
  
  const data = {
    name: pName.value.trim(),
    price: parseFloat(pPrice.value),
    category: pCategorySelect.value,
    image: imageUrlInput.value,
    updatedAt: new Date().toISOString()
  };

  if (!data.image) return alert("يرجى اختيار صورة للطبق!");

  submitBtn.disabled = true;
  submitBtn.innerText = "⏳ جاري الحفظ...";

  try {
    if (isEditMode) {
      const id = productIdInput.value;
      await update(ref(db, "products/" + id), data);
    } else {
      data.createdAt = new Date().toISOString();
      const newProductRef = push(ref(db, "products"));
      await set(newProductRef, data);
    }
    
    resetForm();
    alert("تم نجاح العملية!");
  } catch (err) {
    console.error("Realtime DB Error:", err);
    alert("حدث خطأ أثناء الحفظ.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "حفظ الطبق";
  }
};

// 7. Global Helper Functions
window.editProduct = (id) => {
  const p = currentProducts.find(x => x.id === id);
  if (!p) return;

  isEditMode = true;
  productIdInput.value = id;
  pName.value = p.name;
  pPrice.value = p.price;
  
  // Handle Category Select
  const options = Array.from(pCategorySelect.options).map(o => o.value);
  if (!options.includes(p.category)) {
    addedCategories.push(p.category);
    updateCategorySelect();
  }
  pCategorySelect.value = p.category;

  imageUrlInput.value = p.image;
  previewBox.innerHTML = `<img src="${p.image}" />`;
  
  document.getElementById('formTitle').innerText = "تعديل طبق: " + p.name;
  submitBtn.innerText = "تحديث الطبق";
  cancelBtn.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteProduct = async (id) => {
  if (!confirm("هل أنت متأكد من حذف هذا الطبق؟")) return;
  
  try {
    await remove(ref(db, "products/" + id));
  } catch (err) {
    alert("فشل الحذف.");
  }
};

cancelBtn.onclick = resetForm;

function resetForm() {
  productForm.reset();
  isEditMode = false;
  productIdInput.value = '';
  imageUrlInput.value = '';
  previewBox.innerHTML = '<span style="color: var(--text-muted);">المعاينة تظهر هنا</span>';
  document.getElementById('formTitle').innerText = "إضافة طبق جديد";
  submitBtn.innerText = "حفظ الطبق";
  cancelBtn.style.display = 'none';
}
