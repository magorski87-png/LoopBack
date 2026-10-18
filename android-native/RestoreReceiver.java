package com.loopback.reminders;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Restores still-open alarms after device restart, package replacement, permission grant. */
public class RestoreReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        ReminderScheduler.restoreAll(context);
    }
}
