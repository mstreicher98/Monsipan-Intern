package at.monsipan.intern;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Drucken und PDFs speichern in der App. Die Android-WebView kann beides nicht
 * von selbst: window.print() tut dort nichts, und Download-Links laufen ins Leere.
 * Die Seite ruft deshalb diese beiden Methoden auf, wenn sie in der App läuft.
 */
@CapacitorPlugin(name = "MonsipanNative")
public class NativePlugin extends Plugin {

    /**
     * Wurde die App mit Firebase gebaut (google-services.json)? Nur dann darf die
     * Seite Push anmelden – ohne Firebase würde das Anmelden die App beenden.
     * Das Gradle-Plugin legt dafür die Ressource google_app_id an.
     */
    @PluginMethod
    public void pushAvailable(PluginCall call) {
        Context context = getContext();
        int id = context.getResources().getIdentifier("google_app_id", "string", context.getPackageName());
        JSObject ret = new JSObject();
        ret.put("available", id != 0);
        call.resolve(ret);
    }

    /** Die aktuelle Seite über den Android-Druckdienst drucken – dort geht auch „Als PDF speichern" */
    @PluginMethod
    public void print(PluginCall call) {
        String title = call.getString("title", "Monsipan Intern");
        getActivity().runOnUiThread(() -> {
            PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
            if (printManager == null) {
                call.reject("Drucken wird auf diesem Gerät nicht unterstützt.");
                return;
            }
            PrintDocumentAdapter adapter = getBridge().getWebView().createPrintDocumentAdapter(title);
            PrintAttributes attributes = new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build();
            printManager.print(title, adapter, attributes);
            call.resolve();
        });
    }

    /** PDF (als Base64) in „Downloads" ablegen und gleich zum Ansehen öffnen */
    @PluginMethod
    public void savePdf(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("Es kamen keine PDF-Daten an.");
            return;
        }
        String name = safeName(call.getString("name", "dokument.pdf"));
        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Die PDF-Daten sind beschädigt.");
            return;
        }

        try {
            Uri uri = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? saveToDownloads(name, bytes) : saveToAppFolder(name, bytes);
            JSObject result = new JSObject();
            result.put("opened", open(uri));
            call.resolve(result);
        } catch (IOException e) {
            call.reject("Das PDF konnte nicht gespeichert werden: " + e.getMessage());
        }
    }

    /** Ab Android 10: in den öffentlichen Ordner „Downloads", ohne eigene Berechtigung */
    private Uri saveToDownloads(String name, byte[] bytes) throws IOException {
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        ContentResolver resolver = getContext().getContentResolver();
        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IOException("Datei ließ sich nicht anlegen");
        try (OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) throw new IOException("Datei ließ sich nicht öffnen");
            out.write(bytes);
        }
        return uri;
    }

    /** Ältere Geräte: in den Download-Ordner der App, freigegeben über den FileProvider */
    private Uri saveToAppFolder(String name, byte[] bytes) throws IOException {
        File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) dir = new File(getContext().getCacheDir(), "pdf");
        if (!dir.exists() && !dir.mkdirs()) throw new IOException("Ordner ließ sich nicht anlegen");
        File file = new File(dir, name);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        return FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
    }

    /** Mit einer PDF-App öffnen – von dort lässt es sich auch teilen oder drucken */
    private boolean open(Uri uri) {
        Intent view = new Intent(Intent.ACTION_VIEW);
        view.setDataAndType(uri, "application/pdf");
        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            getActivity().startActivity(Intent.createChooser(view, "PDF öffnen"));
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        }
    }

    /** Nur Zeichen, die jedes Dateisystem verträgt; immer mit .pdf am Ende */
    private static String safeName(String name) {
        String clean = name.replaceAll("[^A-Za-z0-9._-]", "_");
        if (clean.isEmpty()) clean = "dokument";
        return clean.toLowerCase().endsWith(".pdf") ? clean : clean + ".pdf";
    }
}
