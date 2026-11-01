# Quik Shop

Website for Quik Shop, the convenience store and gas station at **21265 Great Mills Rd, Lexington Park, MD 20653**.

## Features

- **What's in stock:** fuel prices on a pump-style board, and store items (drinks, snacks, hot food, essentials, auto) marked *In stock*, *Low* or *Out*. Customers can search and filter by category.
- **Chat with the cashier:** each customer gets a private conversation with the cashier on duty.
- **Cashier desk** (staff only):
  - change stock status and prices, and add or remove items
  - set the store name, hours and address, and the open/closed status
  - read and reply to customer messages

All updates show up live for everyone who has the page open.

## How it runs

The whole site is one file, `index.html`, with no build step.

Live stock and chat use the Claude artifact runtime (`claude.use("db")` and `claude.use("user")`), so those features work when the page is hosted as a claude.ai artifact. If you open `index.html` anywhere else (GitHub Pages, a local file), the page still loads, but it shows a notice that live stock and chat aren't available.

To run it as a public website on its own, swap the `db` calls for a backend such as Firebase/Firestore (its API is close to what the page already uses) or Supabase, and add customer sign-in.

### Access on claude.ai

- **Owner / Editors:** see the Cashier desk.
- **Contributors:** can see stock and chat with the cashier.
- **Viewers:** can see stock only.
