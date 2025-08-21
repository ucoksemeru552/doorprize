// ====== CONFIGURE THESE ======
const FIREBASE_CONFIG = {
  // IMPORTANT: fill this with your actual firebase project settings
  apiKey: "AIzaSyAleOmoznhqDBW04Kr2T3q4aucv2KJ58gc",
  authDomain: "doorprize-katar-06.firebaseapp.com",
  databaseURL: "https://doorprize-katar-06-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "doorprize-katar-06",
  storageBucket: "doorprize-katar-06.firebasestorage.app",
  messagingSenderId: "851525724506",
  appId: "1:851525724506:web:8579d95626210d50312b63",
  measurementId: "G-X1QHZMCGGD"
};
// ============================

// init firebase
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.database();
const usersRef = db.ref('users');
const winnersRef = db.ref('winners');

// --- UI Functions ---

function showMessage(text, isError = false) {
    const popupOk = document.getElementById('popupOk');
    const popupOkText = document.getElementById('popupOkText');
    const panel = document.getElementById('popupOkPanel');

    if (popupOk && popupOkText && panel) {
        popupOkText.textContent = text;
        panel.style.borderTop = isError ? '4px solid #ef4444' : '4px solid var(--accent)';
        popupOk.classList.add('show');

        setTimeout(() => {
            popupOk.classList.remove('show');
        }, 4000);
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

    const onYes = () => {
        cleanup();
        callback(true);
    };

    const onNo = () => {
        cleanup();
        callback(false);
    };

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

function registerUser() {
    const nameIn = document.getElementById('name');
    const rtIn = document.getElementById('rt');
    const name = nameIn.value.trim();
    let rt = rtIn.value.trim();
    if (!name || !rt) {
        showMessage('Please fill in all fields.', true);
        return;
    }

    const uniqueKey = name.toLowerCase() + '-' + rt;

    usersRef.orderByChild('unique').equalTo(uniqueKey).once('value', snapshot => {
        if (snapshot.exists()) {
            showMessage(`Name ${name} from RT ${rt} is already registered!`, true);
        } else {
            const newRef = usersRef.push();
            newRef.set({ name, rt, unique: uniqueKey, key: newRef.key }).then(() => {
                showMessage(`Successfully registered ${name} (RT ${rt}). Thank you!`);
                nameIn.value = '';
                rtIn.value = '';
            }).catch(err => {
                showMessage(`Error: ${err.message}`, true);
            });
        }
    });
}

// --- Admin Section ---

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
    console.log("Login button clicked. Attempting to sign in...");
    const emailEl = document.getElementById('adminEmail');
    const passEl = document.getElementById('adminPass');
    const email = emailEl.value;
    const password = passEl.value;

    if (!email || !password) {
        showMessage("Email and password cannot be empty.", true);
        console.error("Login failed: Email or password was empty.");
        return;
    }
    
    console.log(`Attempting login with email: ${email}`);

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in
            console.log("Firebase login successful:", userCredential.user);
            showMessage('Logged in successfully');
            emailEl.value = '';
            passEl.value = '';
        })
        .catch((error) => {
            console.error("Firebase login failed:", error);
            showMessage(error.message, true);
        });
}

function logoutAdmin() {
    auth.signOut().then(() => {
        showMessage('Logged out.');
    }).catch((error) => {
        showMessage(error.message, true);
    });
}


function listenToData() {
    // Listen for participants
    usersRef.on('value', snapshot => {
        const tbody = document.getElementById('participantsBody');
        const statusEl = document.getElementById('status');
        if (!tbody || !statusEl) return;

        tbody.innerHTML = '';
        const users = snapshot.val() || {};
        const userCount = Object.keys(users).length;
        statusEl.textContent = `Participants: ${userCount}`;
        
        let count = 1;
        snapshot.forEach(child => {
            const u = child.val();
            const key = child.key;
            const row = document.createElement('tr');
            row.innerHTML = `<td>${count++}</td><td>${u.name}</td><td>${u.rt}</td>
                             <td class="right admin-tool admin-tool-cell"><button class='del ghost' onclick='deleteUser("${key}", "${u.name}")'>Hapus</button></td>`;
            tbody.appendChild(row);
        });
        updateEligibleCount();
    });

    // Listen for winners
    winnersRef.on('value', snapshot => {
        const winnersBody = document.getElementById('winnersBody');
        const winnerCountInput = document.getElementById('winnerCount');
        if (!winnersBody || !winnerCountInput) return;

        winnersBody.innerHTML = '';
        
        if (snapshot.exists()) {
            winnerCountInput.disabled = true;
        } else {
            winnerCountInput.disabled = false;
        }
        
        let count = 1;
        snapshot.forEach(child => {
            const winner = child.val();
            const key = child.key;
            const row = document.createElement('tr');
            row.innerHTML = `<td>${count++}</td><td>${winner.name}</td><td>${winner.rt}</td>
                             <td class="right admin-tool admin-tool-cell"><button class='del ghost' onclick='deleteWinner("${key}", "${winner.name}")'>Hapus</button></td>`;
            winnersBody.appendChild(row);
        });
        updateEligibleCount();
    });
}

function deleteUser(key, name) {
    confirmAction(`Hapus partisipan ${name}?`, (ok) => {
        if (ok) {
            winnersRef.orderByChild('key').equalTo(key).once('value', snapshot => {
                snapshot.forEach(child => {
                    winnersRef.child(child.key).remove();
                });
            });
            usersRef.child(key).remove();
            showMessage(`${name} Telah di hapus.`, false);
        }
    });
}

function deleteWinner(key, name) {
    confirmAction(`Hapus ${name} dari list pemenang? Partisipan ini dapat memenangkan hadiah lagi.`, (ok) => {
        if (ok) {
            winnersRef.child(key).remove();
            showMessage(`${name} Telah di hapus dari list pemenang.`, false);
        }
    });
}

function resetAll() {
    confirmAction('DANGER! This will delete ALL users and winners.', (ok) => {
        if (ok) {
            usersRef.remove();
            winnersRef.remove();
            const reel = document.getElementById('spinnerReel');
            if(reel) reel.innerHTML = '';
            showMessage('All data has been reset.', false);
        }
    });
}

function removeWinners() {
     confirmAction('This will clear the entire winners list, making everyone eligible again.', (ok) => {
        if (ok) {
            winnersRef.remove();
            const reel = document.getElementById('spinnerReel');
            if(reel) reel.innerHTML = '';
            showMessage('Winners list has been reset.', false);
        }
    });
}


function exportToCSV() {
    usersRef.once('value', snapshot => {
        if (!snapshot.exists()) {
            showMessage('No users to export.', true);
            return;
        }
        let csvContent = 'No.;Nama;RT Number\n';
        let counter = 1;
        snapshot.forEach(child => {
            const u = child.val();
            csvContent += `${counter};"${u.name.replace(/"/g, '""')}";${u.rt}\n`;
            counter++;
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
    Object.keys(users).filter(key => !winnerKeys.has(key)).length;
}

// --- SPINNER LOGIC ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function spinWheel() {
    const reel = document.getElementById('spinnerReel');
    const spinBtn = document.getElementById('spinBtn');
    const winnerCountInput = document.getElementById('winnerCount');
    if (!reel || !spinBtn || !winnerCountInput) return;

    const countToWin = parseInt(winnerCountInput.value, 10) || 1;

    spinBtn.disabled = true;

    const usersSnapshot = await usersRef.get();
    const winnersSnapshot = await winnersRef.get();
    const users = usersSnapshot.val() || {};
    const winners = winnersSnapshot.val() || {};
    const winnerKeys = new Set(Object.values(winners).map(w => w.key));
    let eligibleUsers = Object.values(users).filter(user => !user.key || !winnerKeys.has(user.key));

    if (eligibleUsers.length < countToWin) {
        showMessage(`Tidak cukup partisipan. Kamu membutuhkan ${countToWin} orang, sedangkan kamu hanya mempunyai ${eligibleUsers.length} orang.`, true);
        spinBtn.disabled = false;
        return;
    }

    const winnersPicked = [];
    for (let i = 0; i < countToWin; i++) {
        const winnerIndex = Math.floor(Math.random() * eligibleUsers.length);
        winnersPicked.push(eligibleUsers[winnerIndex]);
        eligibleUsers.splice(winnerIndex, 1);
    }
    
    const lastWinner = winnersPicked[winnersPicked.length - 1];
    
    reel.style.transition = 'none';
    reel.style.transform = 'translateX(0)';
    reel.innerHTML = '';

    const itemWidth = 140;
    let reelItems = [];
    
    const allUsersForReel = Object.values(users);
    while (reelItems.length < 70) {
        reelItems = reelItems.concat(shuffleArray([...allUsersForReel]));
    }

    const winnerIndexInReel = reelItems.length - (Math.floor(Math.random() * 10) + 5);
    reelItems[winnerIndexInReel] = lastWinner;

    reelItems.forEach(user => {
        const item = document.createElement('div');
        item.className = 'spinner-item';
        item.innerHTML = `<div class="spinner-item-name">${user.name}</div><div class="spinner-item-rt">RT: ${user.rt}</div>`;
        reel.appendChild(item);
    });
    
    const containerWidth = reel.parentElement.offsetWidth;
    const targetPosition = (winnerIndexInReel * itemWidth) + (itemWidth / 2);
    const offset = containerWidth / 2;
    const randomJitter = (Math.random() - 0.5) * (itemWidth * 0.8);
    const finalTranslateX = -targetPosition + offset + randomJitter;

    reel.offsetHeight; 

    reel.style.transition = 'transform 6s cubic-bezier(0.2, 0.8, 0.2, 1)';
    reel.style.transform = `translateX(${finalTranslateX}px)`;

    setTimeout(() => {
        const winnerNames = winnersPicked.map(w => `${w.name} (RT ${w.rt})`).join(', ');
        showMessage(`🎉 Winners: ${winnerNames}`);
        
        winnersPicked.forEach(winner => {
            winnersRef.push(winner);
        });
        
        spinBtn.disabled = false;
    }, 6500);
}


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in.
            setAdminMode(true);
        } else {
            // User is signed out.
            setAdminMode(false);
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
