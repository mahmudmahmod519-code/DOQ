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

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _listKey = GlobalKey<CursorListState>();
  final _search = TextEditingController();
  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> _kitchens = [];
  bool _homeLoaded = false;
  String _q = '';
  int? _categoryId;
  String _categoryName = '';

  /// Customer-only sections: orders in progress + "اطلب تاني" from delivered orders.
  List<Map<String, dynamic>> _activeOrders = [];
  List<Map<String, dynamic>> _reorder = [];
  StreamSubscription<Map<String, dynamic>>? _sub;

  @override
  void initState() {
    super.initState();
    _loadHome();
    _loadMine();
    // Order status changed / user signed in or out: refresh the personal sections
    _sub = Notifications.instance.events.listen((_) => _loadMine());
    Session.instance.me.addListener(_loadMine);
  }

  @override
  void dispose() {
    _sub?.cancel();
    Session.instance.me.removeListener(_loadMine);
    _search.dispose();
    super.dispose();
  }

  Future<void> _loadMine() async {
    if (!Session.instance.loggedIn) {
      if (mounted) setState(() {
        _activeOrders = [];
        _reorder = [];
      });
      return;
    }
    try {
      final results = await Future.wait([
        Api.instance.page('/m/api/v1/orders', null, {'status': 'active', 'limit': 5}),
        Api.instance.page('/m/api/v1/orders', null, {'status': 'done', 'limit': 20}),
      ]);
      final seen = <int>{};
      final reorder = <Map<String, dynamic>>[];
      for (final o in results[1].items) {
        if (o['status'] == 'completed' && seen.add(asInt(o['dish_id']))) reorder.add(o);
      }
      if (!mounted) return;
      setState(() {
        _activeOrders = results[0].items;
        _reorder = reorder.take(8).toList();
      });
    } catch (_) {}
  }

  Widget _activeOrdersCard() {
    if (_filtering || _activeOrders.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SectionTitle('طلباتك الجارية'),
      for (final o in _activeOrders)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: Material(
            color: DoqColors.surface3,
            borderRadius: BorderRadius.circular(16),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () async {
                await Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderScreen(publicId: asStr(o['public_id']))));
                _loadMine();
              },
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: DoqColors.secondary.withValues(alpha: 0.5)),
                ),
                child: Row(children: [
                  const CircleAvatar(backgroundColor: DoqColors.secondary, child: Icon(Icons.delivery_dining_rounded, color: Colors.white)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${asStr(o['dish_name'])} × ${asInt(o['quantity'])}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(statusLabel(asStr(o['status'])), style: const TextStyle(color: DoqColors.primary, fontWeight: FontWeight.w700, fontSize: 13)),
                    ]),
                  ),
                  const Text('تتبع', style: TextStyle(color: DoqColors.primary, fontWeight: FontWeight.w800)),
                  const Icon(Icons.chevron_left_rounded, color: DoqColors.primary),
                ]),
              ),
            ),
          ),
        ),
    ]);
  }

  Widget _reorderStrip() {
    if (_filtering || _reorder.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SectionTitle('اطلب تاني'),
      SizedBox(
        height: 150,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: _reorder.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (context, i) {
            final o = _reorder[i];
            return SizedBox(
              width: 130,
              child: Card(
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => openDish(context, o['dish_id']),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    SizedBox(height: 84, child: netImage(o['dish_image'])),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(8, 6, 8, 0),
                      child: Text(asStr(o['dish_name']), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text(asStr(o['kitchen_name']), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, color: DoqColors.muted)),
                    ),
                  ]),
                ),
              ),
            );
          },
        ),
      ),
    ]);
  }

  Future<void> _loadHome() async {
    try {
      final data = asMap((await Api.instance.get('/m/api/v1/home'))['data']);
      if (!mounted) return;
      setState(() {
        _categories = asList(data['categories']).map(asMap).toList();
        _kitchens = asList(data['kitchens']).map(asMap).toList();
        _homeLoaded = true;
      });
    } catch (_) {
      if (mounted) setState(() => _homeLoaded = true);
    }
  }

  void _applySearch(String value) {
    setState(() => _q = value.trim());
    _listKey.currentState?.reset();
  }

  void _selectCategory(int? id, String name) {
    setState(() {
      _categoryId = id;
      _categoryName = name;
    });
    _listKey.currentState?.reset();
  }

  bool get _filtering => _q.isNotEmpty || _categoryId != null;

  Widget _hero() {
    final name = asStr(Session.instance.me.value?['first_name']);
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [DoqColors.primary, DoqColors.primaryDark, Color(0xFF4A0D08)],
        ),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(name.isEmpty ? 'أهلاً بيك في دوق' : 'أهلاً يا $name', style: const TextStyle(color: Colors.white70, fontSize: 13)),
        const SizedBox(height: 4),
        const Text('عايز تاكل إيه النهارده؟', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
        const SizedBox(height: 14),
        TextField(
          controller: _search,
          textInputAction: TextInputAction.search,
          onSubmitted: _applySearch,
          decoration: InputDecoration(
            hintText: 'ابحث عن طبق أو مطبخ',
            prefixIcon: const Icon(Icons.search_rounded),
            suffixIcon: _q.isEmpty
                ? null
                : IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () {
                      _search.clear();
                      _applySearch('');
                    },
                  ),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
          ),
        ),
      ]),
    );
  }

  Widget _categoryChips() {
    if (!_homeLoaded || _categories.isEmpty) return const SizedBox(height: 8);
    return SizedBox(
      height: 54,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 8),
            child: ChoiceChip(label: const Text('الكل'), selected: _categoryId == null, onSelected: (_) => _selectCategory(null, '')),
          ),
          for (final c in _categories)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: ChoiceChip(
                label: Text('${asStr(c['name'])}  ${asInt(c['dishes_count'])}'),
                selected: _categoryId == asInt(c['id']),
                onSelected: (_) => _selectCategory(asInt(c['id']), asStr(c['name'])),
              ),
            ),
        ],
      ),
    );
  }

  Widget _kitchensStrip() {
    if (_filtering || _kitchens.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionTitle('مطابخ جديدة', action: 'الكل', onAction: () => Shell.tab.value = 1),
      SizedBox(
        height: 172,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: _kitchens.length,
          separatorBuilder: (_, __) => const SizedBox(width: 12),
          itemBuilder: (context, i) {
            final k = _kitchens[i];
            return SizedBox(
              width: 260,
              child: Card(
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => openKitchen(context, k['id']),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    SizedBox(height: 96, child: netImage(k['image_url'], fallback: kitchenCoverFallback)),
                    Padding(
                      padding: const EdgeInsets.all(10),
                      child: Row(children: [
                        ClipOval(child: netImage(k['portfolio_url'], fallback: kitchenAvatarFallback, width: 42, height: 42)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(asStr(k['title']), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                            Row(children: [
                              RatingTag(avg: k['avg_rating']),
                              Text('  ·  ${asInt(k['dishes_count'])} طبق', style: const TextStyle(fontSize: 12, color: DoqColors.muted)),
                            ]),
                          ]),
                        ),
                      ]),
                    ),
                  ]),
                ),
              ),
            );
          },
        ),
      ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final title = _q.isNotEmpty ? 'نتائج "$_q"' : (_categoryId != null ? _categoryName : 'كل الأطباق');
    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          ClipOval(child: Image.asset('assets/images/logo.png', width: 34, height: 34)),
          const SizedBox(width: 8),
          const Text('دوق'),
        ]),
        actions: const [NotificationBell(), SizedBox(width: 6)],
      ),
      body: CursorList(
        key: _listKey,
        grid: true,
        fetch: (cursor) => Api.instance.page('/m/api/v1/dishes', cursor, {'q': _q, 'category_id': _categoryId}),
        itemBuilder: (context, dish, i) => DishCard(dish: dish),
        empty: const EmptyState(icon: Icons.search_off_rounded, title: 'مفيش أطباق مطابقة', text: 'جرب كلمة تانية أو تصنيف مختلف'),
        headerSlivers: [
          SliverToBoxAdapter(child: _hero()),
          SliverToBoxAdapter(child: _activeOrdersCard()),
          SliverToBoxAdapter(child: _categoryChips()),
          SliverToBoxAdapter(child: _reorderStrip()),
          SliverToBoxAdapter(child: _kitchensStrip()),
          SliverToBoxAdapter(child: SectionTitle(title)),
        ],
      ),
    );
  }
}
