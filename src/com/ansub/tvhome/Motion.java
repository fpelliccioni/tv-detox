package com.ansub.tvhome;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.view.View;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

// Views that move behind the page. Both only run while the home screen is on screen, so an app
// in front never pays for them.
final class Motion {
    private Motion() {}

    static View make(Context c, Theme t, int w, int h) {
        if (t.motion == Theme.MATRIX) return new Rain(c);
        if (t.motion == Theme.SLIDESHOW) {
            for (File base : Theme.photoDirs(c)) {
                if (base == null) continue;
                Slideshow s = new Slideshow(c, new File(base, t.folder), w, h);
                if (!s.isEmpty()) return s;
            }
        }
        return null;
    }

    // Columns of falling green characters, the head of each one bright. About 15 frames a second.
    static final class Rain extends View {
        private static final String GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789<>{}[]=+*";
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Random rnd = new Random();
        private float cell;
        private float[] drops;
        private char[][] trail;
        private boolean running;

        Rain(Context c) {
            super(c);
            p.setTypeface(Typeface.MONOSPACE);
        }

        private final Runnable tick = new Runnable() {
            @Override public void run() {
                if (!running) return;
                step();
                invalidate();
                postDelayed(this, 66);
            }
        };

        @Override protected void onSizeChanged(int w, int h, int ow, int oh) {
            cell = Math.max(14, h / 40f);
            p.setTextSize(cell);
            int cols = (int) (w / cell) + 1, rows = (int) (h / cell) + 1;
            drops = new float[cols];
            trail = new char[cols][rows];
            for (int i = 0; i < cols; i++) {
                drops[i] = -rnd.nextInt(rows);
                for (int j = 0; j < rows; j++) trail[i][j] = glyph();
            }
        }

        private char glyph() { return GLYPHS.charAt(rnd.nextInt(GLYPHS.length())); }

        private void step() {
            if (drops == null) return;
            int rows = trail[0].length;
            for (int i = 0; i < drops.length; i++) {
                drops[i] += 0.5f;
                if (drops[i] > rows + 18 && rnd.nextInt(30) == 0) drops[i] = -rnd.nextInt(10);
                int head = (int) drops[i];
                if (head >= 0 && head < rows) trail[i][head] = glyph();
                if (rnd.nextInt(12) == 0) trail[i][rnd.nextInt(rows)] = glyph(); // the odd flicker
            }
        }

        @Override protected void onDraw(Canvas c) {
            if (drops == null) return;
            int rows = trail[0].length;
            for (int i = 0; i < drops.length; i++) {
                int head = (int) drops[i];
                for (int k = 0; k < 18; k++) { // the head and the fading tail above it
                    int j = head - k;
                    if (j < 0 || j >= rows) continue;
                    int a = k == 0 ? 255 : Math.max(0, 170 - k * 10);
                    p.setColor(k == 0 ? Color.argb(255, 200, 255, 210) : Color.argb(a, 0, 255, 65));
                    c.drawText(String.valueOf(trail[i][j]), i * cell, (j + 1) * cell, p);
                }
            }
            c.drawColor(0x66000000); // dim it all, so the apps in front stay readable
        }

        @Override protected void onWindowVisibilityChanged(int v) {
            super.onWindowVisibilityChanged(v);
            running = v == VISIBLE;
            removeCallbacks(tick);
            if (running) post(tick);
        }

        @Override protected void onDetachedFromWindow() {
            running = false;
            removeCallbacks(tick);
            super.onDetachedFromWindow();
        }
    }

    // The photos in a folder, one after another, crossfading every 12 seconds. Only the photo on
    // screen and the next are in memory, each no bigger than the screen.
    static final class Slideshow extends View {
        private final List<File> files = new ArrayList<>();
        private final int w, h;
        private Bitmap now, next;
        private int index;
        private float fade = 1f;
        private boolean running;
        private final Paint p = new Paint(Paint.FILTER_BITMAP_FLAG);
        private final Paint shade = new Paint();

        Slideshow(Context c, File dir, int w, int h) {
            super(c);
            this.w = w;
            this.h = h;
            File[] all = dir == null ? null : dir.listFiles();
            if (all != null) {
                Arrays.sort(all);
                for (File f : all) {
                    String n = f.getName().toLowerCase(java.util.Locale.ROOT);
                    if (n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp")) files.add(f);
                }
            }
            if (!files.isEmpty()) now = Theme.decode(files.get(0).getPath(), w, h);
        }

        boolean isEmpty() { return now == null; }

        private final Runnable advance = new Runnable() {
            @Override public void run() {
                if (!running || files.size() < 2) return;
                index = (index + 1) % files.size();
                next = Theme.decode(files.get(index).getPath(), w, h);
                fade = 0f;
                post(fader);
            }
        };

        private final Runnable fader = new Runnable() {
            @Override public void run() {
                fade = Math.min(1f, fade + 0.05f);
                invalidate();
                if (fade < 1f) { postDelayed(this, 40); return; }
                if (next != null) { now = next; next = null; }
                postDelayed(advance, 12000);
            }
        };

        @Override protected void onDraw(Canvas c) {
            draw(c, now, 255);
            if (next != null) draw(c, next, Math.round(fade * 255));
            shade.setShader(new android.graphics.LinearGradient(0, 0, 0, getHeight(),
                    new int[] {0x80000000, 0x59000000, 0xE6000000}, new float[] {0f, 0.35f, 1f},
                    android.graphics.Shader.TileMode.CLAMP));
            c.drawRect(0, 0, getWidth(), getHeight(), shade);
        }

        private void draw(Canvas c, Bitmap b, int alpha) {
            if (b == null) return;
            float s = Math.max((float) getWidth() / b.getWidth(), (float) getHeight() / b.getHeight());
            int dw = Math.round(b.getWidth() * s), dh = Math.round(b.getHeight() * s);
            int x = (getWidth() - dw) / 2, y = (getHeight() - dh) / 2;
            p.setAlpha(alpha);
            c.drawBitmap(b, null, new android.graphics.Rect(x, y, x + dw, y + dh), p);
        }

        @Override protected void onWindowVisibilityChanged(int v) {
            super.onWindowVisibilityChanged(v);
            running = v == VISIBLE;
            removeCallbacks(advance);
            removeCallbacks(fader);
            if (running) postDelayed(advance, 12000);
        }

        @Override protected void onDetachedFromWindow() {
            running = false;
            removeCallbacks(advance);
            removeCallbacks(fader);
            super.onDetachedFromWindow();
        }
    }
}
