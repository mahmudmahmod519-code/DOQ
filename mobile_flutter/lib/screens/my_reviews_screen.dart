import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../ui/cursor_list.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class MyReviewsScreen extends StatelessWidget {
  const MyReviewsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('تقييماتي')),
      body: CursorList(
        fetch: (cursor) => Api.instance.page('/m/api/v1/reviews/my', cursor),
        empty: const EmptyState(icon: Icons.star_outline_rounded, title: 'لسه ما قيمتش أي طبق'),
        itemBuilder: (context, r, i) => Card(
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => openDish(context, r['dish_id']),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(asStr(r['dish_name']), style: const TextStyle(fontWeight: FontWeight.w800))),
                  Text(timeAgo(r['created_at']), style: const TextStyle(fontSize: 12, color: DoqColors.muted)),
                ]),
                Text(asStr(r['kitchen_name']), style: const TextStyle(fontSize: 12.5, color: DoqColors.muted)),
                Stars(rating: asInt(r['rating'])),
                if (asStr(r['comment']).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(asStr(r['comment']))),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
