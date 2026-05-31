package jp.yuruoti.ayufishinglog;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

@CapacitorPlugin(name = "NativeZipPicker")
public class NativeZipPickerPlugin extends Plugin {
    @PluginMethod
    public void pickZip(PluginCall call) {
        refreshSavedZipFiles(() -> openZipPicker(call));
    }

    private void openZipPicker(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Uri initialUri = DocumentsContract.buildDocumentUri(
                "com.android.externalstorage.documents",
                "primary:Documents/ayu-fishing-log"
            );
            intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, initialUri);
        }
        startActivityForResult(call, intent, "pickZipResult");
    }

    private void refreshSavedZipFiles(Runnable done) {
        File folder = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), "ayu-fishing-log");
        File[] files = folder.listFiles((dir, name) -> name.toLowerCase().endsWith(".zip"));
        if (files == null || files.length == 0) {
            done.run();
            return;
        }
        List<String> paths = new ArrayList<>();
        for (File file : files) paths.add(file.getAbsolutePath());
        AtomicInteger remaining = new AtomicInteger(paths.size());
        MediaScannerConnection.scanFile(
            getContext(),
            paths.toArray(new String[0]),
            null,
            (path, uri) -> {
                if (remaining.decrementAndGet() == 0) getActivity().runOnUiThread(done);
            }
        );
    }

    @ActivityCallback
    private void pickZipResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            call.reject("pickZip canceled.");
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("pickZip failed.");
            return;
        }
        Uri uri = result.getData().getData();
        try (InputStream input = getContext().getContentResolver().openInputStream(uri);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int length;
            while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
            JSObject response = new JSObject();
            response.put("name", displayName(uri));
            response.put("mimeType", getContext().getContentResolver().getType(uri));
            response.put("size", output.size());
            response.put("data", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("pickZip read failed.", error);
        }
    }

    private String displayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) return cursor.getString(index);
            }
        }
        return "external-backup.zip";
    }
}
