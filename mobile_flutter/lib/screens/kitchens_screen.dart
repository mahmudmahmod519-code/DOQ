import 'package:flutter/material.dart';

import '../core/api.dart';
import '../ui/cursor_list.dart';
import '../ui/widgets.dart';
import 'notification_bell.dart';

class KitchensScreen extends StatefulWidget {
  const KitchensScreen({super.key});

  @override
  State<KitchensScreen> createState() => _KitchensScreenState();
}

class _KitchensScreenState extends State<KitchensScreen> {
  final _listKey = GlobalKey<CursorListState>();
  final _search = TextEditingController();
  List<String> _cities = [];
  String _q = '';
  String _city = '';

  @override
  void initState() {
    super.initState();
    Api.instance.get('/m/api/v1/cities').then((res) {
      if (mounted) setState(() => _cities = asList(res['data']).map((e) => '$e').toList());
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _reload() => _listKey.currentState?.reset();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('المطابخ'), actions: const [NotificationBell(), SizedBox(width: 6)]),
      body: CursorList(
        key: _listKey,
        fetch: (cursor) => Api.instance.page('/m/api/v1/kitchens', cursor, {'q': _q, 'city': _city}),
        itemBuilder: (context, k, i) => KitchenTile(kitchen: k),
        empty: const EmptyState(icon: Icons.storefront_outlined, title: 'مفيش مطابخ مطابقة', text: 'جرب مدينة تانية أو امسح البحث'),
        headerSlivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(hintText: 'ابحث باسم المطبخ', prefixIcon: Icon(Icons.search_rounded)),
                onSubmitted: (v) {
                  setState(() => _q = v.trim());
                  _reload();
                },
              ),
            ),
          ),
          if (_cities.isNotEmpty)
            SliverToBoxAdapter(
              child: SizedBox(
                height: 54,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  children: [
                    for (final city in ['', ..._cities])
                      Padding(
                        padding: const EdgeInsetsDirectional.only(end: 8),
                        child: ChoiceChip(
                          label: Text(city.isEmpty ? 'كل المدن' : city),
                          selected: _city == city,
                          onSelected: (_) {
                            setState(() => _city = city);
                            _reload();
                          },
                        ),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
