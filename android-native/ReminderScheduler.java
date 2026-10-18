package com.loopback.reminders;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/** One alarm per active loop. Each firing queues only its next occurrence. */
public final class ReminderScheduler {
    private ReminderScheduler() {}
    public static final String FIRE = "com.loopback.reminders.FIRE";
    public static final String SNOOZE = "com.loopback.reminders.SNOOZE";

    public static int notificationId(String id){return id.hashCode() & 0x7fffffff;}

    static PendingIntent alarmIntent(Context context,String id){
        Intent i=new Intent(context,ReminderReceiver.class);
        i.setAction(FIRE);
        i.setData(Uri.parse("loopback://alarm/"+Uri.encode(id)));
        i.putExtra("id",id);
        return PendingIntent.getBroadcast(context,notificationId(id),i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }

    public static void schedule(Context context,JSONObject run) {
        String id=run.optString("id");
        if(id.isEmpty())return;
        long next=run.optLong("nextAlertAt",run.optLong("dueAt"));
        long when=Math.max(System.currentTimeMillis()+1000,next);
        AlarmManager mgr=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        if(mgr==null)return;
        PendingIntent pi=alarmIntent(context,id);
        // SCHEDULE_EXACT_ALARM may be denied. Never throw away the reminder: fall back.
        try {
            if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S && !mgr.canScheduleExactAlarms()){
                mgr.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);
            } else if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.M){
                mgr.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);
            } else {
                mgr.setExact(AlarmManager.RTC_WAKEUP,when,pi);
            }
        } catch(SecurityException ex) {
            if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.M)
                mgr.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);
            else mgr.set(AlarmManager.RTC_WAKEUP,when,pi);
        }
    }

    public static void cancel(Context context,String id){
        AlarmManager mgr=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        if(mgr!=null)mgr.cancel(alarmIntent(context,id));
        NotificationManager n=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(n!=null)n.cancel(notificationId(id));
    }

    public static void restoreAll(Context context){
        JSONArray runs=ReminderStore.all(context);
        for(int i=0;i<runs.length();i++){
            JSONObject r=runs.optJSONObject(i);
            if(r!=null)schedule(context,r);
        }
    }
}
