# Google 3D Tiles Setup Instructions

To enable Google's Photorealistic 3D Tiles (which includes realistic textured buildings and 3D trees like Google Earth), you need to set up a Google Maps API key.

## Step 1: Get a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Map Tiles API** (required for Photorealistic 3D Tiles)
4. Go to "Credentials" and create an API key
5. (Optional but recommended) Restrict the API key to your domain for security

## Step 2: Add API Key to Environment

1. Copy your API key
2. Open your `.env` file in the project root
3. Add the following line:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```
4. Replace `your_actual_api_key_here` with your actual API key

## Step 3: Restart the Development Server

After adding the API key, restart your development server:
```bash
npm run dev
```

## What You'll Get

With Google Photorealistic 3D Tiles enabled, you'll see:
- **Photorealistic textured buildings** (not just basic outlines)
- **3D trees and vegetation** 
- **Accurate terrain details**
- **Real-world materials and colors**
- **Coverage in 2,500+ cities across 49 countries**

This provides the exact Google Earth experience with stunning visual fidelity!

## Usage

Once set up, use the new 3D Buildings toggle button (building icon) next to the layer toggle button to switch between:
- **Disabled**: No 3D buildings
- **OSM Buildings**: Basic 3D building outlines (uses Cesium Ion)
- **Google 3D**: Photorealistic buildings and trees (uses Google Maps API)

## Pricing Note

Google Maps API has generous free tiers, but check their pricing for your expected usage. The Map Tiles API is typically very affordable for personal projects.