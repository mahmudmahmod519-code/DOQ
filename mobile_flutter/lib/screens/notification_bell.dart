import 'package:flutter/material.dart';

import '../core/session.dart';
import 'notifications_screen.dart';

/// App bar bell with the unread count (only for signed-in customers).
class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<Map<String, dynamic>?>(
      valueListenable: Session.instance.me,
      builder: (context, me, _) {
        if (me == null) return const SizedBox.shrink();
        return ValueListenableBuilder<int>(
          valueListenable: Notifications.instance.unread,
          builder: (context, count, _) => IconButton(
            tooltip: 'الإشعارات',
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NotificationsScreen())),
            icon: Badge(isLabelVisible: count > 0, label: Text(count > 99 ? '99+' : '$count'), child: const Icon(Icons.notifications_none_rounded)),
          ),
        );
      },
    );
  }
}
