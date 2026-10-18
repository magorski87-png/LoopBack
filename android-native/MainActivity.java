package com.loopback.reminders;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState){
        registerPlugin(LoopBackRemindersPlugin.class);
        super.onCreate(savedInstanceState);
        ReminderScheduler.restoreAll(this);
    }
}
