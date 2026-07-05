# Piggy Pal 🐷

Piggy Pal is a free, mobile-first Progressive Web App (PWA) that helps parents manage their children's pocket money, allowance, savings, and spending. It supports real-time family synchronization using Firebase and works offline after installation.

**Live app:** [https://shankar5459.github.io/kids-pocket-bank/](https://shankar5459.github.io/kids-pocket-bank/)

---

## ✨ Features

### 👨‍👩‍👧‍👦 Family

- Firebase Authentication
- Create Family
- Join Family using Invite Code
- Shared family wallet experience
- Real-time synchronization across devices

### 👧 Kids

- Multiple kids
- Individual balances
- Individual bank statements
- Custom avatars
- Custom colors

### 💰 Transactions

- Credit
- Debit
- Weekly/Monthly Allowance
- Rewards
- Gifts
- Food
- Toys
- Books
- Savings
- Custom categories
- Edit transactions
- Delete transactions
- Running balance
- Negative balance warning

### 🏦 Bank Statement

- Running balance
- Filters
- Search
- Mobile cards
- Desktop table
- CSV Export
- Print / PDF

### ☁️ Cloud Sync

- Firebase Firestore
- Real-time synchronization
- Offline support
- Sync status indicator

### 💾 Backup & Restore

- JSON Export
- JSON Import
- Local-to-cloud migration
- CSV Export

### 📱 Progressive Web App

- Installable
- Offline capable
- Mobile-first
- Works on Android & iPhone

---

## 🛠 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Hosting | GitHub Pages |
| Offline | Service Worker + IndexedDB |
| Currency | INR (₹) |

- Pure static frontend application
- No backend server
- No build process
- No package manager required

---

## 🚀 Run Locally

```bash
git clone https://github.com/shankar5459/kids-pocket-bank.git
cd kids-pocket-bank
python3 -m http.server 8765
```

Open [http://localhost:8765](http://localhost:8765)

A local HTTP server is required. Opening `index.html` directly via `file://` will not work correctly because **Service Worker**, **Firebase Authentication**, and **PWA features** cannot be fully tested without HTTP.

---

## 🌍 Deployment

This project is hosted on **GitHub Pages**. Every push to the `main` branch automatically publishes the latest version.

**Pages configuration:**

| Setting | Value |
|---------|-------|
| Source | Deploy from branch |
| Branch | `main` |
| Folder | `/ (root)` |

After pushing, allow 1–2 minutes for the site to update. All asset paths are relative, so the app works under the GitHub Pages subpath.

---

## 📱 Install

**Android (Chrome)**

1. Open the live app URL in Chrome
2. Tap the menu (⋮)
3. Select **Install app**

**iPhone (Safari)**

1. Open the live app URL in Safari
2. Tap **Share**
3. Select **Add to Home Screen**

After the first online visit, the installed app works offline with cached assets and Firestore persistence.

---

## 🔥 Firebase Setup

To run your own instance:

1. **Create a Firebase project** at [Firebase Console](https://console.firebase.google.com/)
2. **Add a Web App** and copy the config object
3. **Enable Authentication** → Sign-in method → **Email/Password**
4. **Create a Firestore database** in **Production mode**
5. Update [`js/firebase-config.js`](js/firebase-config.js) with your Firebase config (do not commit secrets to a public repo if using private rules)
6. **Publish Firestore rules** — paste the contents of [`firestore.rules`](firestore.rules) into Firebase Console → Firestore → Rules → Publish
7. **Add authorized domains** under Authentication → Settings → Authorized domains:
   - `localhost` (local development)
   - Your GitHub Pages domain (e.g. `shankar5459.github.io`)

Create user accounts manually in Firebase Console (the app does not include public sign-up).

---

## 📂 Firestore Structure

```
families
└── {familyId}
    ├── kids
    │   └── {kidId}
    └── transactions
        └── {transactionId}

inviteCodes
└── {inviteCode}
```

**Family document:** name, invite code, members, timestamps

**Kid document:** name, avatar, color, timestamps

**Transaction document:** kidId, type (credit/debit), amountPaise, date, description, category, audit fields

**Invite code document:** maps invite code → familyId

---

## 🔐 Data & Privacy

- Authentication is handled by **Firebase Authentication**
- Family data is stored securely in **Cloud Firestore**
- GitHub Pages hosts only static application files
- No transaction or family data is stored in GitHub
- Data synchronizes only between authorized family members
- JSON backup can be exported anytime from Settings
- Offline support is available via Service Worker and Firestore persistence

---

## 📂 Project Structure

```
index.html
manifest.json
service-worker.js
firestore.rules
LICENSE

css/
  styles.css

js/
  auth.js
  firebase-config.js
  firebase-service.js
  family-service.js
  family-setup.js
  kids-service.js
  transactions-service.js
  sync-service.js
  backup.js
  export.js
  store.js
  utils.js
  views.js
  app.js
  sw-register.js

icons/
```

---

## 📸 Screenshots

Coming soon...

---

## 📌 Roadmap

- Parent PIN
- Savings Goals
- Monthly Allowance Automation
- Spending Charts
- Kid Achievements
- Dark Mode

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
