# Mobile App (React Native / Expo)

Screens: Watchlists -> Criteria Builder -> Watchlist Detail -> Rule Builder -> Alert Channels, plus Signals feed and Analytics tabs.

## Run locally

```bash
cd mobile-app
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your iPhone, or press `i` to open in the iOS Simulator (requires Xcode on a Mac).

Set `API_BASE_URL` in `api/client.js` to your running backend's address — use your computer's LAN IP (e.g. `http://192.168.1.50:8000`) when testing on a physical device, since `localhost` on the phone refers to the phone itself.

## Building for the App Store

This Expo project can be built into a real `.ipa` via `eas build --platform ios` (requires an Apple Developer account) once you're ready to move past Expo Go testing. See https://docs.expo.dev/build/setup/.

## Push notifications

Uses Expo's push service (`expo-notifications`), which relays to APNs for you — no manual Apple Push certificate setup needed for the MVP. For production, also set up the Expo Application Services (EAS) push credentials.
