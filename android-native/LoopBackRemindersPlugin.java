package com.loopback.reminders;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONObject;

@CapacitorPlugin(name="LoopBackReminders", permissions={@Permission(strings={Manifest.permission.POST_NOTIFICATIONS},alias="notifications")})
public class LoopBackRemindersPlugin extends Plugin {
    @PluginMethod public void schedule(PluginCall call){
        try {
            JSONObject run=new JSONObject(call.getData().toString());
            String id=run.optString("id"),title=run.optString("title"),message=run.optString("message");
            int every=run.optInt("repeatMinutes");
            long due=run.optLong("dueAt");
            if(id.isEmpty()||id.length()>100||title.isEmpty()||title.length()>100||message.length()>200||every<1||every>1440||due<=System.currentTimeMillis()){
                call.reject("Invalid reminder");return;
            }
            run.put("nextAlertAt",due);
            ReminderStore.put(getContext(),run);
            ReminderScheduler.schedule(getContext(),run);
            call.resolve();
        }catch(Exception e){call.reject("Could not schedule reminder",e);}
    }

    @PluginMethod public void finish(PluginCall call){
        String id=call.getString("id");if(id==null){call.reject("Missing reminder ID");return;}
        ReminderStore.remove(getContext(),id);
        ReminderScheduler.cancel(getContext(),id);
        call.resolve();
    }

    @PluginMethod public void snooze(PluginCall call){
        String id=call.getString("id");Integer mins=call.getInt("minutes");
        if(id==null||mins==null||mins<1||mins>10080){call.reject("Invalid snooze duration");return;}
        JSONObject run=ReminderStore.find(getContext(),id);
        if(run==null){call.reject("Reminder no longer exists");return;}
        try{
            long next=System.currentTimeMillis()+mins*60_000L;
            run.put("dueAt",next);run.put("nextAlertAt",next);
            ReminderStore.put(getContext(),run);
            ReminderScheduler.cancel(getContext(),id);
            ReminderScheduler.schedule(getContext(),run);
            call.resolve();
        }catch(Exception e){call.reject("Could not adjust reminder",e);}
    }

    @PluginMethod public void list(PluginCall call){
        JSObject result=new JSObject();
        result.put("runs",ReminderStore.all(getContext()));
        call.resolve(result);
    }

    @PluginMethod public void status(PluginCall call){resolveStatus(call);}
    private void resolveStatus(PluginCall call){
        JSObject ret=new JSObject();
        boolean notify=true;
        if(Build.VERSION.SDK_INT>=33)notify=getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
        NotificationManager nm=(NotificationManager)getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if(nm!=null)notify=notify&&nm.areNotificationsEnabled();
        AlarmManager am=(AlarmManager)getContext().getSystemService(Context.ALARM_SERVICE);
        boolean exact=Build.VERSION.SDK_INT<Build.VERSION_CODES.S||(am!=null&&am.canScheduleExactAlarms());
        ret.put("notifications",notify);ret.put("exact",exact);
        call.resolve(ret);
    }

    @PluginMethod public void requestNotificationPermission(PluginCall call){
        if(Build.VERSION.SDK_INT>=33 && getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissionForAlias("notifications",call,"notifyPermissionCallback");
        }else resolveStatus(call);
    }
    @PermissionCallback private void notifyPermissionCallback(PluginCall call){resolveStatus(call);}

    @PluginMethod public void openExactAlarmSettings(PluginCall call){
        try{
            if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S){
                Intent intent=new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getContext().getPackageName()));
                getActivity().startActivity(intent);
            }
            call.resolve();
        }catch(Exception e){call.reject("Could not open alarm settings",e);}
    }
}
