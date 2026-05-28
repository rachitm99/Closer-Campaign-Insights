# Closer Campaign Insights

Single Next.js app for campaign-based Instagram Reel analytics.

No login is implemented yet. You can add auth later.

## Features

- Create campaigns (projects)
- Add Instagram reel URLs into each campaign
- Extract analytics from RocketAPI by shortcode
- Store only reel analytics data in Firestore
- Refresh all reels in a campaign with one button
- Show table columns:
  - Username
  - Profile URL
  - Reel URL
  - Total followers
  - Total views
  - Total comments
  - Total likes

## Tech Stack

- Next.js App Router
- Next.js Route Handlers (server-side API on Vercel)
- Firestore via Firebase Admin SDK
- RocketAPI Instagram media endpoint

## Local Setup

1. Install dependencies:

	npm install

2. Create environment file:

	cp .env.example .env.local

3. Fill these variables in .env.local:

- ROCKETAPI_TOKEN
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- FIREBASE_DATABASE_ID (use a named Firestore database such as campaign-insights)

4. Run the app:

	npm run dev

5. Open:

	http://localhost:3000

## Firestore Structure

- campaigns (collection)
  - {campaignId} (document)
	 - name
	 - createdAt
	 - updatedAt
	 - reels (subcollection)
		- {shortcode} (document)
		  - shortcode
		  - reelUrl
		  - username
		  - profileUrl
		  - followers
		  - views
		  - comments
		  - likes
		  - createdAt
		  - updatedAt

## Deploy to Vercel

1. Push repo to GitHub.
2. Import project in Vercel and set the Root Directory to the repository root, not `web/`.
3. Add all environment variables in Vercel Project Settings, including FIREBASE_DATABASE_ID.
4. Deploy.

If you want to keep production data isolated from your other project, create a separate Firestore database in the same Firebase project and point FIREBASE_DATABASE_ID to that database name.

Next.js route handlers under app/api will run as Vercel server functions, so no separate backend hosting is needed.
