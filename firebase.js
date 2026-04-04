import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, onValue, set, push, update, remove, query, orderByChild } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDyAt8dWbCdUoqhQSAOqpSX8rGE5PMgY-A",
  authDomain: "menu-a787f.firebaseapp.com",
  projectId: "menu-a787f",
  storageBucket: "menu-a787f.firebasestorage.app",
  messagingSenderId: "226019708679",
  appId: "1:226019708679:web:75a50836f01660aeb77fa2",
  measurementId: "G-KJH82EVEE9",
  databaseURL: "https://menu-a787f-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { 
  db, 
  ref, 
  onValue, 
  set, 
  push, 
  update, 
  remove, 
  query, 
  orderByChild 
};
