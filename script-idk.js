// ====== CONFIGURE THESE ======
const FIREBASE_CONFIG = {
  // IMPORTANT: fill this with your actual firebase project settings
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};
// ============================

// init firebase
// CHANGE THIS: Use the functions directly from the imported SDKs
// import { initializeApp } from "firebase/app";  <-- this should be at the very top of your file
// import { getAuth } from "firebase/auth";
// import { getDatabase, ref } from "firebase/database";

// Assuming you've already imported these at the very top of your script:
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase, ref } from "firebase/database";
import './style-idk.css'; // <-- ADD THIS LINE

const app = initializeApp(FIREBASE_CONFIG); // Use the imported initializeApp
const auth = getAuth(app); // Use getAuth with the app instance
const db = getDatabase(app); // Use getDatabase with the app instance
const usersRef = ref(db, 'users'); // Use ref with the database instance
const winnersRef = ref(db, 'winners'); // Use ref with the database instance
const deviceRegRef = ref(db, 'deviceRegistrations'); // Use ref with the database instance

// Global variables
let currentSpinCount = 0;
let totalSpinsNeeded = 0;
let eligibleUsersForSpin = [];
let winnersQueue = [];
let localUser = null; // To hold current user state

// --- Helper Functions ---
function toTitleCase(str) {
    return str.replace(
        /\w\S*/g,
        function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
}


// --- UI Functions ---

// *** NEW: Functions to show/hide loading modal ***
function showLoading(text = 'Loading...') {
    const loadingModal = document.getElementById('loadingModal');
    const loadingText = document.getElementById('loadingText');
    if (loadingModal && loadingText) {
        loadingText.textContent = text;
        loadingModal.classList.add('show');
    }
}

function hideLoading() {
    const loadingModal = document.getElementById('loadingModal');
    if (loadingModal) {
        loadingModal.classList.remove('show');
    }
}


function showMessage(text, isError = false) {
    const popupOk = document.getElementById('popupOk');
    const popupOkText = document.getElementById('popupOkText');
    const panel = document.getElementById('popupOkPanel');
    const popupOkCloseBtn = document.getElementById('popupOkClose');
    const spinBtn = document.getElementById('spinBtn');

    if (popupOk && popupOkText && panel && popupOkCloseBtn) {
        popupOkText.textContent = text;
        panel.style.borderTop = isError ? '4px solid #ef4444' : '4px solid var(--accent)';
        popupOk.classList.add('show');

        if (totalSpinsNeeded > 0 && currentSpinCount < totalSpinsNeeded && !isError) {
            popupOkCloseBtn.style.display = 'block';
            popupOkCloseBtn.onclick = () => {
                popupOk.classList.remove('show');
                if (currentSpinCount < totalSpinsNeeded) {
                    spinWheelInternal();
                } else {
                    if (spinBtn) spinBtn.disabled = false;
                    totalSpinsNeeded = 0;
                    currentSpinCount = 0;
                }
            };
        } else {
            if (spinBtn) spinBtn.disabled = false;
            popupOkCloseBtn.style.display = 'block';
            popupOkCloseBtn.onclick = () => popupOk.classList.remove('show');
            setTimeout(() => popupOk.classList.remove('show'), 4000);
        }
    } else {
        console.error("Popup elements not found!");
    }
}

function confirmAction(text, callback) {
    const modal = document.getElementById('confirmModal');
    const confirmText = document.getElementById('confirmText');
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');

    if (!modal || !confirmText || !confirmYes || !confirmNo) {
        console.error("Confirmation modal elements not found!");
        return;
    }

    confirmText.textContent = text;
    modal.classList.add('show');

    const onYes = () => { cleanup(); callback(true); };
    const onNo = () => { cleanup(); callback(false); };

    const cleanup = () => {
        modal.classList.remove('show');
        setTimeout(() => {
            confirmYes.removeEventListener('click', onYes);
            confirmNo.removeEventListener('click', onNo);
        }, 300);
    };

    confirmYes.addEventListener('click', onYes);
    confirmNo.addEventListener('click', onNo);
}


// --- User Registration ---

async function registerUser() {
    if (!localUser) {
        return showMessage('Mohon tunggu, sedang memverifikasi perangkat...', true);
    }

    const nameIn = document.getElementById('name');
    const rtIn = document.getElementById('rt');
    const name = nameIn.value.trim();
    let rt = rtIn.value.trim();

    if (!name || !rt) return showMessage('please fill in all fields.', true);
    if (isNaN(parseInt(rt)) || !/^\d+$/.test(rt)) return showMessage('nomor rt harus berupa angka. contoh: "01" atau "02".', true);
    if (name.length < 3) return showMessage(`isi nama minimal 3 karakter.`, true);

    const formattedName = toTitleCase(name);
    const uniqueKey = name.toLowerCase() + '-' + rt;

    const snapshot = await usersRef.once('value');
    let isDuplicate = false;
    snapshot.forEach(child => {
        if (child.val().unique === uniqueKey) isDuplicate = true;
    });

    if (isDuplicate) return showMessage(`Partisipan ini sudah terdaftar!`, true);

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const displayTimestamp = `${hours}:${minutes}:${seconds} WIB`;
    const userKey = now.getTime().toString();
    
    const deviceId = localUser.uid;

    const userData = {
        name: formattedName,
        rt: rt,
        unique: uniqueKey,
        key: userKey,
        timestamp: displayTimestamp,
        deviceId: deviceId
    };

    try {
        await usersRef.child(userKey).set(userData);
        if (!localUser.isAdmin) {
            await deviceRegRef.child(deviceId).set({ registered: true, timestamp: displayTimestamp });
        }
        showMessage(`Berhasil mendaftarkan doorprize!`);
        if (localUser.isAdmin) {
            nameIn.value = '';
            rtIn.value = '';
        } else {
            lockRegistrationForm();
        }
    } catch (err) {
        showMessage(`error: ${err.message}`, true);
    }
}

// --- Admin & Auth Section ---

function lockRegistrationForm(message = 'Perangkat ini sudah terdaftar.') {
    const nameIn = document.getElementById('name');
    const rtIn = document.getElementById('rt');
    const registerBtn = document.getElementById('registerBtn');
    if(nameIn) { nameIn.readOnly = true; nameIn.value = message; }
    if(rtIn) { rtIn.readOnly = true; rtIn.value = ''; }
    if(registerBtn) { registerBtn.disabled = true; }
}

function unlockRegistrationForm() {
    const nameIn = document.getElementById('name');
    const rtIn = document.getElementById('rt');
    const registerBtn = document.getElementById('registerBtn');
    if(nameIn) { nameIn.readOnly = false; nameIn.value = ''; }
    if(rtIn) { rtIn.readOnly = false; rtIn.value = ''; }
    if(registerBtn) { registerBtn.disabled = false; }
}

function setAdminMode(enabled) {
    const loginBtn = document.getElementById('adminLogin');
    const logoutBtn = document.getElementById('adminLogout');
    const emailEl = document.getElementById('adminEmail');
    const passEl = document.getElementById('adminPass');

    if (enabled) {
        document.body.classList.add('is-admin');
        if(loginBtn) loginBtn.style.display = 'none';
        if(logoutBtn) logoutBtn.style.display = 'inline-block';
        if(emailEl) emailEl.readOnly = true;
        if(passEl) passEl.readOnly = true;
        unlockRegistrationForm();
        listenToData();
    } else {
        document.body.classList.remove('is-admin');
        if(loginBtn) loginBtn.style.display = 'inline-block';
        if(logoutBtn) logoutBtn.style.display = 'none';
        if(emailEl) emailEl.readOnly = false;
        if(passEl) passEl.readOnly = false;
    }
}

function loginAdmin() {
    const emailEl = document.getElementById('adminEmail');
    const passEl = document.getElementById('adminPass');
    const email = emailEl.value;
    const password = passEl.value;

    if (!email || !password) return showMessage("email and password cannot be empty.", true);
    
    // *** NEW: Show loading message ***
    showLoading('Logging in...');

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            hideLoading();
            showMessage('Successfully logged in.');
            emailEl.value = '';
            passEl.value = '';
        })
        .catch(error => {
            hideLoading();
            showMessage(error.message, true)
        });
}

function logoutAdmin() {
    // *** NEW: Show loading message ***
    showLoading('Logging out...');

    auth.signOut()
        .then(() => {
            hideLoading();
            showMessage('Successfully logged out.');
        })
        .catch(error => {
            hideLoading();
            showMessage(error.message, true);
        });
}


function listenToData() {
    usersRef.on('value', snapshot => {
        const tbody = document.getElementById('participantsBody');
        const statusEl = document.getElementById('status');
        if (!tbody || !statusEl) return;

        tbody.innerHTML = '';
        const users = snapshot.val() || {};
        statusEl.textContent = `Partisipan: ${Object.keys(users).length}`;
        
        let count = 1;
        snapshot.forEach(child => {
            const u = child.val();
            const key = child.key;
            const row = document.createElement('tr');
            const timestamp = u.timestamp || '-';
            row.innerHTML = `<td>${count++}</td><td>${u.name}</td><td>${u.rt}</td><td>${timestamp}</td>
                             <td class="right admin-tool admin-tool-cell">
                                <button class='del ghost' onclick='resetRegistration("${key}", "${u.name}", "${u.deviceId}")'>Reset</button>
                                <button class='del ghost' onclick='deleteUser("${key}", "${u.name}", "${u.deviceId}")'>Hapus</button>
                             </td>`;
            tbody.appendChild(row);
        });
        updateEligibleCount();
    });

    winnersRef.on('value', snapshot => {
        const winnersBody = document.getElementById('winnersBody');
        if (!winnersBody) return;
        winnersBody.innerHTML = '';
        let count = 1;
        snapshot.forEach(child => {
            const winner = child.val();
            const key = child.key;
            const row = document.createElement('tr');
            const timestamp = winner.timestamp || '-';
            row.innerHTML = `<td>${count++}</td><td>${winner.name}</td><td>${winner.rt}</td><td>${timestamp}</td>
                             <td class="right admin-tool admin-tool-cell"><button class='del ghost' onclick='deleteWinner("${key}", "${winner.name}")'>Hapus</button></td>`;
            winnersBody.appendChild(row);
        });
        updateEligibleCount();
    });
}

function resetRegistration(key, name, deviceId) {
    confirmAction(`Ini akan menghapus ${name} dari daftar dan mengizinkan perangkat mereka untuk mendaftar lagi. Lanjutkan?`, (ok) => {
        if (ok) {
            usersRef.child(key).remove();
            if (deviceId) deviceRegRef.child(deviceId).remove();
            showMessage(`${name} telah direset. Minta mereka untuk me-refresh halaman mereka untuk mendaftar lagi.`, false);
        }
    });
}

function deleteUser(key, name, deviceId) {
    confirmAction(`Hapus partisipan ${name} secara permanen?`, (ok) => {
        if (ok) {
            winnersRef.orderByChild('key').equalTo(key).once('value', snapshot => {
                snapshot.forEach(child => winnersRef.child(child.key).remove());
            });
            usersRef.child(key).remove();
            if (deviceId) deviceRegRef.child(deviceId).remove();
            showMessage(`${name} telah di hapus.`, false);
        }
    });
}

function deleteWinner(key, name) {
    confirmAction(`Hapus ${name} dari list pemenang? Partisipan ini dapat memenangkan hadiah lagi.`, (ok) => {
        if (ok) {
            winnersRef.child(key).remove();
            showMessage(`${name} telah di hapus dari list pemenang.`, false);
        }
    });
}

function resetAll() {
    confirmAction('BAHAYA! INI BAKAL NGEHAPUS SEMUA PARTISIPAN, PEMENANG, DAN KUNCI PERANGKAT. Apakah kamu yakin?', (ok) => {
        if (ok) {
            usersRef.remove();
            winnersRef.remove();
            deviceRegRef.remove();
            const reel = document.getElementById('spinnerReel');
            if(reel) reel.innerHTML = '';
            showMessage('Semua data telah di reset.', false);
        }
    });
}

function removeWinners() {
     confirmAction('BAHAYA! INI BAKAL NGEHAPUS SEMUA PEMENANG. Apakah kamu yakin?', (ok) => {
        if (ok) {
            winnersRef.remove();
            const reel = document.getElementById('spinnerReel');
            if(reel) reel.innerHTML = '';
            showMessage('Daftar pemenang telah direset.', false);
        }
    });
}


function exportToCSV() {
    usersRef.once('value', snapshot => {
        if (!snapshot.exists()) return showMessage('Tidak ada partisipan untuk diekspor.', true);
        let csvContent = 'no.;nama;rt number;waktu\n';
        let counter = 1;
        snapshot.forEach(child => {
            const u = child.val();
            csvContent += `${counter++};"${u.name.replace(/"/g, '""')}";${u.rt};${u.timestamp || '-'}\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'doorprize_users.csv';
        a.click();
    });
}

async function updateEligibleCount() {
    const usersSnapshot = await usersRef.get();
    const winnersSnapshot = await winnersRef.get();
    const users = usersSnapshot.val() || {};
    const winners = winnersSnapshot.val() || {};
    const winnerKeys = new Set(Object.values(winners).map(w => w.key));
    eligibleUsersForSpin = Object.values(users).filter(user => !user.key || !winnerKeys.has(user.key));
}

// --- SPINNER LOGIC (No changes here) ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function spinWheel() {
    const spinBtn = document.getElementById('spinBtn');
    const winnerCountInput = document.getElementById('winnerCount');
    if (!spinBtn || !winnerCountInput) return;

    totalSpinsNeeded = parseInt(winnerCountInput.value, 10) || 1;
    currentSpinCount = 0;
    winnersQueue = [];
    spinBtn.disabled = true;

    await updateEligibleCount();

    const allUsersSnapshot = await usersRef.get();
    const allUsers = allUsersSnapshot.val() || {};
    const totalParticipants = Object.keys(allUsers).length;
    const totalWinners = (await winnersRef.get()).val() ? Object.keys((await winnersRef.get()).val()).length : 0;

    if (totalParticipants > 0 && totalWinners >= totalParticipants) {
        spinBtn.disabled = false;
        return showMessage('Semua partisipan sudah memenangkan hadiah.', true);
    }

    if (eligibleUsersForSpin.length < totalSpinsNeeded) {
        spinBtn.disabled = false; 
        return showMessage(`Tidak cukup partisipan. Butuh ${totalSpinsNeeded}, tersedia ${eligibleUsersForSpin.length}.`, true);
    }

    let tempEligibleUsers = [...eligibleUsersForSpin];
    for (let i = 0; i < totalSpinsNeeded; i++) {
        const winnerIndex = Math.floor(Math.random() * tempEligibleUsers.length);
        winnersQueue.push(tempEligibleUsers[winnerIndex]);
        tempEligibleUsers.splice(winnerIndex, 1);
    }

    spinWheelInternal();
}

function spinWheelInternal() {
    const reel = document.getElementById('spinnerReel');
    if (!reel) return;

    if (currentSpinCount >= totalSpinsNeeded) {
        const spinBtn = document.getElementById('spinBtn');
        if (spinBtn) spinBtn.disabled = false;
        totalSpinsNeeded = 0;
        currentSpinCount = 0;
        return;
    }

    const currentWinner = winnersQueue[currentSpinCount];
    currentSpinCount++;

    reel.style.transition = 'none';
    reel.style.transform = 'translateX(0)';
    reel.innerHTML = '';

    const itemWidth = 140;
    let reelItems = [];
    
    usersRef.get().then(snapshot => {
        const allUsersFromDb = snapshot.val() || {};
        const allUsersForReel = [...eligibleUsersForSpin, ...Object.values(allUsersFromDb)];

        while (reelItems.length < 70) {
            reelItems = reelItems.concat(shuffleArray([...allUsersForReel]));
        }

        const winnerDisplayIndex = reelItems.length - (Math.floor(Math.random() * 10) + 5);
        reelItems[winnerDisplayIndex] = currentWinner;

        reelItems.forEach(user => {
            const item = document.createElement('div');
            item.className = 'spinner-item';
            item.innerHTML = `<div class="spinner-item-name">${user.name}</div><div class="spinner-item-rt">rt: ${user.rt}</div>`;
            reel.appendChild(item);
        });
        
        const containerWidth = reel.parentElement.offsetWidth;
        const targetPosition = (winnerDisplayIndex * itemWidth) + (itemWidth / 2);
        const offset = containerWidth / 2;
        const randomJitter = (Math.random() - 0.5) * (itemWidth * 0.8); 
        const finalTranslateX = -targetPosition + offset + randomJitter;

        reel.offsetHeight; 

        reel.style.transition = 'transform 6s cubic-bezier(0.2, 0.8, 0.2, 1)';
        reel.style.transform = `translateX(${finalTranslateX}px)`;

        setTimeout(() => {
            const currentWinnerName = `${currentWinner.name} (RT ${currentWinner.rt})`;
            showMessage(`🎉 pemenang ${currentSpinCount} dari ${totalSpinsNeeded}: ${currentWinnerName}!`);
            winnersRef.push(currentWinner);
            updateEligibleCount();
        }, 6500);
    });
}

// --- NEW, ROBUST Authentication Handler ---
async function handleUser(user) {
    try {
        if (user && !user.isAnonymous) {
            // User is an admin
            localUser = { uid: user.uid, isAdmin: true };
            setAdminMode(true);
        } else {
            // User is anonymous
            localUser = { uid: user.uid, isAdmin: false };
            setAdminMode(false);
            const deviceSnapshot = await deviceRegRef.child(user.uid).once('value');
            if (deviceSnapshot.exists()) {
                lockRegistrationForm();
            } else {
                unlockRegistrationForm();
            }
        }
    } catch (dbError) {
        console.error("Database check failed:", dbError);
        // *** NEW: More specific error message for database rule issues ***
        lockRegistrationForm('Gagal: Aturan database salah.');
        showMessage('Gagal memeriksa status pendaftaran. Pastikan aturan database Anda benar.', true);
    }
}

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    
    lockRegistrationForm('Memverifikasi...');

    auth.onAuthStateChanged(user => {
        if (user) {
            handleUser(user);
        } else {
            auth.signInAnonymously().catch(authError => {
                console.error("Anonymous sign in failed:", authError);
                // *** NEW: More specific error message for auth issues ***
                lockRegistrationForm('Gagal: Login anonim salah.');
                showMessage('Gagal memverifikasi perangkat. Pastikan login anonim diaktifkan di Firebase.', true);
            });
        }
    });

    document.getElementById('registerBtn')?.addEventListener('click', registerUser);
    document.getElementById('adminLogin')?.addEventListener('click', loginAdmin);
    document.getElementById('adminLogout')?.addEventListener('click', logoutAdmin);
    document.getElementById('spinBtn')?.addEventListener('click', spinWheel);
    document.getElementById('removeWinners')?.addEventListener('click', removeWinners);
    document.getElementById('clearAll')?.addEventListener('click', resetAll);
    document.getElementById('exportJson')?.addEventListener('click', exportToCSV);
    
    document.getElementById('popupOkClose')?.addEventListener('click', () => {
        document.getElementById('popupOk').classList.remove('show');
    });
    document.getElementById('confirmNo')?.addEventListener('click', () => {
        document.getElementById('confirmModal').classList.remove('show');
    });
});




