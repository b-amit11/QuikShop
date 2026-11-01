# Quik Shop

Website for Quik Shop, the gas station and convenience store at **21265 Great Mills Rd, Lexington Park, MD 20653**.

## Features

- **What's in stock:** fuel prices on a pump-style board, and store items (drinks, snacks, hot food, essentials, auto) marked *In stock*, *Low* or *Out*. Customers can search and filter by category.
- **Chat with the cashier:** customers can message the cashier on duty straight from the site, with no account or sign-up. Each customer gets a private conversation.
- **Cashier desk** (staff sign-in):
  - change stock status and prices, and add or remove items
  - set the store name, hours and address, and the open/closed status
  - read and reply to customer messages

All updates show up live for everyone who has the site open.

## How it's built

- Plain HTML, CSS and JavaScript, with no build step: `index.html` and `app.js`.
- [Firebase](https://firebase.google.com/) for the backend:
  - **Cloud Firestore** stores items, store info and chats.
  - **Firebase Authentication** signs customers in anonymously and in the background, and signs staff in with email and password.
- `firestore.rules` controls who can do what: anyone can read stock, only staff can change it, and customers can only read and write their own conversation.

## Setup

1. **Create a Firebase project** at <https://console.firebase.google.com>. The free Spark plan is enough.
2. **Add a web app.** Go to *Project settings → General → Your apps → Add app → Web*. Copy the `firebaseConfig` values into `firebase-config.js`.
3. **Turn on Firestore.** Go to *Build → Firestore Database → Create database*, choose production mode, and pick a US location such as `us-east4`.
4. **Publish the security rules.** In *Firestore → Rules*, paste the contents of `firestore.rules` and click **Publish**. You can also run `firebase deploy --only firestore:rules`.
5. **Turn on sign-in.** Go to *Build → Authentication → Sign-in method* and enable **Anonymous** and **Email/Password**.
6. **Add each cashier:**
   1. In *Authentication → Users → Add user*, create their email and password.
   2. Copy their **User UID**.
   3. In *Firestore → Data*, create a collection named `staff`. Add a document whose **Document ID is that UID**, with any field, for example `name: "Front counter"`.
7. **Put the site online.** Choose either option:
   - **GitHub Pages:** go to *Settings → Pages → Deploy from a branch → `main` / root*. Then add your Pages domain, for example `b-amit11.github.io`, under *Authentication → Settings → Authorized domains*.
   - **Firebase Hosting:** install the CLI with `npm install -g firebase-tools`, then run `firebase login`, `firebase use --add` and `firebase deploy`.
8. **Fill the store.** Open the site, click **Staff sign in** at the bottom, and sign in. On the Cashier desk, click **Load starter items**, then edit prices and stock to match the store.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page layout and styles |
| `app.js` | All site logic: stock board, chat, cashier desk |
| `firebase-config.js` | Your Firebase project settings |
| `firestore.rules` | Database security rules |
| `firebase.json` | Firebase CLI config for hosting and rules |
