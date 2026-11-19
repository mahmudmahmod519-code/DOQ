import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../ui/cursor_list.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'order_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _listKey = GlobalKey<CursorListState>();
  final Set<int> _read = {};
  StreamSubscription<Map<String, dynamic>>? _sub;

  @override
  void initState() {
    super.initState();
    _sub = Notifications.instance.events.listen((_) => _listKey.currentState?.reset());
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _readAll() async {
    try {
      await Api.instance.patch('/notifications/api/read-all');
      Notifications.instance.unread.value = 0;
      _read.clear();
      _listKey.currentState?.reset();
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    }
  }

  Future<void> _open(Map<String, dynamic> n) async {
    final id = asInt(n['id']);
    if (n['read_at'] == null && !_read.contains(id)) {
      setState(() => _read.add(id));
      Api.instance.patch('/notifications/api/$id/read').then((_) => Notifications.instance.tick()).catchError((_) {});
    }
    final orderId = asStr(n['order_public_id']);
    if (orderId.isNotEmpty) {
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderScreen(publicId: orderId)));
    }
  }

  IconData _icon(String type) {
    if (type.contains('deliver')) return Icons.delivery_dining_rounded;
    if (type.contains('order')) return Icons.receipt_long_rounded;
    return Icons.notifications_none_rounded;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الإشعارات'),
        actions: [TextButton(onPressed: _readAll, child: const Text('قراءة الكل', style: TextStyle(fontWeight: FontWeight.w800)))],
      ),
      body: CursorList(
        key: _listKey,
        fetch: (cursor) => Api.instance.page('/m/api/v1/notifications', cursor),
        empty: const EmptyState(icon: Icons.notifications_none_rounded, title: 'مفيش إشعارات لسه', text: 'أول ما حالة طلبك تتغير هتلاقي إشعار هنا'),
        itemBuilder: (context, n, i) {
          final unread = n['read_at'] == null && !_read.contains(asInt(n['id']));
          return Card(
            color: unread ? const Color(0xFFFFF7ED) : Colors.white,
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => _open(n),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  CircleAvatar(backgroundColor: DoqColors.surface2, child: Icon(_icon(asStr(n['type'])), color: DoqColors.primary)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text(asStr(n['title']), style: const TextStyle(fontWeight: FontWeight.w800))),
                        Text(timeAgo(n['created_at']), style: const TextStyle(fontSize: 12, color: DoqColors.muted)),
                      ]),
                      const SizedBox(height: 2),
                      Text(asStr(n['body']), style: const TextStyle(color: DoqColors.muted, fontSize: 14)),
                    ]),
                  ),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }
}
