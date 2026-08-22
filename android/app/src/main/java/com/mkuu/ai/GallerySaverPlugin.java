package com.mkuu.ai;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.util.Base64;

@CapacitorPlugin(name = "GallerySaver")
public class GallerySaverPlugin extends Plugin {
    @PluginMethod
    public void saveImage(PluginCall call) {
        String filename = call.getString("filename", "mkuu_image.png");
        String base64 = call.getString("base64");
        String mimeType = call.getString("mimeType", "image/png");

        if (base64 == null || base64.isEmpty()) {
            call.reject("Picha haijapatikana.");
            return;
        }

        try {
            byte[] bytes = Base64.getDecoder().decode(base64);
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
            values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/MKUU AI");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }

            Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                call.reject("Android haikuweza kuunda picha kwenye Gallery.");
                return;
            }

            try (OutputStream output = resolver.openOutputStream(uri)) {
                if (output == null) throw new Exception("Output stream haikupatikana.");
                output.write(bytes);
            } catch (Exception writeError) {
                resolver.delete(uri, null, null);
                throw writeError;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues done = new ContentValues();
                done.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, done, null, null);
            }

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            result.put("filename", filename);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Picha haikuweza kuhifadhiwa Gallery: " + e.getMessage(), e);
        }
    }
}
