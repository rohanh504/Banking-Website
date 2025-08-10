// script.js

/* ==============
   Simple banking simulation with localStorage
   Features:
   - Sign up / Login
   - Persistent users in localStorage
   - Deposit / Withdraw / Send money
   - Generate QR for payment request (contains recipient & amount)
   - Scan QR to pay (uses html5-qrcode)
   ============== */

// ---------- Helpers ----------
const NOW = () => new Date().toLocaleString();
const $ = id => document.getElementById(id);

// ---------- Initial demo users ----------
let users = {
  "rohan": { name: "Rohan Halder", password: "1234", balance: 20000, transactions: [] },
  "user":  { name: "Demo User", password: "pass", balance: 8000, transactions: [] },
  "alice": { name: "Alice K", password: "alice", balance: 5000, transactions: [] }
};

// Load from localStorage
if (localStorage.getItem('laxmiUsers')) {
  try { users = JSON.parse(localStorage.getItem('laxmiUsers')); } catch(e){}
} else {
  localStorage.setItem('laxmiUsers', JSON.stringify(users));
}

let currentUser = null;
let html5QrcodeScanner = null;

// ---------- Auth ----------
function signup(){
  const name = $('suName').value.trim();
  const user = $('suUser').value.trim().toLowerCase();
  const pass = $('suPass').value;
  const initial = parseFloat($('suInitial').value) || 0;

  if(!name || !user || !pass){ $('authMsg').innerText = "Please fill name, username and password."; return; }
  if(users[user]){ $('authMsg').innerText = "Username already exists. Choose another."; return; }

  users[user] = { name, password: pass, balance: initial, transactions: [{type:'credit', amount: initial, note:'Initial Deposit', time: NOW()}].filter(t=>t.amount>0) };
  saveUsers();
  $('authMsg').innerText = "Account created — you can login now.";
  // Auto-fill login
  $('liUser').value = user;
  $('liPass').value = pass;
}

function login(){
  const user = $('liUser').value.trim().toLowerCase();
  const pass = $('liPass').value;
  if(!users[user] || users[user].password !== pass){ $('authMsg').innerText = "Invalid credentials."; return; }
  currentUser = user;
  $('authMsg').innerText = "";
  showDashboard();
}

function logout(){
  currentUser = null;
  $('dashboard').style.display = 'none';
  $('authCard').style.display = 'block';
  $('nav-user').innerText = '';
  $('nav-logout').style.display = 'none';
  stopScanner();
}

// demo users quick fill
function fillDemo(){
  $('liUser').value = 'rohan';
  $('liPass').value = '1234';
  $('suName').value = 'Rohan Demo';
  $('suUser').value = 'newuser';
  $('suPass').value = 'newpass';
  $('suInitial').value = 1000;
  $('authMsg').innerText = 'Demo users filled. Login with rohan / 1234 or user / pass';
}

function saveUsers(){ localStorage.setItem('laxmiUsers', JSON.stringify(users)); }

// ---------- UI & Dashboard ----------
function showDashboard(){
  $('authCard').style.display = 'none';
  $('dashboard').style.display = 'block';
  $('nav-user').innerText = `${users[currentUser].name} (@${currentUser})`;
  $('nav-logout').style.display = 'inline-block';
  $('nav-logout').onclick = logout;
  updateAccountUI();
}

function updateAccountUI(){
  const u = users[currentUser];
  $('accName').innerText = u.name;
  $('accUser').innerText = `@${currentUser}`;
  $('accBalance').innerText = `₹${u.balance.toFixed(2)}`;
  displayHistory();
  $('transMsg').innerText = '';
  // clear generated QR
  $('qrcode').innerHTML = '';
}

function displayHistory(){
  const list = $('historyList');
  list.innerHTML = '';
  const txs = users[currentUser].transactions || [];
  if(txs.length === 0){
    list.innerHTML = `<li class="list-group-item small text-muted">No transactions yet</li>`;
    return;
  }
  txs.slice().reverse().forEach(tx => {
    const li = document.createElement('li');
    li.className = 'list-group-item';
    let col = tx.type === 'credit' ? 'text-success' : 'text-danger';
    let html = `<div class="d-flex justify-content-between"><div><strong class="${col}">${tx.type.toUpperCase()}</strong> ${tx.note || ''}</div><div class="text-muted small">${tx.time}</div></div><div class="small">₹${tx.amount.toFixed(2)} ${tx.from?`from ${tx.from}`:''}${tx.to?` to ${tx.to}`:''}</div>`;
    li.innerHTML = html;
    list.appendChild(li);
  });
}

// ---------- Transactions ----------
function deposit(){
  const amt = parseFloat($('amt').value);
  if(isNaN(amt) || amt <= 0){ $('transMsg').innerText = 'Enter valid amount.'; return; }
  users[currentUser].balance += amt;
  users[currentUser].transactions.push({type:'credit', amount:amt, note:'Deposit', time:NOW()});
  saveUsers(); updateAccountUI();
  $('transMsg').innerText = `₹${amt} deposited.`;
  $('amt').value = '';
}

function withdraw(){
  const amt = parseFloat($('amt').value);
  if(isNaN(amt) || amt <= 0){ $('transMsg').innerText = 'Enter valid amount.'; return; }
  if(amt > users[currentUser].balance){ $('transMsg').innerText = 'Insufficient balance.'; return; }
  users[currentUser].balance -= amt;
  users[currentUser].transactions.push({type:'debit', amount:amt, note:'Withdraw', time:NOW()});
  saveUsers(); updateAccountUI();
  $('transMsg').innerText = `₹${amt} withdrawn.`;
  $('amt').value = '';
}

function sendMoney(){
  const to = $('toUser').value.trim().toLowerCase();
  const amt = parseFloat($('sendAmt').value);
  if(!to || isNaN(amt) || amt <= 0){ alert('Enter recipient and valid amount'); return; }
  if(!users[to]){ alert('Recipient not found'); return; }
  if(to === currentUser){ alert('Cannot send to yourself'); return; }
  if(amt > users[currentUser].balance){ alert('Insufficient funds'); return; }

  users[currentUser].balance -= amt;
  users[to].balance += amt;

  const time = NOW();
  users[currentUser].transactions.push({type:'debit', amount:amt, note:`Sent to ${to}`, to, time});
  users[to].transactions.push({type:'credit', amount:amt, note:`Received from ${currentUser}`, from: currentUser, time});
  saveUsers();
  updateAccountUI();
  $('toUser').value = ''; $('sendAmt').value = '';
  alert(`₹${amt} sent to ${to}`);
}

function prefillUser(){
  // fill a sample recipient for demo
  $('toUser').value = currentUser === 'rohan' ? 'alice' : 'rohan';
  $('sendAmt').value = 100;
}

// ---------- History management ----------
function clearHistory(){
  if(!confirm('Clear your local transaction history? This does not change balances.')) return;
  users[currentUser].transactions = [];
  saveUsers(); updateAccountUI();
}

// ---------- Change Name ----------
function changeName(){
  const nm = $('chgName').value.trim();
  if(!nm) return alert('Enter a name');
  users[currentUser].name = nm;
  saveUsers(); updateAccountUI();
  $('chgName').value = '';
  alert('Name updated');
}

// ---------- QR Generation ----------
function generateQR(){
  const amt = parseFloat($('qrAmt').value) || 0;
  const to = $('qrToUser').value.trim().toLowerCase() || currentUser; // if empty, current (request)
  // QR payload: JSON string with to & amount & type: "pay"
  const payload = JSON.stringify({type:'pay', to, amount: amt});
  $('qrcode').innerHTML = ''; // clear
  new QRCode(document.getElementById("qrcode"), {
    text: payload,
    width: 200,
    height: 200,
    colorDark : "#000000",
    colorLight : "#ffffff",
  });
}

// ---------- QR Scanning (pay flow) ----------
function startScanner(){
  $('scanMsg').innerText = '';
  const reader = document.getElementById('reader');
  reader.innerHTML = ''; // clear previous
  // use Html5Qrcode
  const html5QrCode = new Html5Qrcode("reader");
  html5QrcodeScanner = html5QrCode;
  const qrSuccess = (decodedText, decodedResult) => {
    // try parse JSON
    try {
      const data = JSON.parse(decodedText);
      if(data.type === 'pay' && data.to && data.amount){
        // If payload has 'to' and amount, perform payment: currentUser pays 'to' amount OR
        // if 'to' equals currentUser, treat as request -> ask to pay?
        if(!users[data.to]){ $('scanMsg').innerText = `Recipient ${data.to} not found.`; stopScanner(); return; }
        if(currentUser === data.to){ $('scanMsg').innerText = `This QR requests payment to yourself.`; stopScanner(); return; }
        if(users[currentUser].balance < data.amount){ $('scanMsg').innerText = `Insufficient funds to pay ₹${data.amount}.`; stopScanner(); return; }
        // proceed payment
        users[currentUser].balance -= data.amount;
        users[data.to].balance += data.amount;
        const time = NOW();
        users[currentUser].transactions.push({type:'debit', amount:data.amount, note:`Paid ${data.to} via QR`, to:data.to, time});
        users[data.to].transactions.push({type:'credit', amount:data.amount, note:`Received from ${currentUser} via QR`, from:currentUser, time});
        saveUsers(); updateAccountUI();
        $('scanMsg').innerText = `Paid ₹${data.amount} to ${data.to}`;
      } else {
        $('scanMsg').innerText = `Unsupported QR data.`;
      }
    } catch(e){
      $('scanMsg').innerText = `Invalid QR content.`;
    }
    stopScanner();
  };

  const config = { fps: 10, qrbox: 250 };
  Html5Qrcode.getCameras().then(cameras => {
    if(cameras && cameras.length){
      const cameraId = cameras[0].id;
      html5QrCode.start(
        cameraId,
        config,
        qrSuccess,
        (errorMessage) => { /* ignore frame errors */ }
      ).then(()=> {
        $('stopScanBtn').style.display = 'block';
      }).catch(err => {
        $('scanMsg').innerText = `Camera start failed: ${err}`;
      });
    } else {
      $('scanMsg').innerText = 'No camera found';
    }
  }).catch(err => { $('scanMsg').innerText = 'Camera permissions needed or not available'; });
}

function stopScanner(){
  if(html5QrcodeScanner){
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner.clear();
      html5QrcodeScanner = null;
      $('reader').innerHTML = '';
      $('stopScanBtn').style.display = 'none';
    }).catch(()=>{ html5QrcodeScanner = null; $('reader').innerHTML = ''; $('stopScanBtn').style.display = 'none'; });
  }
}

// ---------- On page load: attach events ----------
window.onload = () => {
  // prefill sample for quick demo — optional
  // Save back users to ensure localStorage exists
  saveUsers();
  // If someone is already logged in in this session, we don't auto login; user must login manually.
};
