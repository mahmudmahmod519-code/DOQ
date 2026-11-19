import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// DOQ identity (same as the website): Tajawal, burgundy #9e2016, orange #fc7127, cream surfaces.
class DoqColors {
  static const primary = Color(0xFF9E2016);
  static const primaryDark = Color(0xFF7A160F);
  static const secondary = Color(0xFFFC7127);
  static const background = Color(0xFFFFF8F6);
  static const surface2 = Color(0xFFFFE9E6);
  static const surface3 = Color(0xFFFFF0EE);
  static const ink = Color(0xFF261816);
  static const muted = Color(0xFF59413D);
  static const line = Color(0xFFE1BFB9);
  static const ok = Color(0xFF0F766E);
  static const danger = Color(0xFFBA1A1A);
  static const star = Color(0xFFF59E0B);
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: DoqColors.primary,
      primary: DoqColors.primary,
      secondary: DoqColors.secondary,
      surface: Colors.white,
      error: DoqColors.danger,
    ),
    scaffoldBackgroundColor: DoqColors.background,
  );
  final text = GoogleFonts.tajawalTextTheme(base.textTheme).apply(bodyColor: DoqColors.ink, displayColor: DoqColors.ink);
  return base.copyWith(
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: DoqColors.background,
      foregroundColor: DoqColors.ink,
      elevation: 0,
      scrolledUnderElevation: 1,
      centerTitle: false,
      titleTextStyle: GoogleFonts.tajawal(fontSize: 19, fontWeight: FontWeight.w800, color: DoqColors.ink),
    ),
    cardTheme: CardTheme(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: DoqColors.line.withOpacity(0.5)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: DoqColors.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size(64, 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: GoogleFonts.tajawal(fontSize: 16, fontWeight: FontWeight.w800),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: DoqColors.primary,
        minimumSize: const Size(64, 48),
        side: const BorderSide(color: DoqColors.primary, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: GoogleFonts.tajawal(fontSize: 15, fontWeight: FontWeight.w800),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: DoqColors.line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: DoqColors.line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: DoqColors.primary, width: 1.6)),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: Colors.white,
      selectedColor: DoqColors.surface2,
      side: const BorderSide(color: DoqColors.line),
      shape: const StadiumBorder(),
      labelStyle: GoogleFonts.tajawal(fontWeight: FontWeight.w700, color: DoqColors.ink),
      secondaryLabelStyle: GoogleFonts.tajawal(fontWeight: FontWeight.w800, color: DoqColors.primary),
      checkmarkColor: DoqColors.primary,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: DoqColors.surface2,
      labelTextStyle: WidgetStatePropertyAll(GoogleFonts.tajawal(fontSize: 12, fontWeight: FontWeight.w700)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: DoqColors.ink,
      contentTextStyle: GoogleFonts.tajawal(color: Colors.white, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}
