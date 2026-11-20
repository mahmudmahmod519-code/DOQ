import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'server_screen.dart';

/// Customer login / signup (+ 2FA code when the account has it enabled).
/// Pops with `true` once signed in.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _signup = false;
  bool _busy = false;
  String? _error;
  final _loginForm = GlobalKey<FormState>();
  final _signupForm = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _phone = TextEditingController();
  final _city = TextEditingController();
  final _address = TextEditingController();
  final _password2 = TextEditingController();
  bool _hidePassword = true;

  @override
  void dispose() {
    for (final c in [_email, _password, _first, _last, _phone, _city, _address, _password2]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _finish(Map<String, dynamic> res) async {
    var result = res;
    if (asStr(result['redirect']) == '/auth/signup2') {
      final otp = await _askOtp();
      if (otp == null) {
        setState(() => _busy = false);
        return;
      }
      result = await Api.instance.post('/auth/signup2', {'otp': otp});
    }
    final redirect = asStr(result['redirect']);
    if (redirect.startsWith('/auth')) {
      // e.g. pending staff account
      setState(() {
        _busy = false;
        _error = asStr(result['message']).isEmpty ? 'الحساب في انتظار موافقة الإدارة' : asStr(result['message']);
      });
      return;
    }
    if (redirect.isNotEmpty && !redirect.startsWith('/m')) {
      // admin / chef / delivery: they use the website, not the customer app
      await Session.instance.logout();
      setState(() {
        _busy = false;
        _error = 'الحساب ده مش حساب عميل. حسابات المطابخ والدليفري والإدارة بتشتغل من الموقع';
      });
      return;
    }
    await Session.instance.refresh();
    if (!mounted) return;
    if (!Session.instance.loggedIn) {
      setState(() {
        _busy = false;
        _error = 'تعذر تسجيل الدخول. حاول تاني';
      });
      return;
    }
    showMessage(context, 'أهلاً يا ${asStr(Session.instance.me.value?['first_name'])}');
    Navigator.of(context).pop(true);
  }

  Future<String?> _askOtp() {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('رمز المصادقة'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          textDirection: TextDirection.ltr,
          autofocus: true,
          decoration: const InputDecoration(hintText: '000000', counterText: ''),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('تأكيد')),
        ],
      ),
    );
  }

  Future<void> _run(Future<Map<String, dynamic>> Function() call) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _finish(await call());
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.message;
        });
      }
    }
  }

  void _login() {
    if (!_loginForm.currentState!.validate()) return;
    _run(() => Api.instance.post('/auth/signin', {'email': _email.text.trim(), 'password': _password.text}));
  }

  void _register() {
    if (!_signupForm.currentState!.validate()) return;
    _run(() => Api.instance.post('/auth/signup', {
          'firstname': _first.text.trim(),
          'lastname': _last.text.trim(),
          'phone_number': _phone.text.trim(),
          'email': _email.text.trim(),
          'city': _city.text.trim(),
          'address': _address.text.trim(),
          'password': _password.text,
          'password_confirmation': _password2.text,
          'roles': 'customer',
        }));
  }

  String? _required(String? v) => (v ?? '').trim().isEmpty ? 'مطلوب' : null;

  String? _name(String? v) {
    final s = (v ?? '').trim();
    if (s.length < 2) return 'حرفين على الأقل';
    if (!RegExp(r'^[؀-ۿa-zA-Z\s]+$').hasMatch(s)) return 'حروف بس';
    return null;
  }

  Widget _passwordField(TextEditingController c, String label, {String? Function(String?)? validator}) {
    return TextFormField(
      controller: c,
      obscureText: _hidePassword,
      textDirection: TextDirection.ltr,
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: IconButton(
          icon: Icon(_hidePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
          onPressed: () => setState(() => _hidePassword = !_hidePassword),
        ),
      ),
      validator: validator ?? _required,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(actions: [
        if (!Api.lockServer)
          IconButton(
          tooltip: 'عنوان السيرفر',
          icon: const Icon(Icons.dns_outlined),
          onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ServerScreen())),
        ),
      ]),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 32), children: [
        Center(child: ClipOval(child: Image.asset('assets/images/logo.png', width: 84, height: 84))),
        const SizedBox(height: 10),
        const Text('دوق', textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
        const Text('أكل بيتي من مطابخ قريبة منك', textAlign: TextAlign.center, style: TextStyle(color: DoqColors.muted)),
        const SizedBox(height: 18),
        SegmentedButton<bool>(
          segments: const [
            ButtonSegment(value: false, label: Text('تسجيل الدخول')),
            ButtonSegment(value: true, label: Text('حساب جديد')),
          ],
          selected: {_signup},
          showSelectedIcon: false,
          onSelectionChanged: (s) => setState(() {
            _signup = s.first;
            _error = null;
          }),
        ),
        const SizedBox(height: 18),
        if (!_signup)
          Form(
            key: _loginForm,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textDirection: TextDirection.ltr,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(labelText: 'الإيميل'),
                validator: _required,
              ),
              const SizedBox(height: 12),
              _passwordField(_password, 'كلمة المرور'),
            ]),
          )
        else
          Form(
            key: _signupForm,
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
                decoration: const InputDecoration(labelText: 'رقم الموبايل', hintText: '01xxxxxxxxx', counterText: ''),
                validator: (v) => isEgyptPhone(v ?? '') ? null : 'رقم مصري صحيح (01xxxxxxxxx)',
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(labelText: 'الإيميل'),
                validator: (v) => (v ?? '').contains('@') ? null : 'إيميل صحيح',
              ),
              const SizedBox(height: 12),
              TextFormField(controller: _city, decoration: const InputDecoration(labelText: 'المدينة')),
              const SizedBox(height: 12),
              TextFormField(controller: _address, decoration: const InputDecoration(labelText: 'عنوان التوصيل')),
              const SizedBox(height: 12),
              _passwordField(_password, 'كلمة المرور',
                  validator: (v) => isStrongPassword(v ?? '') ? null : '8 حروف فيها كبير وصغير ورقم ورمز (@\$!%*?&)'),
              const SizedBox(height: 12),
              _passwordField(_password2, 'تأكيد كلمة المرور', validator: (v) => v == _password.text ? null : 'مش مطابقة'),
            ]),
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(_error!, style: const TextStyle(color: DoqColors.danger, fontWeight: FontWeight.w700)),
          ),
        const SizedBox(height: 18),
        FilledButton(
          onPressed: _busy ? null : (_signup ? _register : _login),
          child: _busy
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
              : Text(_signup ? 'إنشاء الحساب' : 'دخول'),
        ),
        const SizedBox(height: 12),
        const Text(
          'صاحب مطبخ أو شركة توصيل؟ سجّل من موقع دوق على الكمبيوتر',
          textAlign: TextAlign.center,
          style: TextStyle(color: DoqColors.muted, fontSize: 13),
        ),
      ]),
    );
  }
}
