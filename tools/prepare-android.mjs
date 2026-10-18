import {existsSync} from 'node:fs';
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const android=path.join(root,'android');
if(!existsSync(android)){
  console.error('Android platform missing. First run: npm run android:init');process.exit(1);
}
const dest=path.join(android,'app','src','main','java','com','loopback','reminders');
await mkdir(dest,{recursive:true});
const files=['ReminderStore.java','ReminderScheduler.java','ReminderReceiver.java','RestoreReceiver.java','LoopBackRemindersPlugin.java','MainActivity.java'];
for(const f of files)await copyFile(path.join(root,'android-native',f),path.join(dest,f));
const manifestFile=path.join(android,'app','src','main','AndroidManifest.xml');
let manifest=await readFile(manifestFile,'utf8');
for(const permission of ['android.permission.POST_NOTIFICATIONS','android.permission.RECEIVE_BOOT_COMPLETED','android.permission.SCHEDULE_EXACT_ALARM']){
  if(!manifest.includes(`android:name="${permission}"`)){
    manifest=manifest.replace(/<application\b/,`<uses-permission android:name="${permission}" />\n    <application`);
  }
}
const receivers=`
        <receiver android:name=".ReminderReceiver" android:exported="false" />
        <receiver android:name=".RestoreReceiver" android:exported="true">
            <intent-filter><action android:name="android.intent.action.BOOT_COMPLETED" /></intent-filter>
            <intent-filter><action android:name="android.intent.action.MY_PACKAGE_REPLACED" /></intent-filter>
            <intent-filter><action android:name="android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" /></intent-filter>
        </receiver>`;
if(!manifest.includes('.ReminderReceiver')){
  manifest=manifest.replace(/<application\b[^>]*>/, match=>match+receivers);
}
await writeFile(manifestFile,manifest);
console.log('Native LoopBack plugin, background alarm receivers, and permissions installed.');
