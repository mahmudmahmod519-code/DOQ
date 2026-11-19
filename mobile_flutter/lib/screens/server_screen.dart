import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'shell.dart';

/// Lets the user point the app to the DOQ server (LAN IP, ngrok, Cloudflare tunnel, domain).
/// A default can be baked into the APK at build time with --dart-define=DOQ_API_URL=...
class ServerScreen extends StatefulWidget {
  const ServerScreen({super.key, this.firstRun = false});

  final bool firstRun;

  @override
  State<ServerScreen> createState() => _ServerScreenState();
}

class _ServerScreenState extends State<ServerScreen> {
  late final TextEditingController _url = TextEditingController(text: Api.instance.baseUrl);
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final value = Api.normalize(_url.text);
    if (Uri.tryParse(value)?.host.isEmpty ?? true) {
      setState(() => _error = 'اكتب عنوان صحيح زي http://192.168.1.10:8080');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final previous = Api.instance.baseUrl;
    await Api.instance.setServer(value);
    try {
      await Api.instance.get('/health');
    } on ApiException catch (e) {
      await Api.instance.setServer(previous);
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.message;
        });
      }
      return;
    }
    await Session.instance.logout();
    if (!mounted) return;
    showMessage(context, 'تم الاتصال بالسيرفر');
    Shell.tab.value = 0;
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const Shell()), (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('عنوان السيرفر'), automaticallyImplyLeading: !widget.firstRun),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        if (widget.firstRun) ...[
          Center(child: ClipOval(child: Image.asset('assets/images/logo.png', width: 84, height: 84))),
          const SizedBox(height: 12),
          const Text('أهلاً بيك في دوق', textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
        ],
        const Text('اكتب عنوان سيرفر دوق اللي التطبيق هيتصل بيه', style: TextStyle(color: DoqColors.muted)),
        const SizedBox(height: 12),
        TextField(
          controller: _url,
          keyboardType: TextInputType.url,
          textDirection: TextDirection.ltr,
          decoration: const InputDecoration(labelText: 'Server URL', hintText: 'https://doq.example.com'),
          onSubmitted: (_) => _save(),
        ),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: const TextStyle(color: DoqColors.danger, fontWeight: FontWeight.w700))),
        const SizedBox(height: 16),
        FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'جاري الاتصال...' : 'اتصال')),
        const SizedBox(height: 20),
        const Text(
          'أمثلة:\n• نفس الواي فاي: http://192.168.1.10:8080\n• ngrok: https://xxxx.ngrok-free.app\n• Cloudflare: https://xxxx.trycloudflare.com',
          textDirection: TextDirection.ltr,
          style: TextStyle(color: DoqColors.muted, height: 1.7),
        ),
      ]),
    );
  }
}
