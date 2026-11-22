import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../ui/cursor_list.dart';
import '../ui/widgets.dart';
import 'notification_bell.dart';
import 'shell.dart';

class FavouritesScreen extends StatefulWidget {
  const FavouritesScreen({super.key});

  @override
  State<FavouritesScreen> createState() => _FavouritesScreenState();
}

class _FavouritesScreenState extends State<FavouritesScreen> {
  final _listKey = GlobalKey<CursorListState>();

  @override
  void initState() {
    super.initState();
    Shell.tab.addListener(_onTab);
  }

  @override
  void dispose() {
    Shell.tab.removeListener(_onTab);
    super.dispose();
  }

  // Refresh when the tab is opened (a heart may have changed elsewhere)
  void _onTab() {
    if (Shell.tab.value == 3) _listKey.currentState?.reset();
  }

  @override
  Widget build(BuildContext context) {
    if (!Session.instance.loggedIn) {
      return Scaffold(appBar: AppBar(title: const Text('المفضلة')), body: const LoginPrompt(icon: Icons.favorite_border_rounded, title: 'سجل دخول عشان تحفظ أطباقك المفضلة'));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('المفضلة'), actions: const [NotificationBell(), SizedBox(width: 6)]),
      body: CursorList(
        key: _listKey,
        grid: true,
        fetch: (cursor) => Api.instance.page('/m/api/v1/favourites', cursor),
        itemBuilder: (context, dish, i) => DishCard(
          dish: dish,
          heroScope: 'fav',
          onFavouriteChanged: (on) {
            if (!on) _listKey.currentState?.removeWhere((d) => d['id'] == dish['id']);
          },
        ),
        empty: EmptyState(
          icon: Icons.favorite_border_rounded,
          title: 'مفيش أطباق في المفضلة',
          text: 'دوس على القلب في أي طبق عشان تلاقيه هنا بسرعة',
          actionLabel: 'تصفح الأطباق',
          onAction: () => Shell.tab.value = 0,
        ),
      ),
    );
  }
}
