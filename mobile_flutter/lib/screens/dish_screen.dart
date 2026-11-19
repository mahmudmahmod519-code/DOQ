import 'dart:math';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'account_screen.dart';
import 'order_screen.dart';

class DishScreen extends StatefulWidget {
  const DishScreen({super.key, required this.dishId});

  final int dishId;

  @override
  State<DishScreen> createState() => _DishScreenState();
}

class _DishScreenState extends State<DishScreen> {
  Map<String, dynamic>? _dish;
  String? _error;
  final List<Map<String, dynamic>> _reviews = [];
  String? _reviewsCursor;
  bool _reviewsMore = true;
  bool _reviewsLoading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await Api.instance.get('/m/api/v1/dishes/${widget.dishId}');
      if (!mounted) return;
      setState(() => _dish = asMap(res['data']));
      _loadReviews();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  /// Reviews use the same cursor pagination ("عرض المزيد" loads the next page).
  Future<void> _loadReviews() async {
    if (_reviewsLoading || !_reviewsMore) return;
    setState(() => _reviewsLoading = true);
    try {
      final page = await Api.instance.page('/m/api/v1/dishes/${widget.dishId}/reviews', _reviewsCursor, {'limit': 5});
      if (!mounted) return;
      setState(() {
        _reviews.addAll(page.items);
        _reviewsCursor = page.nextCursor;
        _reviewsMore = page.hasMore;
      });
    } catch (_) {
      if (mounted) setState(() => _reviewsMore = false);
    } finally {
      if (mounted) setState(() => _reviewsLoading = false);
    }
  }

  Future<void> _openOrderSheet() async {
    if (!await ensureLoggedIn(context)) return;
    if (!mounted) return;
    final dish = _dish!;
    final publicId = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: DoqColors.background,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => OrderSheet(dish: dish),
    );
    if (publicId != null && mounted) {
      Notifications.instance.tick();
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => OrderScreen(publicId: publicId)));
    }
  }

  Widget _reviewForm(Map<String, dynamic> dish) {
    if (!Session.instance.loggedIn) {
      return OutlinedButton(
        onPressed: () async {
          if (await ensureLoggedIn(context)) {
            setState(() => _dish = null);
            _reviews.clear();
            _reviewsCursor = null;
            _reviewsMore = true;
            _load();
          }
        },
        child: const Text('سجل دخول عشان تقيّم'),
      );
    }
    final mine = dish['my_review'];
    if (mine is Map) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('تقييمك', style: TextStyle(color: DoqColors.muted, fontSize: 13)),
            Stars(rating: asInt(mine['rating'])),
            if (asStr(mine['comment']).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(asStr(mine['comment']))),
          ]),
        ),
      );
    }
    return ReviewForm(
      dishId: asInt(dish['id']),
      onSubmitted: (rating, comment) => setState(() => _dish = {...dish, 'my_review': {'rating': rating, 'comment': comment}}),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dish = _dish;
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(child: EmptyState(icon: Icons.no_food_outlined, title: _error!, actionLabel: 'رجوع', onAction: () => Navigator.of(context).pop())),
      );
    }
    if (dish == null) {
      return Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator(color: DoqColors.primary)));
    }
    final ingredients = asList(dish['ingredients']).map((e) => '$e').where((e) => e.isNotEmpty).toList();
    final fee = asNum(dish['delivery_fee']);
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: Padding(
          padding: const EdgeInsets.all(6),
          child: CircleAvatar(backgroundColor: Colors.black38, child: BackButton(color: Colors.white, onPressed: () => Navigator.of(context).pop())),
        ),
      ),
      body: ListView(padding: EdgeInsets.zero, children: [
        AspectRatio(aspectRatio: 4 / 3, child: netImage(dish['image_url'])),
        Container(
          transform: Matrix4.translationValues(0, -22, 0),
          decoration: const BoxDecoration(color: DoqColors.background, borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Text(asStr(dish['name']), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, height: 1.35))),
              FavouriteButton(dishId: asInt(dish['id']), initial: dish['is_favourite'] == true, filled: false),
            ]),
            const SizedBox(height: 6),
            Wrap(spacing: 10, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text(money(dish['price']), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: DoqColors.primary)),
              RatingTag(avg: dish['avg_rating'], count: dish['reviews_count']),
              if (asStr(dish['category_name']).isNotEmpty) Pill(text: asStr(dish['category_name'])),
            ]),
            const SizedBox(height: 14),
            Card(
              clipBehavior: Clip.antiAlias,
              child: ListTile(
                onTap: () => openKitchen(context, dish['kitchen_id']),
                leading: ClipOval(child: netImage(dish['kitchen_image'], fallback: kitchenAvatarFallback, width: 44, height: 44)),
                title: const Text('من مطبخ', style: TextStyle(fontSize: 12, color: DoqColors.muted)),
                subtitle: Text(asStr(dish['kitchen_name']), style: const TextStyle(fontWeight: FontWeight.w800, color: DoqColors.ink, fontSize: 15)),
                trailing: const Icon(Icons.chevron_left_rounded),
              ),
            ),
            if (asStr(dish['description']).isNotEmpty) ...[
              const SizedBox(height: 16),
              const Text('الوصف', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 4),
              Text(asStr(dish['description']), style: const TextStyle(color: DoqColors.muted, height: 1.6)),
            ],
            if (ingredients.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Text('المكونات', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 8),
              Wrap(spacing: 6, runSpacing: 6, children: [for (final i in ingredients) Pill(text: i)]),
            ],
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                child: Column(children: [
                  KeyValueRow('رسوم التوصيل', fee > 0 ? money(fee) : 'مجاني'),
                  KeyValueRow('المدينة', asStr(dish['kitchen_city']).isEmpty ? '—' : asStr(dish['kitchen_city']), last: true),
                ]),
              ),
            ),
            const SizedBox(height: 18),
            Row(children: [
              const Expanded(child: Text('التقييمات', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17))),
              if (asInt(dish['reviews_count']) > 0) Text('${asInt(dish['reviews_count'])} تقييم', style: const TextStyle(color: DoqColors.muted)),
            ]),
            const SizedBox(height: 10),
            _reviewForm(dish),
            const SizedBox(height: 10),
            if (_reviews.isEmpty && !_reviewsLoading)
              const EmptyState(icon: Icons.star_outline_rounded, title: 'لسه مفيش تقييمات', text: 'اطلب الطبق وكن أول واحد يقيّمه')
            else
              Card(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: Column(children: [
                    for (var i = 0; i < _reviews.length; i++) _ReviewTile(review: _reviews[i], last: i == _reviews.length - 1 && !_reviewsMore),
                    if (_reviewsLoading)
                      const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(color: DoqColors.primary))
                    else if (_reviewsMore)
                      TextButton(onPressed: _loadReviews, child: const Text('عرض المزيد', style: TextStyle(fontWeight: FontWeight.w800))),
                  ]),
                ),
              ),
            const SizedBox(height: 100),
          ]),
        ),
      ]),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: DoqColors.line))),
          child: Row(children: [
            Expanded(
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('السعر', style: TextStyle(fontSize: 12, color: DoqColors.muted)),
                Text(money(dish['price']), style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: DoqColors.primary)),
              ]),
            ),
            FilledButton.icon(onPressed: _openOrderSheet, icon: const Icon(Icons.shopping_bag_outlined), label: const Text('اطلب دلوقتي')),
          ]),
        ),
      ),
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({required this.review, required this.last});

  final Map<String, dynamic> review;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: DoqColors.surface2))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(asStr(review['author']), style: const TextStyle(fontWeight: FontWeight.w800))),
          Text(timeAgo(review['created_at']), style: const TextStyle(fontSize: 12, color: DoqColors.muted)),
        ]),
        Stars(rating: asInt(review['rating'])),
        if (asStr(review['comment']).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(asStr(review['comment']))),
      ]),
    );
  }
}

class ReviewForm extends StatefulWidget {
  const ReviewForm({super.key, required this.dishId, required this.onSubmitted});

  final int dishId;
  final void Function(int rating, String comment) onSubmitted;

  @override
  State<ReviewForm> createState() => _ReviewFormState();
}

class _ReviewFormState extends State<ReviewForm> {
  final _comment = TextEditingController();
  int _rating = 0;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating == 0) {
      setState(() => _error = 'اختار عدد النجوم الأول');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await Api.instance.post('/reviews/v1/api', {'dish_id': widget.dishId, 'rating': _rating, 'comment': _comment.text.trim()});
      if (!mounted) return;
      showMessage(context, 'شكراً! تقييمك اتسجل');
      widget.onSubmitted(_rating, _comment.text.trim());
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('قيّم الطبق', style: TextStyle(fontWeight: FontWeight.w800)),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 1; i <= 5; i++)
                IconButton(
                  tooltip: '$i نجوم',
                  onPressed: () => setState(() => _rating = i),
                  icon: Icon(i <= _rating ? Icons.star_rounded : Icons.star_outline_rounded, size: 34, color: DoqColors.star),
                ),
            ],
          ),
          TextField(controller: _comment, maxLines: 3, maxLength: 1000, decoration: const InputDecoration(hintText: 'اكتب رأيك (اختياري)')),
          if (_error != null) Text(_error!, style: const TextStyle(color: DoqColors.danger, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          FilledButton(onPressed: _busy ? null : _submit, child: Text(_busy ? 'جاري الإرسال...' : 'إرسال التقييم')),
        ]),
      ),
    );
  }
}

/// Bottom sheet: order name, quantity, coupon, summary, confirm.
/// Pops with the new order public_id on success.
class OrderSheet extends StatefulWidget {
  const OrderSheet({super.key, required this.dish});

  final Map<String, dynamic> dish;

  @override
  State<OrderSheet> createState() => _OrderSheetState();
}

class _OrderSheetState extends State<OrderSheet> {
  final _name = TextEditingController();
  final _coupon = TextEditingController();
  int _qty = 1;
  Map<String, dynamic>? _couponResult;
  String? _couponMessage;
  bool _couponOk = false;
  String? _error;
  bool _busy = false;
  late String _idempotencyKey = _newKey();

  static String _newKey() {
    final r = Random.secure();
    return List.generate(32, (_) => r.nextInt(16).toRadixString(16)).join();
  }

  @override
  void dispose() {
    _name.dispose();
    _coupon.dispose();
    super.dispose();
  }

  num get _price => asNum(widget.dish['price']);

  void _setQty(int value) {
    setState(() {
      _qty = min(50, max(1, value));
      if (_couponResult != null) {
        _couponResult = null;
        _couponOk = false;
        _couponMessage = 'الكمية اتغيرت. طبّق الكوبون تاني';
      }
    });
  }

  Future<void> _applyCoupon() async {
    final code = _coupon.text.trim().toUpperCase();
    if (code.isEmpty) {
      setState(() => _couponMessage = 'اكتب الكود الأول');
      return;
    }
    try {
      final res = await Api.instance.post('/platform/coupons/validate', {'dish_id': asInt(widget.dish['id']), 'quantity': _qty, 'code': code});
      setState(() {
        _couponResult = {...asMap(res['data']), 'code': code};
        _couponOk = true;
        _couponMessage = 'تم تطبيق خصم ${asNum(_couponResult!['discount_percent'])}%';
      });
    } on ApiException catch (e) {
      setState(() {
        _couponResult = null;
        _couponOk = false;
        _couponMessage = e.message;
      });
    }
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    if (name.length < 2) {
      setState(() => _error = 'اكتب اسم للطلب (حرفين على الأقل)');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await Api.instance.post(
        '/orders/api/v1',
        {
          'dish_id': asInt(widget.dish['id']),
          'quantity': _qty,
          'order_name': name,
          'coupon_code': _couponResult == null ? '' : asStr(_couponResult!['code']),
        },
        {'Idempotency-Key': _idempotencyKey},
      );
      if (!mounted) return;
      showMessage(context, asStr(res['message']).isEmpty ? 'تم إرسال الطلب' : asStr(res['message']));
      Navigator.of(context).pop(asStr(asMap(res['data'])['public_id']));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _busy = false;
        _idempotencyKey = _newKey();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = Session.instance.me.value ?? const <String, dynamic>{};
    final address = [asStr(me['city']), asStr(me['address'])].where((e) => e.isNotEmpty).join(' - ');
    final gross = _price * _qty;
    final discount = _couponResult == null ? 0 : asNum(_couponResult!['discount_amount']);
    final fee = asNum(widget.dish['delivery_fee']);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Center(child: Container(width: 42, height: 5, margin: const EdgeInsets.only(bottom: 12), decoration: BoxDecoration(color: DoqColors.line, borderRadius: BorderRadius.circular(9)))),
          const Text('تأكيد الطلب', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          TextField(controller: _name, maxLength: 60, decoration: const InputDecoration(labelText: 'اسم الطلب', hintText: 'مثلاً: غدا البيت')),
          Row(children: [
            const Expanded(child: Text('الكمية', style: TextStyle(fontWeight: FontWeight.w700))),
            Container(
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: DoqColors.line)),
              child: Row(children: [
                IconButton(onPressed: () => _setQty(_qty + 1), icon: const Icon(Icons.add_rounded, color: DoqColors.primary), tooltip: 'زود'),
                SizedBox(width: 32, child: Text('$_qty', textAlign: TextAlign.center, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900))),
                IconButton(onPressed: () => _setQty(_qty - 1), icon: const Icon(Icons.remove_rounded, color: DoqColors.primary), tooltip: 'قلل'),
              ]),
            ),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _coupon,
                textCapitalization: TextCapitalization.characters,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(labelText: 'كود خصم (اختياري)', hintText: 'DOQ-XXXXXXXX'),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(onPressed: _applyCoupon, child: const Text('تطبيق')),
          ]),
          if (_couponMessage != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(_couponMessage!, style: TextStyle(color: _couponOk ? DoqColors.ok : DoqColors.danger, fontWeight: FontWeight.w700)),
            ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              child: Column(children: [
                KeyValueRow('${asStr(widget.dish['name'])} × $_qty', money(gross)),
                if (discount > 0) KeyValueRow('خصم الكوبون', '− ${money(discount)}', valueColor: DoqColors.ok),
                if (fee > 0) KeyValueRow('التوصيل (يتدفع للمندوب)', money(fee)),
                KeyValueRow(fee > 0 ? 'الإجمالي (من غير التوصيل)' : 'الإجمالي', money(gross - discount), valueColor: DoqColors.primary, last: true),
              ]),
            ),
          ),
          const SizedBox(height: 10),
          Row(children: [
            const Icon(Icons.place_outlined, size: 18, color: DoqColors.muted),
            const SizedBox(width: 4),
            Expanded(
              child: Text(
                address.isEmpty ? 'مفيش عنوان مسجل. ضيفه عشان المندوب يوصلك' : address,
                style: TextStyle(color: address.isEmpty ? DoqColors.danger : DoqColors.muted, fontSize: 13),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AccountScreen(standalone: true))).then((_) {
                if (mounted) setState(() {});
              }),
              child: const Text('تعديل', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ]),
          if (_error != null)
            Padding(padding: const EdgeInsets.only(top: 6), child: Text(_error!, style: const TextStyle(color: DoqColors.danger, fontWeight: FontWeight.w700))),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                : const Text('تأكيد الطلب'),
          ),
        ]),
      ),
    );
  }
}
