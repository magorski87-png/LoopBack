# LoopBack v1.1.0

A small, offline-first app that brings unfinished activities back into sight. Starts require **tap → confirm/adjust duration → start**. Reminders **repeat until handled**. Activity chains are explicit: finishing the washer presents a confirmation to start the dryer; it does not assume you've moved the clothes.

## Visual update in v1.1

This release retains the existing features and native reminder engine while simplifying the interface: compact status summary, flatter action tiles, neutral off-white background, restrained sage accent, tighter typography, quieter notifications, and simplified bottom navigation. Active loops move above action presets whenever there is something in progress.

## What's included

- Quick-start actions: washer, dryer, put laundry away, dishwasher, break, cleaner soaking
- Create/edit/delete actions, durations, custom reminder text, repeat intervals (5/10/15/30/60 min), optional next step
- Multiple concurrent timers with time remaining, overdue indication, snooze, adjust, and handled controls
- Native Android repeating alarms independent of the open webpage, one alarm per activity
- Native local notifications with **Open LoopBack** and **Remind in 10 min** actions
- Restore pending alarms after reboot/app upgrade, and on opening the app
- Permissions/settings visibility for notification and exact-alarm access
- Local action and history storage, JSON backup import/export
- Mobile-first responsive interface; web preview runs without installing any packages

## Try the browser preview now (no dependencies)

From this project folder:

```sh
node tools/serve.mjs
```

Open **http://localhost:8765** on the same computer. Browser timers and notifications are strictly **foreground previews**. A browser/PWA cannot reliably repeat notifications while closed; use the Android install below for that feature.

## Build/install on Android

Prerequisites: Node.js 22+, npm, Android Studio with Android SDK, and a connected Android device or emulator. Do this on a computer (not directly in your phone's mobile browser).

```sh
npm install
npm run android:init
npm run android:open
```

This creates the Android project, copies the custom native plugin, adds Android permissions/receivers, syncs the Capacitor assets, and opens Android Studio. In Android Studio, select your phone/emulator and click **Run**. For a distributable APK, use **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

On subsequent web changes:

```sh
npm run android:sync
```

On subsequent native plugin changes:

```sh
npm run android:prepare
```

**Important:** Android 13+ requires notification permission, and Android 12+ may require Alarms & reminders special access. In the app, open **Settings** and grant both. If precise alarms are denied, LoopBack falls back to inexact scheduled alarms; reminders can arrive late due to Android battery management. On some devices, aggressive vendor battery settings may also delay alarms. A force-stopped app cannot deliver alarms until you open it again. Use a dedicated alarm for urgent/safety-critical needs.

## Architecture

- `www/`: plain, dependency-free HTML/CSS/JS interface and browser preview
- `android-native/LoopBackRemindersPlugin.java`: Capacitor bridge APIs (`schedule`, `snooze`, `finish`, `list`, `status`, permissions)
- `android-native/ReminderReceiver.java`: OS broadcast that shows a notification and schedules the *next* alert; no WebView or ongoing service needed
- `android-native/ReminderStore.java`: persists active runs in native SharedPreferences
- `android-native/ReminderScheduler.java`: exact-when-allowed AlarmManager; graceful inexact fallback
- `android-native/RestoreReceiver.java`: reboot, app update, and alarm-access grant repair
- `tools/prepare-android.mjs`: idempotent copy/install of native sources into Capacitor Android project
- `www/sw.js`: offline cache for browser version, not a background alarm mechanism

### Data ownership

Action presets/history are kept in WebView localStorage. Active Android runs are held in native SharedPreferences, so native reminder notifications continue when the JavaScript app is not executing. There is no backend, login, analytics, or external network service.

### UX decisions

- One button per common activity; always confirm time before starting
- A running/overdue activity is an **open loop**, not a completed item merely because its timer elapsed
- Swiping away a notification never completes the activity
- The user must tap **Handled** or **Next step** in the app to clear it
- Activity chains stop at a start confirmation for the next step
- No streaks, gamification penalties, or overloaded task lists

## Suggested device acceptance test

1. Set a washer action to 1 minute with a 5-minute repeat interval; press Start.
2. Lock the phone or close the app. Verify the first Android notification appears, acknowledging that OS conditions may delay it.
3. Swipe the notification away. Do not tap Handled. Verify it reminds again at the next allowed alarm.
4. Press **Remind in 10 min** from the notification. Verify the active card updates when you open LoopBack.
5. Press **Next step** for Washer. Verify that Dryer displays a confirmation sheet, not an automatically started timer.
6. Start Dryer; reboot the device. Verify the running timer is restored and will notify after boot.
7. Try denying notification permission and exact-alarm access; verify the app warns you and does not claim guaranteed precision.

## Current limitations

- This is an Android-first source project. No prebuilt APK is provided here; native code must be compiled in Android Studio.
- The browser preview cannot alert reliably with a closed/terminated browser.
- Exact-alarm or doze restrictions may delay repeat timing, especially at 5-minute intervals.
- Notifications offer Snooze or Open; completing a chain happens in the app to avoid falsely assuming a subsequent action was performed.
- No account sync or sharing; local backups contain presets/history, not currently running native alarms.
- The Android implementation is source-reviewed but must be verified on a real Android phone before relying on it.

## Security/privacy

No app secrets; user-authored message text remains on device. Backup JSON imports validate preset fields and have size and count bounds. The app intentionally does not request Contacts, Location, Camera, or Internet access beyond the usual Capacitor WebView defaults.
