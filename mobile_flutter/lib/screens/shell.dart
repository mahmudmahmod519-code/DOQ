import 'package:flutter/material.dart';

import '../core/session.dart';
import '../ui/theme.dart';
import 'account_screen.dart';
import 'favourites_screen.dart';
import 'home_screen.dart';
import 'kitchens_screen.dart';
import 'orders_screen.dart';

/// Bottom navigation: الرئيسية / المطابخ / طلباتي / المفضلة / حسابي
class Shell extends StatefulWidget {
  const Shell({super.key});

  /// Selected tab, so any screen can switch tabs (e.g. "الكل" on the home kitchens strip).
  static final ValueNotifier<int> tab = ValueNotifier<int>(0);

  @override
  State<Shell> createState() => ShellState();
}

class ShellState extends State<Shell> {
  int get index => Shell.tab.value;

  void select(int i) => Shell.tab.value = i;

  void _onTab() {
    if (mounted) setState(() {});
  }

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

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<Map<String, dynamic>?>(
      valueListenable: Session.instance.me,
      builder: (context, me, _) {
        return Scaffold(
          body: IndexedStack(index: index, children: [
            const HomeScreen(),
            const KitchensScreen(),
            OrdersScreen(key: ValueKey('orders-${me != null}')),
            FavouritesScreen(key: ValueKey('fav-${me != null}')),
            AccountScreen(key: ValueKey('acc-${me != null}')),
          ]),
          bottomNavigationBar: ValueListenableBuilder<int>(
            valueListenable: Notifications.instance.activeOrders,
            builder: (context, active, _) => NavigationBar(
              selectedIndex: index,
              onDestinationSelected: select,
              destinations: [
                const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded, color: DoqColors.primary), label: 'الرئيسية'),
                const NavigationDestination(icon: Icon(Icons.storefront_outlined), selectedIcon: Icon(Icons.storefront_rounded, color: DoqColors.primary), label: 'المطابخ'),
                NavigationDestination(
                  icon: Badge(isLabelVisible: me != null && active > 0, label: Text(active >= 10 ? '9+' : '$active'), child: const Icon(Icons.receipt_long_outlined)),
                  selectedIcon: const Icon(Icons.receipt_long_rounded, color: DoqColors.primary),
                  label: 'طلباتي',
                ),
                const NavigationDestination(icon: Icon(Icons.favorite_border_rounded), selectedIcon: Icon(Icons.favorite_rounded, color: DoqColors.primary), label: 'المفضلة'),
                const NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded, color: DoqColors.primary), label: 'حسابي'),
              ],
            ),
          ),
        );
      },
    );
  }
}
