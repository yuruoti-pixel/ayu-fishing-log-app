package jp.yuruoti.ayufishinglog;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NativeZipPickerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
