package com.loopback.reminders;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import org.json.JSONObject;

/** Fires independently of JavaScript/WebView and keeps rescheduling until finished. */
public class ReminderReceiver extends BroadcastReceiver {
    private static final String CHANNEL="loopback_reminders_v1";

    @Override public void onReceive(Context ctx,Intent intent){
        if(intent==null)return;
        String id=intent.getStringExtra("id");
        if(id==null||id.isEmpty())return;
        JSONObject run=ReminderStore.find(ctx,id);
        if(run==null){ReminderScheduler.cancel(ctx,id);return;}
        if(ReminderScheduler.SNOOZE.equals(intent.getAction())){
            try {
                long when=System.currentTimeMillis()+10*60_000L;
                run.put("dueAt",when);run.put("nextAlertAt",when);
                ReminderStore.put(ctx,run);
                ReminderScheduler.cancel(ctx,id);
                ReminderScheduler.schedule(ctx,run);
            } catch(Exception ignored) {}
            return;
        }
        if(!ReminderScheduler.FIRE.equals(intent.getAction()))return;
        long now=System.currentTimeMillis();
        // Ignores stale alarm intents after a snooze or manual schedule adjustment.
        if(run.optLong("nextAlertAt",Long.MAX_VALUE)>now+2_000L){
            ReminderScheduler.schedule(ctx,run);return;
        }
        try {
            show(ctx,run);
            int min=Math.max(1,run.optInt("repeatMinutes",10));
            run.put("nextAlertAt",now+min*60_000L);
            ReminderStore.put(ctx,run);
            ReminderScheduler.schedule(ctx,run);
        }catch(Exception ignored){}
    }

    private void show(Context ctx,JSONObject run){
        NotificationManager mgr=(NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if(mgr==null)return;
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O){
            NotificationChannel channel=new NotificationChannel(CHANNEL,"Activity reminders",NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Reminders for open LoopBack activities");
            mgr.createNotificationChannel(channel);
        }
        if(Build.VERSION.SDK_INT>=33 && ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
        String id=run.optString("id");
        Intent open=new Intent(ctx,MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.setData(Uri.parse("loopback://open/"+Uri.encode(id)));
        PendingIntent openPi=PendingIntent.getActivity(ctx,ReminderScheduler.notificationId(id),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Intent snooze=new Intent(ctx,ReminderReceiver.class);
        snooze.setAction(ReminderScheduler.SNOOZE);
        snooze.setData(Uri.parse("loopback://snooze/"+Uri.encode(id)));
        snooze.putExtra("id",id);
        PendingIntent snoozePi=PendingIntent.getBroadcast(ctx,ReminderScheduler.notificationId(id),snooze,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder n = Build.VERSION.SDK_INT>=Build.VERSION_CODES.O ? new Notification.Builder(ctx,CHANNEL) : new Notification.Builder(ctx);
        n.setContentTitle("LoopBack · "+run.optString("title","Activity ready"))
         .setContentText(run.optString("message","Time to check your activity."))
         .setStyle(new Notification.BigTextStyle().bigText(run.optString("message","Time to check your activity.")))
         .setSmallIcon(android.R.drawable.ic_dialog_info)
         .setAutoCancel(true)
         .setCategory(Notification.CATEGORY_REMINDER)
         .setVisibility(Notification.VISIBILITY_PRIVATE)
         .setContentIntent(openPi)
         .addAction(android.R.drawable.ic_media_pause,"Remind in 10 min",snoozePi)
         .addAction(android.R.drawable.ic_menu_view,"Open LoopBack",openPi);
        if(Build.VERSION.SDK_INT<Build.VERSION_CODES.O){n.setPriority(Notification.PRIORITY_HIGH);n.setDefaults(Notification.DEFAULT_ALL);}
        mgr.notify(ReminderScheduler.notificationId(id),n.build());
    }
}
