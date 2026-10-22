#!/bin/sh
# Copies your photos to the TV for the Foto and River themes, and switches to that theme.
#
#   sh fotos.sh <TV_IP> foto.jpg       one photo: the Foto theme's background
#   sh fotos.sh <TV_IP> mis-fotos/     a folder: the River theme's slideshow (jpg, png, webp)
#   sh fotos.sh <TV_IP> --clear        removes the photos copied before
#
# Nothing is uploaded anywhere: the photos go straight to /sdcard/TVHome on the TV.
set -e
PKG=com.ansub.tvhome
TARGET="$1"; SRC="$2"
[ -n "$TARGET" ] && [ -n "$SRC" ] || { echo "Usage: sh fotos.sh <TV_IP> <photo.jpg | folder/ | --clear>" >&2; exit 1; }
case "$TARGET" in
  *.*.*.*:*) TV=$TARGET ;;
  *.*.*.*)   TV=$TARGET:5555 ;;
  *)         TV=$TARGET ;;
esac
case "$TV" in *:*) adb connect "$TV" >/dev/null || true ;; esac
[ "$(adb -s "$TV" get-state 2>/dev/null)" = device ] || { echo "Can't reach $TV." >&2; exit 1; }
DIR=/sdcard/TVHome
# The home screen only reads photos: allow it (Android 13 and later name the permission differently).
if [ "$(adb -s "$TV" shell getprop ro.build.version.sdk | tr -d '\r')" -ge 33 ]; then
  adb -s "$TV" shell pm grant $PKG android.permission.READ_MEDIA_IMAGES
else
  adb -s "$TV" shell pm grant $PKG android.permission.READ_EXTERNAL_STORAGE
fi

if [ "$SRC" = "--clear" ]; then
  adb -s "$TV" shell "rm -rf $DIR/river $DIR/fondo.jpg"
  echo "Photos removed."
  exit 0
fi

if [ -d "$SRC" ]; then
  adb -s "$TV" shell "mkdir -p $DIR/river"
  n=0
  for f in "$SRC"/*; do
    case "$(echo "$f" | tr 'A-Z' 'a-z')" in
      *.jpg|*.jpeg|*.png|*.webp) adb -s "$TV" push "$f" "$DIR/river/" >/dev/null && n=$((n + 1)) ;;
    esac
  done
  [ "$n" -gt 0 ] || { echo "No jpg, png or webp photos in $SRC." >&2; exit 1; }
  THEME=River
  echo "Copied $n photo(s) for the River slideshow."
elif [ -f "$SRC" ]; then
  adb -s "$TV" shell "mkdir -p $DIR"
  adb -s "$TV" push "$SRC" "$DIR/fondo.jpg" >/dev/null
  THEME=Foto
  echo "Copied the photo for the Foto theme."
else
  echo "Can't find $SRC." >&2; exit 1
fi
# Restarting the home screen makes it read the new photos.
adb -s "$TV" shell am force-stop $PKG
adb -s "$TV" shell am start -n $PKG/.MainActivity --es theme "$THEME" >/dev/null
echo "Done: the $THEME theme is on."
