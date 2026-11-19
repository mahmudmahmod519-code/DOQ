import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'my_reviews_screen.dart';
import 'notification_bell.dart';
import 'notifications_screen.dart';
import 'server_screen.dart';
import 'shell.dart';

/// Profile, delivery address, reviews and settings.
/// [standalone] = opened from the order sheet to edit the address (pops after saving).
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key, this.standalone = false});

  final bool standalone;

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _form = GlobalKey<FormState>();
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _phone = TextEditingController();
  final _city = TextEditingController();
  final _address = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _fill(Session.instance.me.value);
    Session.instance.refresh().then((_) {
      if (mounted) setState(() => _fill(Session.instance.me.value));
    });
  }

  void _fill(Map<String, dynamic>? me) {
    if (me == null) return;
    _first.text = asStr(me['first_name']);
    _last.text = asStr(me['last_name']);
    _phone.text = asStr(me['phone_number']);
    _city.text = asStr(me['city']);
    _address.text = asStr(me['address']);
  }

  @override
  void dispose() {
    for (final c in [_first, _last, _phone, _city, _address]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    final payload = <String, dynamic>{};
    void put(String key, TextEditingController c) {
      final v = c.text.trim();
      if (v.isNotEmpty) payload[key] = v;
    }

    put('first_name', _first);
    put('last_name', _last);
    put('phone_number', _phone);
    put('city', _city);
    put('address', _address);
    try {
      await Api.instance.put('/users/api/v1/', payload);
      await Session.instance.refresh();
      if (!mounted) return;
      showMessage(context, 'تم حفظ بياناتك');
      if (widget.standalone) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _logout() async {
    await Session.instance.logout();
    Shell.tab.value = 0;
    if (mounted && widget.standalone) Navigator.of(context).pop();
  }

  Widget _stat(String value, String label, VoidCallback? onTap) {
    return Expanded(
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(children: [
              Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: DoqColors.primary)),
              Text(label, style: const TextStyle(fontSize: 12, color: DoqColors.muted)),
            ]),
          ),
        ),
      ),
    );
  }

  String? _name(String? v) {
    final s = (v ?? '').trim();
    if (s.length < 2) return 'اكتب حرفين على الأقل';
    if (!RegExp(r'^[؀-ۿa-zA-Z\s]+$').hasMatch(s)) return 'حروف بس';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final me = Session.instance.me.value;
    if (me == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('حسابي')),
        body: ListView(children: [
          const LoginPrompt(icon: Icons.person_outline_rounded, title: 'سجل دخول عشان تدير حسابك'),
          ListTile(
            leading: const Icon(Icons.dns_outlined),
            title: const Text('عنوان السيرفر'),
            subtitle: Text(Api.instance.baseUrl, textDirection: TextDirection.ltr),
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ServerScreen())),
          ),
        ]),
      );
    }
    final stats = asMap(me['stats']);
    return Scaffold(
      appBar: AppBar(title: Text(widget.standalone ? 'عنوان التوصيل' : 'حسابي'), actions: widget.standalone ? null : const [NotificationBell(), SizedBox(width: 6)]),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        if (!widget.standalone) ...[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                const CircleAvatar(radius: 34, backgroundImage: AssetImage('assets/images/avatar.jpg')),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${asStr(me['first_name'])} ${asStr(me['last_name'])}', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
                    Text(asStr(me['email']), style: const TextStyle(color: DoqColors.muted, fontSize: 13)),
                  ]),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 10),
          Row(children: [
            _stat('${asInt(stats['orders_count'])}', 'طلب', () => Shell.tab.value = 2),
            const SizedBox(width: 8),
            _stat('${asInt(stats['favourites_count'])}', 'مفضلة', () => Shell.tab.value = 3),
            const SizedBox(width: 8),
            _stat('${asInt(stats['reviews_count'])}', 'تقييم', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const MyReviewsScreen()))),
          ]),
          const SizedBox(height: 16),
          const Text('بياناتي وعنوان التوصيل', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
        ],
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Form(
              key: _form,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  Expanded(child: TextFormField(controller: _first, decoration: const InputDecoration(labelText: 'الاسم الأول'), validator: _name)),
                  const SizedBox(width: 10),
                  Expanded(child: TextFormField(controller: _last, decoration: const InputDecoration(labelText: 'الاسم الأخير'), validator: _name)),
                ]),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  textDirection: TextDirection.ltr,
                  maxLength: 11,
                  decoration: const InputDecoration(labelText: 'رقم الموبايل', counterText: ''),
                  validator: (v) => isEgyptPhone(v ?? '') ? null : 'رقم مصري صحيح (01xxxxxxxxx)',
                ),
                const SizedBox(height: 12),
                TextFormField(controller: _city, decoration: const InputDecoration(labelText: 'المدينة')),
                const SizedBox(height: 12),
                TextFormField(controller: _address, maxLines: 2, decoration: const InputDecoration(labelText: 'العنوان بالتفصيل')),
                const SizedBox(height: 14),
                FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'جاري الحفظ...' : 'حفظ البيانات')),
              ]),
            ),
          ),
        ),
        if (!widget.standalone) ...[
          const SizedBox(height: 16),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(children: [
              ListTile(
                leading: const Icon(Icons.notifications_none_rounded),
                title: const Text('الإشعارات'),
                trailing: const Icon(Icons.chevron_left_rounded),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NotificationsScreen())),
              ),
              ListTile(
                leading: const Icon(Icons.star_outline_rounded),
                title: const Text('تقييماتي'),
                trailing: const Icon(Icons.chevron_left_rounded),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const MyReviewsScreen())),
              ),
              ListTile(
                leading: const Icon(Icons.dns_outlined),
                title: const Text('عنوان السيرفر'),
                subtitle: Text(Api.instance.baseUrl, textDirection: TextDirection.ltr),
                trailing: const Icon(Icons.chevron_left_rounded),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ServerScreen())),
              ),
              ListTile(
                leading: const Icon(Icons.logout_rounded, color: DoqColors.danger),
                title: const Text('تسجيل الخروج', style: TextStyle(color: DoqColors.danger, fontWeight: FontWeight.w700)),
                onTap: _logout,
              ),
            ]),
          ),
        ],
      ]),
    );
  }
}
