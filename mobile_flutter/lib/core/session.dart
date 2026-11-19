import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'api.dart';

/// Signed-in customer state shared by every screen.
class Session {
  Session._();

  static final Session instance = Session._();

  /// Profile from `/m/api/v1/me` (null = guest).
  final ValueNotifier<Map<String, dynamic>?> me = ValueNotifier(null);

  bool get loggedIn => me.value != null;

  Future<void> refresh() async {
    if (!Api.instance.hasSession) {
      me.value = null;
      return;
    }
    try {
      me.value = asMap((await Api.instance.get('/m/api/v1/me'))['data']);
      Notifications.instance.ensureRunning();
    } on ApiException catch (e) {
      if (e.status == 401 || e.status == 403) {
        await Api.instance.clearSession();
        me.value = null;
      }
    }
  }

  Future<void> logout() async {
    try {
      await Api.instance.post('/auth/logout', {'next': '/m'});
    } catch (_) {}
    Notifications.instance.stop();
    await Api.instance.clearSession();
    me.value = null;
  }
}

/// Polls `/notifications/api/poll` every 10 seconds while the app is open.
/// New notifications are pushed to [events] (in-app banner) and to Android
/// as a system notification with sound through the `doq/native` channel.
class Notifications {
  Notifications._();

  static final Notifications instance = Notifications._();
  static const _native = MethodChannel('doq/native');

  final ValueNotifier<int> unread = ValueNotifier(0);
  final ValueNotifier<int> activeOrders = ValueNotifier(0);
  final StreamController<Map<String, dynamic>> _events = StreamController.broadcast();

  Stream<Map<String, dynamic>> get events => _events.stream;

  Timer? _timer;
  int? _lastId;
  bool _busy = false;

  void start() {
    stop();
    _lastId = null;
    tick();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) => tick());
  }

  /// Resumes polling without losing the last seen id (app came back to foreground).
  void ensureRunning() {
    _timer ??= Timer.periodic(const Duration(seconds: 10), (_) => tick());
    tick();
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _lastId = null;
  }

  Future<void> tick() async {
    if (_busy || !Api.instance.hasSession) return;
    _busy = true;
    try {
      final res = await Api.instance.get('/notifications/api/poll', _lastId == null ? null : {'after': _lastId});
      final data = asMap(res['data']);
      final items = asList(data['items']).map(asMap).toList();
      if (_lastId != null) {
        for (final item in items) {
          _events.add(item);
          await _alert(item);
        }
      }
      _lastId = max(_lastId ?? 0, asInt(data['latest_id']));
      unread.value = asInt(data['count']);
      if (items.isNotEmpty || activeOrders.value == 0) await _refreshActiveOrders();
    } on ApiException catch (e) {
      if (e.status == 401 || e.status == 403) stop();
    } catch (_) {
      // keep polling on transient errors
    } finally {
      _busy = false;
    }
  }

  Future<void> _refreshActiveOrders() async {
    try {
      final page = await Api.instance.page('/m/api/v1/orders', null, {'status': 'active', 'limit': 10});
      activeOrders.value = page.hasMore ? 10 : page.items.length;
    } catch (_) {}
  }

  Future<void> _alert(Map<String, dynamic> item) async {
    HapticFeedback.mediumImpact();
    try {
      await _native.invokeMethod('notify', {
        'title': asStr(item['title']).isEmpty ? 'إشعار جديد من دوق' : asStr(item['title']),
        'body': asStr(item['body']),
      });
    } catch (_) {
      SystemSound.play(SystemSoundType.click);
    }
  }
}
