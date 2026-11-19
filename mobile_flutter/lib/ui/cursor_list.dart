import 'package:flutter/material.dart';

import '../core/api.dart';
import 'theme.dart';
import 'widgets.dart';

typedef PageFetcher = Future<ApiPage> Function(String? cursor);
typedef MapItemBuilder = Widget Function(BuildContext context, Map<String, dynamic> item, int index);

/// Infinite list driven by cursor pagination.
/// Loads the next page when the user gets close to the end, supports pull-to-refresh,
/// and ignores stale responses after [CursorListState.reset].
class CursorList extends StatefulWidget {
  const CursorList({
    super.key,
    required this.fetch,
    required this.itemBuilder,
    required this.empty,
    this.grid = false,
    this.headerSlivers = const [],
    this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 24),
    this.gridAspectRatio = 0.66,
  });

  final PageFetcher fetch;
  final MapItemBuilder itemBuilder;
  final Widget empty;
  final bool grid;
  final List<Widget> headerSlivers;
  final EdgeInsets padding;
  final double gridAspectRatio;

  @override
  State<CursorList> createState() => CursorListState();
}

class CursorListState extends State<CursorList> {
  final List<Map<String, dynamic>> items = [];
  final ScrollController _controller = ScrollController();
  String? _cursor;
  bool _hasMore = true;
  bool _loading = false;
  String? _error;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_controller.hasClients) return;
    final position = _controller.position;
    if (position.pixels > position.maxScrollExtent - 600) _load();
  }

  /// Clears the list and loads the first page again (filters changed, refresh...).
  Future<void> reset() async {
    setState(() {
      _generation++;
      items.clear();
      _cursor = null;
      _hasMore = true;
      _loading = false;
      _error = null;
    });
    await _load();
  }

  void removeWhere(bool Function(Map<String, dynamic> item) test) {
    setState(() => items.removeWhere(test));
  }

  Future<void> _load() async {
    if (_loading || !_hasMore) return;
    final generation = _generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await widget.fetch(_cursor);
      if (!mounted || generation != _generation) return;
      setState(() {
        items.addAll(page.items);
        _cursor = page.nextCursor;
        _hasMore = page.hasMore && page.nextCursor != null;
      });
    } on ApiException catch (e) {
      if (!mounted || generation != _generation) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted && generation == _generation) setState(() => _loading = false);
    }
    // Short first page that does not fill the screen: keep loading.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_hasMore || _loading || _error != null || !_controller.hasClients) return;
      if (_controller.position.maxScrollExtent < 300) _load();
    });
  }

  Widget _footer() {
    if (_error != null) {
      return EmptyState(icon: Icons.wifi_off_rounded, title: _error!, actionLabel: 'حاول تاني', onAction: _load);
    }
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: CircularProgressIndicator(color: DoqColors.primary)),
      );
    }
    if (items.isEmpty) return widget.empty;
    if (!_hasMore && items.length > 6) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: Text('وصلت لآخر القائمة', style: TextStyle(color: DoqColors.muted, fontSize: 12.5))),
      );
    }
    return const SizedBox(height: 16);
  }

  @override
  Widget build(BuildContext context) {
    final Widget body = widget.grid
        ? SliverGrid(
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: widget.gridAspectRatio,
            ),
            delegate: SliverChildBuilderDelegate((context, i) => widget.itemBuilder(context, items[i], i), childCount: items.length),
          )
        : SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, i) => Padding(padding: const EdgeInsets.only(bottom: 10), child: widget.itemBuilder(context, items[i], i)),
              childCount: items.length,
            ),
          );
    return RefreshIndicator(
      color: DoqColors.primary,
      onRefresh: reset,
      child: CustomScrollView(
        controller: _controller,
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          ...widget.headerSlivers,
          SliverPadding(padding: widget.padding, sliver: body),
          SliverToBoxAdapter(child: _footer()),
        ],
      ),
    );
  }
}
