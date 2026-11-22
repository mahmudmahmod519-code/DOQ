import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/api.dart';
import 'core/session.dart';
import 'screens/server_screen.dart';
import 'screens/shell.dart';
import 'ui/motion.dart';
import 'ui/theme.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<ScaffoldMessengerState> messengerKey = GlobalKey<ScaffoldMessengerState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.dark));
  await Api.instance.init();
  if (Api.instance.hasServer) await Session.instance.refresh();
  runApp(const DoqApp());
}

class DoqApp extends StatefulWidget {
  const DoqApp({super.key});

  @override
  State<DoqApp> createState() => _DoqAppState();
}

class _DoqAppState extends State<DoqApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // In-app banner for every new notification (the native side also plays a sound).
    Notifications.instance.events.listen((item) {
      messengerKey.currentState
        ?..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          duration: const Duration(seconds: 6),
          content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(asStr(item['title']), style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
            if (asStr(item['body']).isNotEmpty) Text(asStr(item['body']), style: const TextStyle(color: Colors.white70)),
          ]),
          backgroundColor: DoqColors.primary,
        ));
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!Session.instance.loggedIn) return;
    // Polling keeps running in the background while Android keeps the app alive,
    // and catches up immediately when the user comes back.
    if (state == AppLifecycleState.resumed) Notifications.instance.ensureRunning();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'دوق',
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey,
      scaffoldMessengerKey: messengerKey,
      theme: buildTheme(),
      scrollBehavior: const DoqScrollBehavior(),
      locale: const Locale('ar', 'EG'),
      supportedLocales: const [Locale('ar', 'EG'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: LaunchCurtain(child: Api.instance.hasServer ? const Shell() : const ServerScreen(firstRun: true)),
    );
  }
}
