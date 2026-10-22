package com.ansub.tvhome;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Build;
import android.os.SystemClock;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

// The Terminal theme's console: a prompt to type into with the TV's keyboard, and the last lines of
// output above it. The commands only drive the home screen (open apps, change theme, open
// settings, show the system); nothing runs a real shell.
final class Terminal {
    interface Host {
        List<String[]> apps(); // {label, package} of every app that can be opened
        void open(String pkg);
        void theme(String name);
        void settings(boolean network);
    }

    private static final int MAX_LINES = 11;
    private static final String PROMPT = "tv@home:~$ ";

    private final Context c;
    private final Host host;
    private final List<String> lines = new ArrayList<>();
    private final TextView out;
    private final EditText in;
    final LinearLayout view;

    Terminal(Context c, Host host, Theme t, float textPx) {
        this.c = c;
        this.host = host;
        view = new LinearLayout(c);
        view.setOrientation(LinearLayout.VERTICAL);
        android.graphics.Typeface mono = android.graphics.Typeface.MONOSPACE;
        // A terminal window: a thin border, a title bar, then the output and the prompt.
        android.graphics.drawable.GradientDrawable frame = new android.graphics.drawable.GradientDrawable();
        frame.setCornerRadius(textPx / 3);
        frame.setColor(0xD9000000);
        frame.setStroke(Math.max(1, Math.round(textPx / 12)), (t.textColor & 0x00FFFFFF) | 0x66000000);
        view.setBackground(frame);
        int pad = Math.round(textPx * 0.7f);
        view.setPadding(pad, Math.round(textPx * 0.4f), pad, pad);
        TextView title = new TextView(c);
        title.setTypeface(mono);
        title.setTextSize(TypedValue.COMPLEX_UNIT_PX, textPx * 0.8f);
        title.setTextColor((t.textColor & 0x00FFFFFF) | 0x99000000);
        title.setText("● ● ●   tv@home: ~   bash");
        title.setPadding(0, 0, 0, Math.round(textPx * 0.4f));
        view.addView(title);

        out = new TextView(c);
        out.setTypeface(mono);
        out.setTextSize(TypedValue.COMPLEX_UNIT_PX, textPx);
        out.setTextColor(t.textColor);
        out.setShadowLayer(textPx / 2, 0, 0, (t.textColor & 0x00FFFFFF) | 0x80000000);
        out.setGravity(Gravity.TOP);
        view.addView(out, new LinearLayout.LayoutParams(-1, 0, 1f));

        LinearLayout row = new LinearLayout(c);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView prompt = new TextView(c);
        prompt.setTypeface(mono);
        prompt.setTextSize(TypedValue.COMPLEX_UNIT_PX, textPx);
        prompt.setTextColor(0xFFFFFFFF);
        prompt.setText(PROMPT);
        row.addView(prompt);
        in = new EditText(c);
        in.setTypeface(mono);
        in.setTextSize(TypedValue.COMPLEX_UNIT_PX, textPx);
        in.setTextColor(t.textColor);
        in.setHintTextColor((t.textColor & 0x00FFFFFF) | 0x66000000);
        in.setHint("escribí 'help' y OK");
        in.setBackground(null);
        in.setPadding(0, 0, 0, 0);
        in.setSingleLine(true);
        in.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        in.setImeOptions(EditorInfo.IME_ACTION_GO | EditorInfo.IME_FLAG_NO_EXTRACT_UI);
        in.setOnEditorActionListener((v, action, ev) -> {
            if (action == EditorInfo.IME_ACTION_GO || action == EditorInfo.IME_ACTION_DONE
                    || (ev != null && ev.getKeyCode() == KeyEvent.KEYCODE_ENTER && ev.getAction() == KeyEvent.ACTION_DOWN)) {
                submit();
                return true;
            }
            return false;
        });
        // Focused: a soft glow behind the prompt, so it's clear where typing goes.
        in.setOnFocusChangeListener((v, has) -> row.setBackgroundColor(has ? (t.textColor & 0x00FFFFFF) | 0x1A000000 : 0));
        row.addView(in, new LinearLayout.LayoutParams(0, -2, 1f));
        view.addView(row, new LinearLayout.LayoutParams(-1, -2));

        print("Último acceso: " + new SimpleDateFormat("EEE d MMM HH:mm", Locale.getDefault()).format(new Date()));
        print(PROMPT + "neofetch");
        print(neofetch());
        print("Flecha arriba para llegar al prompt, OK para escribir, 'help' para ver los comandos.");
    }

    private void print(String s) {
        for (String l : s.split("\n")) lines.add(l);
        while (lines.size() > MAX_LINES) lines.remove(0);
        out.setText(android.text.TextUtils.join("\n", lines));
    }

    private void submit() {
        String cmd = in.getText().toString().trim();
        in.setText("");
        if (cmd.isEmpty()) return;
        print(PROMPT + cmd);
        run(cmd);
    }

    private void run(String line) {
        String[] parts = line.split("\\s+", 2);
        String cmd = parts[0].toLowerCase(Locale.ROOT), arg = parts.length > 1 ? parts[1].trim() : "";
        switch (cmd) {
            case "help": case "ayuda": case "?":
                print("ls             lista las apps\n"
                    + "open <app|n>   abre una app (o escribí su nombre)\n"
                    + "theme [nombre] lista o cambia el tema\n"
                    + "neofetch       info del sistema\n"
                    + "date  uptime  whoami  echo  clear\n"
                    + "settings  wifi");
                break;
            case "ls": case "apps": case "dir": {
                List<String[]> apps = host.apps();
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < apps.size(); i++) {
                    sb.append(String.format(Locale.ROOT, "%2d %-16s", i + 1, cut(apps.get(i)[0], 16)));
                    if (i % 3 == 2 || i == apps.size() - 1) sb.append('\n');
                }
                print(sb.toString().replaceAll("\n$", ""));
                break;
            }
            case "open": case "abrir": case "run": case "start":
                if (arg.isEmpty()) print("uso: open <nombre o número de 'ls'>");
                else if (!openApp(arg)) print("open: no encuentro '" + arg + "'. Probá 'ls'.");
                break;
            case "theme": case "tema": case "themes": {
                if (arg.isEmpty()) {
                    StringBuilder sb = new StringBuilder("temas:");
                    for (Theme t : Theme.ALL) sb.append(' ').append(t.name);
                    print(sb.toString());
                } else {
                    for (Theme t : Theme.ALL)
                        if (t.name.equalsIgnoreCase(arg) || strip(t.name).equalsIgnoreCase(strip(arg))) {
                            print("cambiando a " + t.name + "...");
                            view.post(() -> host.theme(t.name));
                            return;
                        }
                    print("theme: no existe '" + arg + "'");
                }
                break;
            }
            case "matrix":
                print("wake up, neo...");
                view.post(() -> host.theme("Matrix"));
                break;
            case "neofetch": case "info": case "uname":
                print(neofetch());
                break;
            case "date": case "fecha":
                print(new SimpleDateFormat("EEEE d 'de' MMMM yyyy, HH:mm:ss", Locale.getDefault()).format(new Date()));
                break;
            case "uptime":
                print("encendida hace " + duration(SystemClock.elapsedRealtime()));
                break;
            case "whoami":
                print("root\n(mentira, sos un usuario sin privilegios. pero con estilo)");
                break;
            case "sudo": case "su":
                print("[sudo] contraseña para tv: \nPermiso denegado. Este incidente será reportado.");
                break;
            case "echo":
                print(arg);
                break;
            case "clear": case "cls": case "exit":
                lines.clear();
                out.setText("");
                break;
            case "settings": case "ajustes":
                host.settings(false);
                break;
            case "wifi": case "red": case "ifconfig":
                host.settings(true);
                break;
            case "hack":
                print("conectando al mainframe..... [OK]\nbypass del firewall......... [OK]\n"
                    + "descargando internet......... 3%\nmejor mirá una peli.");
                break;
            case "rm":
                print("rm: buen intento.");
                break;
            default:
                if (!openApp(line)) print(cmd + ": comando no encontrado. Probá 'help'.");
        }
    }

    // By number from ls, then exact name, then the first name that starts with it or contains it.
    private boolean openApp(String q) {
        List<String[]> apps = host.apps();
        String pkg = null;
        try {
            int n = Integer.parseInt(q);
            if (n >= 1 && n <= apps.size()) pkg = apps.get(n - 1)[1];
        } catch (NumberFormatException ignored) {}
        String ql = strip(q);
        for (int pass = 0; pass < 3 && pkg == null; pass++)
            for (String[] a : apps) {
                String l = strip(a[0]);
                if (pass == 0 ? l.equals(ql) : pass == 1 ? l.startsWith(ql) : l.contains(ql)) { pkg = a[1]; break; }
            }
        if (pkg == null) return false;
        print("abriendo " + pkg + "...");
        final String p = pkg;
        view.postDelayed(() -> host.open(p), 250);
        return true;
    }

    private String neofetch() {
        ActivityManager am = (ActivityManager) c.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        if (am != null) am.getMemoryInfo(mi);
        android.util.DisplayMetrics dm = c.getResources().getDisplayMetrics();
        return "   .--.     tv@" + Build.DEVICE + "\n"
             + "  |o_o |    OS: Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")\n"
             + "  |:_/ |    Host: " + Build.MANUFACTURER + " " + Build.MODEL + "\n"
             + " //   \\ \\   CPU: " + Build.HARDWARE + " " + Build.SUPPORTED_ABIS[0] + "\n"
             + "(|     | )  RAM: " + (mi.totalMem - mi.availMem) / 1048576 + " / " + mi.totalMem / 1048576 + " MB\n"
             + "/'\\_   _/`\\  Uptime: " + duration(SystemClock.elapsedRealtime()) + "\n"
             + "\\___)=(___/  Res: " + dm.widthPixels + "x" + dm.heightPixels + "  Apps: " + host.apps().size();
    }

    private static String duration(long ms) {
        long m = ms / 60000, h = m / 60, d = h / 24;
        return (d > 0 ? d + "d " : "") + (h % 24) + "h " + (m % 60) + "m";
    }

    private static String cut(String s, int n) { return s.length() <= n ? s : s.substring(0, n - 1) + "…"; }

    // Lowercase without accents or spaces, so "atres player" finds "Atresplayer".
    private static String strip(String s) {
        String n = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    View input() { return in; }
}
