import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../screens/auth_screen.dart';
import '../screens/dish_screen.dart';
import '../screens/kitchen_screen.dart';
import 'theme.dart';

const dishFallback = 'assets/images/dish.jpg';
const kitchenCoverFallback = 'assets/images/kitchen_cover.jpg';
const kitchenAvatarFallback = 'assets/images/kitchen_avatar.jpg';

/// Network image from the DOQ server with a local fallback.
Widget netImage(dynamic path, {String fallback = dishFallback, BoxFit fit = BoxFit.cover, double? width, double? height}) {
  final url = Api.instance.imageUrl(path);
  final placeholder = Image.asset(fallback, fit: fit, width: width, height: height);
  if (url.isEmpty) return placeholder;
  return Image.network(
    url,
    fit: fit,
    width: width,
    height: height,
    errorBuilder: (context, error, stack) => placeholder,
    loadingBuilder: (context, child, progress) => progress == null ? child : Container(width: width, height: height, color: DoqColors.surface2),
  );
}

void showMessage(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: error ? DoqColors.danger : DoqColors.ink,
    ));
}

/// Opens the login screen when the user is a guest. Returns true when signed in.
Future<bool> ensureLoggedIn(BuildContext context) async {
  if (Session.instance.loggedIn) return true;
  final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const AuthScreen()));
  return ok == true && Session.instance.loggedIn;
}

void openDish(BuildContext context, dynamic id) {
  Navigator.of(context).push(MaterialPageRoute(builder: (_) => DishScreen(dishId: asInt(id))));
}

void openKitchen(BuildContext context, dynamic id) {
  Navigator.of(context).push(MaterialPageRoute(builder: (_) => KitchenScreen(kitchenId: asInt(id))));
}

class RatingTag extends StatelessWidget {
  const RatingTag({super.key, required this.avg, this.count});

  final dynamic avg;
  final dynamic count;

  @override
  Widget build(BuildContext context) {
    final value = avg == null ? null : asNum(avg);
    if (value == null || value == 0) {
      return const Text('جديد', style: TextStyle(fontSize: 12, color: DoqColors.muted));
    }
    final c = count == null ? 0 : asInt(count);
    return Row(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.star_rounded, size: 16, color: DoqColors.star),
      const SizedBox(width: 2),
      Text(value.toStringAsFixed(1), style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFFA16207))),
      if (c > 0) Text(' ($c)', style: const TextStyle(fontSize: 12, color: DoqColors.muted)),
    ]);
  }
}

class Stars extends StatelessWidget {
  const Stars({super.key, required this.rating, this.size = 16});

  final int rating;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) => Icon(i < rating ? Icons.star_rounded : Icons.star_outline_rounded, size: size, color: DoqColors.star)),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});

  final String status;

  static const _colors = <String, List<Color>>{
    'pending': [Color(0xFFFEF3C7), Color(0xFF92400E)],
    'chef_accepted': [Color(0xFFDBEAFE), Color(0xFF1E40AF)],
    'accepted': [Color(0xFFE0E7FF), Color(0xFF3730A3)],
    'out_for_delivery': [Color(0xFFF3E8FF), Color(0xFF6B21A8)],
    'completed': [Color(0xFFDCFCE7), Color(0xFF166534)],
    'cancelled': [Color(0xFFFEE2E2), Color(0xFF991B1B)],
  };

  @override
  Widget build(BuildContext context) {
    final c = _colors[status] ?? const [DoqColors.surface3, DoqColors.muted];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: c[0], borderRadius: BorderRadius.circular(99)),
      child: Text(statusLabel(status), style: TextStyle(color: c[1], fontSize: 12, fontWeight: FontWeight.w800)),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.text, this.actionLabel, this.onAction});

  final IconData icon;
  final String title;
  final String? text;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        CircleAvatar(radius: 36, backgroundColor: DoqColors.surface2, child: Icon(icon, size: 34, color: DoqColors.primary)),
        const SizedBox(height: 12),
        Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        if (text != null) ...[
          const SizedBox(height: 4),
          Text(text!, textAlign: TextAlign.center, style: const TextStyle(color: DoqColors.muted)),
        ],
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(height: 14),
          FilledButton(onPressed: onAction, child: Text(actionLabel!)),
        ],
      ]),
    );
  }
}

/// Heart button that adds / removes a dish from favourites.
class FavouriteButton extends StatefulWidget {
  const FavouriteButton({super.key, required this.dishId, required this.initial, this.onChanged, this.filled = true});

  final int dishId;
  final bool initial;
  final ValueChanged<bool>? onChanged;
  final bool filled;

  @override
  State<FavouriteButton> createState() => _FavouriteButtonState();
}

class _FavouriteButtonState extends State<FavouriteButton> {
  late bool _on = widget.initial;
  bool _busy = false;

  @override
  void didUpdateWidget(covariant FavouriteButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initial != widget.initial) _on = widget.initial;
  }

  Future<void> _toggle() async {
    if (_busy) return;
    if (!await ensureLoggedIn(context)) return;
    setState(() => _busy = true);
    try {
      if (_on) {
        await Api.instance.delete('/platform/favourites/${widget.dishId}');
      } else {
        await Api.instance.post('/platform/favourites/${widget.dishId}');
      }
      if (!mounted) return;
      setState(() => _on = !_on);
      widget.onChanged?.call(_on);
      showMessage(context, _on ? 'اتضاف للمفضلة' : 'اتشال من المفضلة');
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: widget.filled ? Colors.white.withValues(alpha: 0.92) : DoqColors.surface2,
      shape: const CircleBorder(),
      child: IconButton(
        tooltip: _on ? 'شيل من المفضلة' : 'أضف للمفضلة',
        visualDensity: VisualDensity.compact,
        onPressed: _toggle,
        icon: Icon(_on ? Icons.favorite_rounded : Icons.favorite_border_rounded, color: DoqColors.primary, size: 22),
      ),
    );
  }
}

class DishCard extends StatelessWidget {
  const DishCard({super.key, required this.dish, this.onFavouriteChanged});

  final Map<String, dynamic> dish;
  final ValueChanged<bool>? onFavouriteChanged;

  @override
  Widget build(BuildContext context) {
    final available = dish['available'] != false;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => openDish(context, dish['id']),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          AspectRatio(
            aspectRatio: 4 / 3,
            child: Stack(fit: StackFit.expand, children: [
              netImage(dish['image_url']),
              PositionedDirectional(
                top: 6,
                end: 6,
                child: FavouriteButton(dishId: asInt(dish['id']), initial: dish['is_favourite'] == true, onChanged: onFavouriteChanged),
              ),
            ]),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(asStr(dish['name']), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, height: 1.3)),
                const SizedBox(height: 2),
                Text(
                  available ? asStr(dish['kitchen_name']) : '${asStr(dish['kitchen_name'])} · غير متاح حالياً',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: DoqColors.muted),
                ),
                const Spacer(),
                Row(children: [
                  Expanded(child: Text(money(dish['price']), style: const TextStyle(color: DoqColors.primary, fontWeight: FontWeight.w900))),
                  RatingTag(avg: dish['avg_rating']),
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

class KitchenTile extends StatelessWidget {
  const KitchenTile({super.key, required this.kitchen});

  final Map<String, dynamic> kitchen;

  @override
  Widget build(BuildContext context) {
    final city = asStr(kitchen['city']);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => openKitchen(context, kitchen['id']),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: netImage(asStr(kitchen['portfolio_url']).isNotEmpty ? kitchen['portfolio_url'] : kitchen['image_url'], fallback: kitchenAvatarFallback, width: 82, height: 82),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(asStr(kitchen['title']), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5)),
                Text(
                  asStr(kitchen['description']).isEmpty ? 'مطبخ بيتي' : asStr(kitchen['description']),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: DoqColors.muted, fontSize: 13),
                ),
                const SizedBox(height: 6),
                Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                  RatingTag(avg: kitchen['avg_rating'], count: kitchen['reviews_count']),
                  if (city.isNotEmpty) Pill(icon: Icons.place_outlined, text: city),
                  Pill(text: '${asInt(kitchen['dishes_count'])} طبق'),
                ]),
              ]),
            ),
            const Icon(Icons.chevron_left_rounded, color: DoqColors.line),
          ]),
        ),
      ),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill({super.key, required this.text, this.icon});

  final String text;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(color: DoqColors.surface3, borderRadius: BorderRadius.circular(99)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 14, color: DoqColors.muted), const SizedBox(width: 3)],
        Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: DoqColors.muted)),
      ]),
    );
  }
}

/// Shown on personal tabs (orders / favourites / account) for guests.
class LoginPrompt extends StatelessWidget {
  const LoginPrompt({super.key, required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: EmptyState(
        icon: icon,
        title: title,
        text: 'سجل دخول أو اعمل حساب في أقل من دقيقة',
        actionLabel: 'تسجيل الدخول',
        onAction: () => ensureLoggedIn(context),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.action, this.onAction});

  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 10),
      child: Row(children: [
        Expanded(child: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))),
        if (action != null)
          TextButton(onPressed: onAction, child: Text(action!, style: const TextStyle(fontWeight: FontWeight.w800, color: DoqColors.primary))),
      ]),
    );
  }
}

class KeyValueRow extends StatelessWidget {
  const KeyValueRow(this.label, this.value, {super.key, this.valueColor, this.bold = true, this.last = false});

  final String label;
  final String value;
  final Color? valueColor;
  final bool bold;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: DoqColors.surface2))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(color: DoqColors.muted)),
        const SizedBox(width: 12),
        Expanded(
          child: Text(value, textAlign: TextAlign.end, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w500, color: valueColor)),
        ),
      ]),
    );
  }
}
