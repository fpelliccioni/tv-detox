package com.ansub.tvhome;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;

// A theme is the whole look at once: background, clock, tiles, focus and menus. Classic is the
// original look and keeps the wallpaper picked in Settings; the others bring their own background.
// Saved by name, like the wallpaper. Each theme starts from Classic's values and changes a few.
final class Theme {
    static final int CLOCK_BIG = 0, CLOCK_SMALL = 1, CLOCK_CENTER = 2, CLOCK_SCOREBOARD = 3, CLOCK_C64 = 4,
            CLOCK_TERMINAL = 5;
    static final int PLAIN = 0, PITCH = 1, SYNTHWAVE = 2, PHOTO = 3, RIVER = 4, ARGENTINA = 5, C64 = 6, SCANLINES = 7;
    static final int STILL = 0, MATRIX = 1, SLIDESHOW = 2;
    // Your photos, copied to the TV by fotos.sh:  /sdcard/TVHome/fondo.jpg (Foto), /sdcard/TVHome/river/ (River).
    // The app's own folder works too, on TVs where adb can write there.
    static final String PHOTO_FILE = "fondo.jpg";

    static java.io.File[] photoDirs(android.content.Context c) {
        return new java.io.File[] {new java.io.File(android.os.Environment.getExternalStorageDirectory(), "TVHome"),
                c.getExternalFilesDir(null)};
    }

    final String name;
    int[] bg;              // gradient like the wallpapers; null: the saved wallpaper (Classic)
    int pattern = PLAIN;   // drawn over bg
    int motion = STILL;    // a view behind the page: falling code, or a slideshow of photos
    String folder;         // the slideshow's photos, inside the app's folder
    int accent;            // outline of the focused tile; 0: none, focus is the glass alone
    boolean neon;          // every tile keeps a faint accent outline, bright when focused
    int radius = 22;
    float zoom = 1.1f;     // focused tile scale
    int perRow = 6;
    int clock = CLOCK_BIG;
    boolean date = true;
    String font;           // family for the clock and labels; null: the TV's own (MiLan Pro on Xiaomi)
    int clockColor = 0xFFFFFFFF;
    int textColor = 0xFFFFFFFF; // labels and menus
    boolean labels;        // every app shows its name, not just the focused one
    boolean caps;          // names in capitals
    int glass = 0x13FFFFFF;     // icon tiles, unfocused and focused
    int glassFocus = 0x38FFFFFF;
    int panel = 0xFF161113;     // side panels and dropdown menus
    String[] phrases;      // one shows under the clock, a different one each time Home comes back

    private Theme(String name) { this.name = name; }

    private static Theme make(String name) { return new Theme(name); }
    private Theme bg(int... c) { bg = c; return this; }
    private Theme pattern(int p) { pattern = p; return this; }
    private Theme motion(int m, String f) { motion = m; folder = f; return this; }
    private Theme accent(int c, boolean n) { accent = c; neon = n; return this; }
    private Theme shape(int r, float z, int row) { radius = r; zoom = z; perRow = row; return this; }
    private Theme clock(int kind, boolean d, int color) { clock = kind; date = d; clockColor = color; return this; }
    private Theme font(String f) { font = f; return this; }
    private Theme text(int c, boolean all, boolean upper) { textColor = c; labels = all; caps = upper; return this; }
    private Theme glass(int g, int f, int p) { glass = g; glassFocus = f; panel = p; return this; }
    private Theme say(String... p) { phrases = p; return this; }

    static final Theme[] ALL = {
        make("Clásico"),
        // Black like a cinema, Netflix red on the focused app, a small clock so the apps lead.
        make("Cine").bg(0xFF050505, 0xFF020202, 0xFF000000, 0x14FFFFFF, 0x30B0060F).accent(0xFFE50914, false)
                .shape(10, 1.12f, 5).clock(CLOCK_SMALL, true, 0xFFFFFFFF).font("sans-serif-condensed")
                .glass(0x10FFFFFF, 0x26FFFFFF, 0xFF0C0C0C),
        // Flat graphite, a thin centred clock, nothing else.
        make("Minimal").bg(0xFF1D1E20, 0xFF1A1B1D, 0xFF161719, 0, 0).shape(6, 1.06f, 6)
                .clock(CLOCK_CENTER, false, 0xF2FFFFFF).font("sans-serif-light").glass(0x0DFFFFFF, 0x2EFFFFFF, 0xFF202123),
        // A mowed pitch under floodlights, the clock on a scoreboard.
        make("Estadio").bg(0xFF1B5E34, 0xFF124526, 0xFF082414, 0x40FFFFFF, 0x26FFFFFF).pattern(PITCH)
                .accent(0xFFFFFFFF, false).shape(14, 1.1f, 6).clock(CLOCK_SCOREBOARD, true, 0xFFFFC400)
                .font("sans-serif-condensed").glass(0x1AFFFFFF, 0x40FFFFFF, 0xFF0B2414),
        // A photo of your own, darkened at the bottom so the apps stay readable.
        make("Foto").bg(0xFF14243A, 0xFF0C1626, 0xFF050A12, 0x384A6CFF, 0x2E26B4C8).pattern(PHOTO)
                .accent(0xFFFFFFFF, false).glass(0x26000000, 0x50FFFFFF, 0xF0101418),
        // 80s synthwave: sunset grid, neon outlines, a monospace clock.
        make("Retro").bg(0xFF2A0B3D, 0xFF170828, 0xFF0A0314, 0x70FF2E97, 0x6000E5FF).pattern(SYNTHWAVE)
                .accent(0xFF00E5FF, true).shape(4, 1.08f, 6).clock(CLOCK_BIG, true, 0xFFFF6AD5).font("monospace")
                .text(0xFFFFFFFF, true, false).glass(0x1A000000, 0x3300E5FF, 0xFF14061F),
        // River Plate: white shirt, red sash, and the fans' photos going by behind, if there are any.
        make("River").bg(0xFF141414, 0xFF0B0B0B, 0xFF050505, 0x26FFFFFF, 0x40E30613).pattern(RIVER)
                .motion(SLIDESHOW, "river").accent(0xFFE30613, false).shape(16, 1.1f, 6)
                .clock(CLOCK_BIG, true, 0xFFFFFFFF).font("sans-serif-condensed").glass(0x26000000, 0x50FFFFFF, 0xF0120808)
                .say("Vamos River, vamos River", "El más grande sigue siendo River", "Los Borrachos del Tablón",
                        "Monumental, la casa del más grande", "Madrid, 9 de diciembre de 2018", "Siempre de River"),
        // Celeste and white, the Sun of May, and the things that make a Sunday.
        make("Argentina").bg(0xFF1F5F96, 0xFF13406B, 0xFF0A2440, 0x50FFFFFF, 0x4074ACDF).pattern(ARGENTINA)
                .accent(0xFFF6B40E, false).shape(18, 1.1f, 6).clock(CLOCK_BIG, true, 0xFFFFFFFF)
                .glass(0x1FFFFFFF, 0x45FFFFFF, 0xF00E2A47)
                .say("Che, ¿unos mates?", "Hoy hay asado", "¡Vamos Argentina! ★★★", "Dale que va",
                        "Empanadas de carne, cortadas a cuchillo", "Domingo, fútbol y fernet", "Mate amargo y a laburar"),
        // Green code raining down the screen, like the Matrix.
        make("Matrix").bg(0xFF000000, 0xFF000000, 0xFF000000, 0, 0x1800FF41).motion(MATRIX, null)
                .accent(0xFF00FF41, true).shape(4, 1.08f, 6).clock(CLOCK_BIG, true, 0xFF00FF41).font("monospace")
                .text(0xFFB8FFC8, true, false).glass(0x2A000000, 0x3300FF41, 0xF0000800)
                .say("wake up, neo...", "follow the white rabbit", "there is no spoon", "$ sudo make me a sandwich",
                        "it works on my machine", "// TODO: go outside", "git push --force (yolo)"),
        // The Commodore 64 start-up screen: light blue on blue inside a border, capitals everywhere.
        make("C64").bg(0xFF352879, 0xFF352879, 0xFF352879, 0, 0).pattern(C64).accent(0xFF8A7EE0, false)
                .shape(0, 1.06f, 6).clock(CLOCK_C64, false, 0xFF8A7EE0).font("monospace")
                .text(0xFF8A7EE0, true, true).glass(0xFF40349A, 0xFF6C5EB5, 0xFF2A1F66),
        // A terminal to type commands into: open apps, change theme, see the system.
        make("Terminal").bg(0xFF050805, 0xFF030503, 0xFF000000, 0x1022FF55, 0).pattern(SCANLINES)
                .accent(0xFF33FF66, false).shape(2, 1.05f, 6).clock(CLOCK_TERMINAL, false, 0xFF33FF66).font("monospace")
                .text(0xFF33FF66, true, false).glass(0x1433FF66, 0x3333FF66, 0xF0020A04),
    };

    // The theme a fresh install starts with.
    static final String DEFAULT = "Clásico";

    // The theme with this name; nothing saved yet, or a name that's gone, gets the default.
    static int indexOf(String name) {
        int i = find(name);
        return i >= 0 ? i : Math.max(0, find(DEFAULT));
    }

    private static int find(String name) {
        for (int i = 0; i < ALL.length; i++) if (ALL[i].name.equals(name)) return i;
        return -1;
    }

    String phrase() {
        return phrases == null ? null : phrases[(int) (Math.random() * phrases.length)];
    }

    // Drawn over the gradient. Plain themes get nothing, so they cost the same as before.
    static Drawable overlay(Theme t, java.io.File[] dirs, int width, int height) {
        if (t.pattern == PHOTO) {
            for (java.io.File dir : dirs == null ? new java.io.File[0] : dirs) {
                java.io.File f = dir == null ? null : new java.io.File(dir, PHOTO_FILE);
                Bitmap b = f != null && f.exists() ? decode(f.getPath(), width, height) : null;
                if (b != null) return new Photo(b, true);
            }
            return null;
        }
        return t.pattern == PLAIN ? null : new Pattern(t.pattern);
    }

    // Decodes a photo no bigger than the screen needs, to keep RAM low.
    static Bitmap decode(String path, int w, int h) {
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(path, o);
            if (o.outWidth <= 0) return null;
            int s = 1;
            while (o.outWidth / (s * 2) >= w && o.outHeight / (s * 2) >= h) s *= 2;
            o = new BitmapFactory.Options();
            o.inSampleSize = s;
            return BitmapFactory.decodeFile(path, o);
        } catch (Throwable e) {
            return null;
        }
    }

    private abstract static class Flat extends Drawable {
        @Override public void setAlpha(int a) {}
        @Override public void setColorFilter(ColorFilter f) {}
        @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
    }

    private static final class Pattern extends Flat {
        private final int kind;
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        Pattern(int kind) { this.kind = kind; }

        @Override public void draw(Canvas c) {
            Rect r = getBounds();
            switch (kind) {
                case PITCH: pitch(c, r); break;
                case SYNTHWAVE: synthwave(c, r); break;
                case RIVER: sash(c, r); break;
                case ARGENTINA: argentina(c, r); break;
                case C64: c64(c, r); break;
                case SCANLINES: scanlines(c, r, 0x14000000); break;
            }
        }

        // Lighter and darker mowing bands, then the halfway line and centre circle, faint.
        private void pitch(Canvas c, Rect r) {
            int w = r.width(), h = r.height(), bands = 12;
            p.setStyle(Paint.Style.FILL);
            p.setColor(0x0FFFFFFF);
            for (int i = 0; i < bands; i += 2)
                c.drawRect(r.left + w * i / bands, r.top, r.left + w * (i + 1) / bands, r.bottom, p);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(Math.max(2, w / 640f));
            p.setColor(0x1CFFFFFF);
            c.drawLine(r.centerX(), r.top, r.centerX(), r.bottom, p);
            c.drawCircle(r.centerX(), r.centerY(), h * 0.17f, p);
        }

        // A sun on the horizon, a perspective grid below it, scanlines over everything.
        private void synthwave(Canvas c, Rect r) {
            int w = r.width(), h = r.height();
            float horizon = r.top + h * 0.55f;
            p.setStyle(Paint.Style.FILL);
            p.setShader(new LinearGradient(0, horizon - h * 0.28f, 0, horizon, 0xE6FFD23D, 0xE6FF2E97, Shader.TileMode.CLAMP));
            c.drawCircle(r.left + w * 0.72f, horizon, h * 0.26f, p);
            p.setShader(null);
            p.setColor(0xFF0A0314);
            c.drawRect(r.left, horizon, r.right, r.bottom, p);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(Math.max(1, w / 960f));
            p.setColor(0x66FF2E97);
            for (int i = 0; i <= 10; i++) { // lines towards the vanishing point
                float x = r.left + w * i / 10f;
                c.drawLine(r.left + w / 2f + (x - r.left - w / 2f) * 0.08f, horizon, x + (x - r.left - w / 2f) * 1.6f, r.bottom, p);
            }
            for (float d = 4; d < 400; d *= 1.55f) { // rows, closer together towards the horizon
                float y = horizon + d * h / 520f;
                if (y > r.bottom) break;
                c.drawLine(r.left, y, r.right, y, p);
            }
            scanlines(c, r, 0x0A000000);
        }

        // River's shirt: the red sash from the top left down to the bottom right, edged in white.
        private void sash(Canvas c, Rect r) {
            int w = r.width(), h = r.height();
            float band = h * 0.2f, x0 = r.left + w * 0.30f, x1 = r.left + w * 0.82f;
            Path s = new Path();
            s.moveTo(x0, r.top);
            s.lineTo(x0 + band * 1.25f, r.top);
            s.lineTo(x1 + band * 1.25f, r.bottom);
            s.lineTo(x1, r.bottom);
            s.close();
            p.setStyle(Paint.Style.FILL);
            p.setColor(0xB3E30613);
            c.drawPath(s, p);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(h / 90f);
            p.setColor(0x80FFFFFF);
            c.drawPath(s, p);
        }

        // Faint flag bands, the Sun of May behind the clock, and a few things from home.
        private void argentina(Canvas c, Rect r) {
            int w = r.width(), h = r.height();
            p.setStyle(Paint.Style.FILL);
            p.setColor(0x14FFFFFF);
            c.drawRect(r.left, r.top + h / 3f, r.right, r.top + 2 * h / 3f, p);
            float cx = r.left + w * 0.80f, cy = r.top + h * 0.27f, sun = h * 0.085f;
            p.setColor(0x55F6B40E);
            for (int i = 0; i < 32; i++) { // 32 rays, straight and wavy ones alternating in length
                double a = Math.PI * 2 * i / 32;
                float len = sun * (i % 2 == 0 ? 2.1f : 1.7f);
                Path ray = new Path();
                ray.moveTo(cx + (float) Math.cos(a - 0.05) * sun, cy + (float) Math.sin(a - 0.05) * sun);
                ray.lineTo(cx + (float) Math.cos(a) * len, cy + (float) Math.sin(a) * len);
                ray.lineTo(cx + (float) Math.cos(a + 0.05) * sun, cy + (float) Math.sin(a + 0.05) * sun);
                ray.close();
                c.drawPath(ray, p);
            }
            p.setColor(0x80F6B40E);
            c.drawCircle(cx, cy, sun, p);
            // Mate, asado, empanadas, football, wine, guitar, the cup: scattered down the right side.
            String[] things = {"🧉", "🥩", "🥟", "⚽", "🍷", "🎸", "🏆", "🧉", "🥐"};
            float[][] at = {{0.62f, 0.10f}, {0.93f, 0.12f}, {0.66f, 0.40f}, {0.95f, 0.45f}, {0.55f, 0.26f},
                    {0.74f, 0.50f}, {0.88f, 0.33f}, {0.48f, 0.08f}, {0.83f, 0.06f}};
            Paint e = new Paint(Paint.ANTI_ALIAS_FLAG);
            e.setTextSize(h * 0.06f);
            e.setAlpha(150);
            for (int i = 0; i < things.length; i++)
                c.drawText(things[i], r.left + w * at[i][0], r.top + h * at[i][1] + h * 0.06f, e);
        }

        // The light blue border around the blue screen.
        private void c64(Canvas c, Rect r) {
            int w = r.width(), h = r.height();
            float bx = w * 0.035f, by = h * 0.045f;
            p.setStyle(Paint.Style.FILL);
            p.setColor(0xFF6C5EB5);
            c.drawRect(r.left, r.top, r.right, r.top + by, p);
            c.drawRect(r.left, r.bottom - by, r.right, r.bottom, p);
            c.drawRect(r.left, r.top, r.left + bx, r.bottom, p);
            c.drawRect(r.right - bx, r.top, r.right, r.bottom, p);
        }

        private void scanlines(Canvas c, Rect r, int color) {
            p.setShader(null);
            p.setStyle(Paint.Style.STROKE);
            p.setColor(color);
            p.setStrokeWidth(Math.max(1, r.height() / 540f));
            for (float y = r.top; y < r.bottom; y += Math.max(3, r.height() / 270f)) c.drawLine(r.left, y, r.right, y, p);
        }
    }

    // A photo, centre-cropped to the screen, darkened (more at the bottom) so white labels stay readable.
    static final class Photo extends Flat {
        private final Bitmap b;
        private final boolean shadeBottom;
        private final Paint p = new Paint(Paint.FILTER_BITMAP_FLAG);
        private final Paint shade = new Paint();
        Photo(Bitmap b, boolean shadeBottom) { this.b = b; this.shadeBottom = shadeBottom; }

        @Override public void draw(Canvas c) {
            Rect r = getBounds();
            float s = Math.max((float) r.width() / b.getWidth(), (float) r.height() / b.getHeight());
            int dw = Math.round(b.getWidth() * s), dh = Math.round(b.getHeight() * s);
            int x = r.left + (r.width() - dw) / 2, y = r.top + (r.height() - dh) / 2;
            c.drawBitmap(b, null, new Rect(x, y, x + dw, y + dh), p);
            shade.setShader(new LinearGradient(0, r.top, 0, r.bottom,
                    shadeBottom ? new int[] {0x59000000, 0x33000000, 0xD9000000} : new int[] {0x99000000, 0x66000000, 0xE6000000},
                    new float[] {0f, 0.35f, 1f}, Shader.TileMode.CLAMP));
            c.drawRect(r, shade);
        }
    }

    static Typeface typeface(String family, boolean bold) {
        return Typeface.create(family, bold ? Typeface.BOLD : Typeface.NORMAL);
    }
}
