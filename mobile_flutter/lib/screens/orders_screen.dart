import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../ui/cursor_list.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'notification_bell.dart';
import 'order_screen.dart';
import 'shell.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  final _listKey = GlobalKey<CursorListState>();
  String _status = 'active';
  StreamSubscription<Map<String, dynamic>>? _sub;

  @override
  void initState() {
    super.initState();
    // Order status changed (new notification): refresh the list
    _sub = Notifications.instance.events.listen((_) => _listKey.currentState?.reset());
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!Session.instance.loggedIn) {
      return Scaffold(appBar: AppBar(title: const Text('طلباتي')), body: const LoginPrompt(icon: Icons.receipt_long_outlined, title: 'سجل دخول عشان تشوف طلباتك'));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('طلباتي'), actions: const [NotificationBell(), SizedBox(width: 6)]),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: SizedBox(
            width: double.infinity,
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'active', label: Text('الطلبات الحالية')),
                ButtonSegment(value: 'done', label: Text('الطلبات السابقة')),
              ],
              selected: {_status},
              showSelectedIcon: false,
              onSelectionChanged: (s) {
                setState(() => _status = s.first);
                _listKey.currentState?.reset();
              },
            ),
          ),
        ),
        Expanded(
          child: CursorList(
            key: _listKey,
            fetch: (cursor) => Api.instance.page('/m/api/v1/orders', cursor, {'status': _status}),
            itemBuilder: (context, o, i) => OrderTile(order: o, onChanged: () => _listKey.currentState?.reset()),
            empty: EmptyState(
              icon: Icons.receipt_long_outlined,
              title: 'مفيش طلبات هنا',
              text: 'اختار طبق من المطابخ واطلبه في ثواني',
              actionLabel: 'تصفح الأطباق',
              onAction: () => Shell.tab.value = 0,
            ),
          ),
        ),
      ]),
    );
  }
}

class OrderTile extends StatelessWidget {
  const OrderTile({super.key, required this.order, this.onChanged});

  final Map<String, dynamic> order;
  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderScreen(publicId: asStr(order['public_id']))));
          onChanged?.call();
        },
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            ClipRRect(borderRadius: BorderRadius.circular(12), child: netImage(order['dish_image'], width: 64, height: 64)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${asStr(order['dish_name'])} × ${asInt(order['quantity'])}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                Text('${asStr(order['kitchen_name'])} · #${asStr(order['order_code'])}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: DoqColors.muted)),
                const SizedBox(height: 6),
                Row(children: [
                  StatusChip(asStr(order['status'])),
                  const Spacer(),
                  Text(money(order['total_price']), style: const TextStyle(fontWeight: FontWeight.w900, color: DoqColors.primary)),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
