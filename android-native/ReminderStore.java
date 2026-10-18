package com.loopback.reminders;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/** Native SharedPreferences are authoritative for active loops, even if the WebView is gone. */
public final class ReminderStore {
    private static final String PREFS = "loopback_native_v1";
    private static final String RUNS = "active_runs";
    private ReminderStore() {}

    public static synchronized JSONArray all(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try { return new JSONArray(prefs.getString(RUNS, "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }

    public static synchronized JSONObject find(Context context, String id) {
        JSONArray arr = all(context);
        for (int i=0; i<arr.length(); i++) {
            JSONObject run=arr.optJSONObject(i);
            if(run!=null && id.equals(run.optString("id")))return run;
        }
        return null;
    }

    public static synchronized void put(Context context, JSONObject run) {
        JSONArray old=all(context), out=new JSONArray();
        String id=run.optString("id");
        for(int i=0;i<old.length();i++){
            JSONObject r=old.optJSONObject(i);
            if(r!=null && !id.equals(r.optString("id")))out.put(r);
        }
        out.put(run);
        save(context,out);
    }

    public static synchronized void remove(Context context,String id) {
        JSONArray old=all(context), out=new JSONArray();
        for(int i=0;i<old.length();i++){
            JSONObject r=old.optJSONObject(i);
            if(r!=null && !id.equals(r.optString("id")))out.put(r);
        }
        save(context,out);
    }

    private static void save(Context ctx, JSONArray arr){
        // commit() instead of apply() avoids data loss when a short-lived broadcast process exits.
        ctx.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString(RUNS,arr.toString()).commit();
    }
}
