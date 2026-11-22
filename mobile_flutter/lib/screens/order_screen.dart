import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../ui/motion.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'dish_screen.dart';

/// Live order tracking (refreshes every 15 seconds and on every new notification).
class OrderScreen extends StatefulWidget {
  const OrderScreen({super.key, required this.publicId});

  final String publicId;

  @override
  State<OrderScreen> createState() => _OrderScreenState();
}

class _OrderScreenState extends State<OrderScreen> {
  static const _steps = [
    ['pending', 'created_at', 'الطلب اتبعت للمطبخ'],
    ['chef_accepted', 'chef_accepted_at', 'المطبخ قبل الطلب وبيجهزه'],
    ['accepted', 'accepted_at', 'مندوب التوصيل قبل الطلب'],
    ['out_for_delivery', 'out_for_delivery_at', 'الطلب مع المندوب في الطريق ليك'],
    ['completed', 'completed_at', 'الطلب اتسلم. بالهنا والشفا'],
  ];

  Map<String, dynamic>? _order;
  String? _error;
  Timer? _timer;
  StreamSubscription<Map<String, dynamic>>? _sub;
  bool _cancelling = false;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _load());
    _sub = Notifications.instance.events.listen((_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await Api.instance.get('/m/api/v1/orders/${Uri.encodeComponent(widget.publicId)}');
      if (!mounted) return;
      final o = asMap(res['data']);
      setState(() {
        _order = o;
        _error = null;
      });
      if (o['status'] == 'completed' || o['status'] == 'cancelled') _timer?.cancel();
    } on ApiException catch (e) {
      if (mounted && _order == null) setState(() => _error = e.message);
    }
  }

  Future<void> _cancel() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('إلغاء الطلب'),
        content: const Text('متأكد إنك عايز تلغي الطلب؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('لا')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('أيوه، الغي')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _cancelling = true);
    try {
      await Api.instance.patch('/orders/api/v1/${Uri.encodeComponent(widget.publicId)}/status', {'status': 'cancelled'});
      if (mounted) showMessage(context, 'تم إلغاء الطلب');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  Widget _timeline(Map<String, dynamic> o) {
    final status = asStr(o['status']);
    if (status == 'cancelled') {
      return const ListTile(
        leading: Icon(Icons.cancel_outlined, color: DoqColors.danger),
        title: Text('الطلب ده اتلغى', style: TextStyle(color: DoqColors.danger, fontWeight: FontWeight.w800)),
        subtitle: Text('لو عندك أي استفسار تواصل معانا'),
      );
    }
    final current = _steps.indexWhere((s) => s[0] == status);
    return Column(children: [
      for (var i = 0; i < _steps.length; i++)
        Reveal(
          delay: staggerDelay(i, stepMs: 70),
          offset: 14,
          child: _TimelineStep(
            title: _steps[i][2],
            time: fullDate(o[_steps[i][1]]),
            done: i < current || status == 'completed',
            current: i == current && status != 'completed',
            last: i == _steps.length - 1,
          ),
        ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final o = _order;
    return Scaffold(
      appBar: AppBar(title: const Text('تتبع الطلب')),
      body: _error != null
          ? Center(child: EmptyState(icon: Icons.receipt_long_outlined, title: _error!))
          : o == null
              ? const LoadingView()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.all(16), children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(children: [
                          Row(children: [
                            const Expanded(child: Text('رقم الطلب', style: TextStyle(color: DoqColors.muted))),
                            Text('#${asStr(o['order_code'])}', textDirection: TextDirection.ltr, style: const TextStyle(fontWeight: FontWeight.w900)),
                          ]),
                          const SizedBox(height: 12),
                          Row(children: [
                            ClipRRect(borderRadius: BorderRadius.circular(12), child: netImage(o['dish_image'], width: 64, height: 64)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text('${asStr(o['dish_name'])} × ${asInt(o['quantity'])}', style: const TextStyle(fontWeight: FontWeight.w800)),
                                Text(asStr(o['kitchen_name']), style: const TextStyle(color: DoqColors.muted, fontSize: 13)),
                                const SizedBox(height: 4),
                                AnimatedSwitcher(
                                  duration: DoqMotion.quick,
                                  transitionBuilder: (child, animation) => FadeTransition(
                                    opacity: animation,
                                    child: ScaleTransition(scale: Tween<double>(begin: 0.9, end: 1).animate(animation), child: child),
                                  ),
                                  child: StatusChip(asStr(o['status']), key: ValueKey(asStr(o['status']))),
                                ),
                              ]),
                            ),
                          ]),
                          if (o['status'] != 'cancelled') ...[
                            const SizedBox(height: 16),
                            OrderRoad(status: asStr(o['status'])),
                          ],
                        ]),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Card(child: Padding(padding: const EdgeInsets.all(14), child: _timeline(o))),
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                        child: Column(children: [
                          KeyValueRow('اسم الطلب', asStr(o['order_name']).isEmpty ? '—' : asStr(o['order_name'])),
                          KeyValueRow('سعر الوحدة', money(o['unit_price'])),
                          if (asNum(o['discount_amount']) > 0) KeyValueRow('الخصم', '− ${money(o['discount_amount'])}', valueColor: DoqColors.ok),
                          if (asNum(o['delivery_fee_amount']) > 0) KeyValueRow('التوصيل', money(o['delivery_fee_amount'])),
                          KeyValueRow(asNum(o['delivery_fee_amount']) > 0 ? 'الإجمالي (من غير التوصيل)' : 'الإجمالي', money(o['total_price']), valueColor: DoqColors.primary),
                          KeyValueRow('العنوان', asStr(o['customer_address']).isEmpty ? '—' : asStr(o['customer_address']), bold: false, last: true),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 14),
                    if (o['can_cancel'] == true)
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(foregroundColor: DoqColors.danger, side: const BorderSide(color: DoqColors.danger)),
                        onPressed: _cancelling ? null : _cancel,
                        child: Text(_cancelling ? 'جاري الإلغاء...' : 'إلغاء الطلب'),
                      ),
                    if (o['status'] == 'completed' && o['has_review'] != true) ...[
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => DishScreen(dishId: asInt(o['dish_id'])))),
                        child: const Text('قيّم الطبق'),
                      ),
                    ],
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => DishScreen(dishId: asInt(o['dish_id'])))),
                      child: const Text('اطلبه تاني'),
                    ),
                  ]),
                ),
    );
  }
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({required this.title, required this.time, required this.done, required this.current, required this.last});

  final String title;
  final String time;
  final bool done;
  final bool current;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final color = done ? DoqColors.ok : (current ? DoqColors.secondary : DoqColors.line);
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Column(children: [
          AnimatedContainer(
            duration: DoqMotion.page,
            curve: DoqMotion.easeOut,
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done ? DoqColors.ok : Colors.white,
              border: Border.all(color: color, width: 2),
              boxShadow: current ? [BoxShadow(color: DoqColors.secondary.withValues(alpha: 0.25), blurRadius: 0, spreadRadius: 5)] : null,
            ),
            child: done
                ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                : current
                    ? const Center(child: PulseDot(size: 8))
                    : null,
          ),
          if (!last)
            Expanded(
              child: AnimatedContainer(duration: DoqMotion.page, curve: DoqMotion.easeOut, width: 2, color: done ? DoqColors.ok : DoqColors.line),
            ),
        ]),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: last ? 0 : 18, top: 2),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: TextStyle(fontWeight: done || current ? FontWeight.w800 : FontWeight.w500, color: done || current ? DoqColors.ink : DoqColors.muted)),
              if (time.isNotEmpty) Text(time, style: const TextStyle(fontSize: 12, color: DoqColors.muted)),
            ]),
          ),
        ),
      ]),
    );
  }
}
