import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../ui/cursor_list.dart';
import '../ui/motion.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class KitchenScreen extends StatefulWidget {
  const KitchenScreen({super.key, required this.kitchenId});

  final int kitchenId;

  @override
  State<KitchenScreen> createState() => _KitchenScreenState();
}

class _KitchenScreenState extends State<KitchenScreen> {
  Map<String, dynamic>? _kitchen;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await Api.instance.get('/m/api/v1/kitchens/${widget.kitchenId}');
      if (mounted) setState(() => _kitchen = asMap(res['data']));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Widget _stat(String value, String label) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Column(children: [
            Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: DoqColors.primary)),
            Text(label, style: const TextStyle(fontSize: 12, color: DoqColors.muted)),
          ]),
        ),
      ),
    );
  }

  Widget _header(Map<String, dynamic> k) {
    final fee = asNum(k['delivery_fee']);
    final city = asStr(k['city']);
    final chef = asStr(k['chef_first_name']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Stack(clipBehavior: Clip.none, children: [
        SizedBox(height: 170, width: double.infinity, child: netImage(k['image_url'], fallback: kitchenCoverFallback)),
        PositionedDirectional(
          start: 16,
          bottom: -40,
          child: Container(
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 3)),
            child: ClipOval(child: netImage(k['portfolio_url'], fallback: kitchenAvatarFallback, width: 80, height: 80)),
          ),
        ),
      ]),
      Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(108, 8, 16, 0),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(asStr(k['title']), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
          Text([if (city.isNotEmpty) city, if (chef.isNotEmpty) 'الشيف $chef'].join(' · '), style: const TextStyle(color: DoqColors.muted, fontSize: 13)),
        ]),
      ),
      if (asStr(k['description']).isNotEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Text(asStr(k['description']), style: const TextStyle(color: DoqColors.muted)),
        ),
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 14, 12, 0),
        child: Row(children: [
          _stat(k['avg_rating'] == null ? '—' : asNum(k['avg_rating']).toStringAsFixed(1), 'التقييم (${asInt(k['reviews_count'])})'),
          const SizedBox(width: 8),
          _stat('${asInt(k['dishes_count'])}', 'طبق'),
          const SizedBox(width: 8),
          _stat(fee > 0 ? money(fee) : 'مجاني', 'التوصيل'),
        ]),
      ),
      const SectionTitle('المنيو'),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final k = _kitchen;
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: Padding(
          padding: const EdgeInsets.all(6),
          child: CircleAvatar(backgroundColor: Colors.black38, child: BackButton(color: Colors.white, onPressed: () => Navigator.of(context).pop())),
        ),
      ),
      body: _error != null
          ? Center(child: EmptyState(icon: Icons.storefront_outlined, title: _error!, actionLabel: 'رجوع', onAction: () => Navigator.of(context).pop()))
          : k == null
              ? const LoadingView()
              : CursorList(
                  grid: true,
                  fetch: (cursor) => Api.instance.page('/m/api/v1/dishes', cursor, {'kitchen_id': widget.kitchenId}),
                  itemBuilder: (context, dish, i) => DishCard(dish: dish, heroScope: 'kitchen'),
                  empty: const EmptyState(icon: Icons.restaurant_menu_rounded, title: 'المطبخ لسه مضافش أطباق'),
                  headerSlivers: [SliverToBoxAdapter(child: Reveal(child: _header(k)))],
                ),
    );
  }
}
