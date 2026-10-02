package at.monsipan.intern;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-eigenes Plugin für Drucken und PDF – muss vor dem Start der Bridge angemeldet sein
        registerPlugin(NativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
