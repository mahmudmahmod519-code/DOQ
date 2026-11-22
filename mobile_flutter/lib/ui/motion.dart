import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'theme.dart';

/// Motion system of the DOQ app: one set of curves and durations used everywhere
/// (the same values as the website), and small widgets that make the app feel alive.
/// Every widget here respects the system "remove animations" setting.
class DoqMotion {
  DoqMotion._();

  /// Entrances and exits.
  static const Curve easeOut = Cubic(0.23, 1, 0.32, 1);

  /// Things that move on screen.
  static const Curve easeInOut = Cubic(0.77, 0, 0.175, 1);

  static const Duration press = Duration(milliseconds: 140);
  static const Duration quick = Duration(milliseconds: 220);
  static const Duration page = Duration(milliseconds: 380);
  static const Duration reveal = Duration(milliseconds: 520);

  /// True when the user turned animations off in the system accessibility settings.
  static bool reduced(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;
}

/// Clamp to 0..1 (typed double, unlike num.clamp).
double clamp01(double v) => v < 0.0 ? 0.0 : (v > 1.0 ? 1.0 : v);

/// Page transition for every MaterialPageRoute: the new page fades in while rising a little,
/// the page underneath fades back slightly.
class DoqPageTransitionsBuilder extends PageTransitionsBuilder {
  const DoqPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (DoqMotion.reduced(context)) {
      return FadeTransition(opacity: animation, child: child);
    }
    final enter = CurvedAnimation(parent: animation, curve: DoqMotion.easeOut, reverseCurve: Curves.easeIn);
    final under = CurvedAnimation(parent: secondaryAnimation, curve: DoqMotion.easeOut);
    return FadeTransition(
      opacity: Tween<double>(begin: 1, end: 0.6).animate(under),
      child: ScaleTransition(
        scale: Tween<double>(begin: 1, end: 0.97).animate(under),
        child: FadeTransition(
          opacity: enter,
          child: SlideTransition(
            position: Tween<Offset>(begin: const Offset(0, 0.06), end: Offset.zero).animate(enter),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Fades and lifts its child into place once, the first time it is built.
class Reveal extends StatefulWidget {
  const Reveal({super.key, required this.child, this.delay = Duration.zero, this.offset = 24, this.enabled = true});

  final Widget child;
  final Duration delay;
  final double offset;
  final bool enabled;

  @override
  State<Reveal> createState() => _RevealState();
}

class _RevealState extends State<Reveal> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: DoqMotion.reveal);
  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: DoqMotion.easeOut);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    // Content under the launch curtain waits until the curtain starts lifting.
    final wait = widget.delay + LaunchCurtain.remaining();
    if (!widget.enabled || DoqMotion.reduced(context)) {
      _c.value = 1;
    } else if (wait == Duration.zero) {
      _c.forward();
    } else {
      Future<void>.delayed(wait, () {
        if (mounted) _c.forward();
      });
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (context, child) {
        final v = _t.value;
        return Opacity(
          opacity: clamp01(v),
          child: Transform.translate(
            offset: Offset(0, (1 - v) * widget.offset),
            child: Transform.scale(scale: 0.98 + 0.02 * v, child: child),
          ),
        );
      },
    );
  }
}

/// Press feedback: the child shrinks a little while a finger is on it.
/// Works around any InkWell/GestureDetector without stealing the tap.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.scale = 0.97});

  final Widget child;
  final double scale;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: DoqMotion.press,
        curve: DoqMotion.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// Grey placeholder with a light sweep, used while the first page loads.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.width, this.height, this.radius = 12});

  final double? width;
  final double? height;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (DoqMotion.reduced(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final x = -1.5 + 3 * _c.value;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment(x - 1, 0),
              end: Alignment(x + 1, 0),
              colors: const [DoqColors.surface2, DoqColors.surface3, DoqColors.surface2],
            ),
          ),
        );
      },
    );
  }
}

/// Skeleton shaped like a dish card (grid) or a kitchen row (list).
class CardSkeleton extends StatelessWidget {
  const CardSkeleton({super.key, this.grid = true});

  final bool grid;

  @override
  Widget build(BuildContext context) {
    if (!grid) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(12),
          child: Row(children: [
            Skeleton(width: 82, height: 82, radius: 14),
            SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Skeleton(height: 16, width: 140),
                SizedBox(height: 8),
                Skeleton(height: 12, width: 200),
                SizedBox(height: 10),
                Skeleton(height: 18, width: 90, radius: 99),
              ]),
            ),
          ]),
        ),
      );
    }
    return const Card(
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        AspectRatio(aspectRatio: 4 / 3, child: Skeleton(radius: 0)),
        Padding(
          padding: EdgeInsets.fromLTRB(10, 10, 10, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Skeleton(height: 14, width: 110),
            SizedBox(height: 8),
            Skeleton(height: 11, width: 70),
            SizedBox(height: 14),
            Skeleton(height: 14, width: 60),
          ]),
        ),
      ]),
    );
  }
}

/// Three dots that hop in turn, in the DOQ colors. Replaces the plain spinner.
class DoqLoader extends StatefulWidget {
  const DoqLoader({super.key, this.size = 11});

  final double size;

  @override
  State<DoqLoader> createState() => _DoqLoaderState();
}

class _DoqLoaderState extends State<DoqLoader> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (DoqMotion.reduced(context)) {
      _c.value = 0.5;
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const colors = [DoqColors.primary, DoqColors.secondary, DoqColors.primaryDark];
    return Semantics(
      label: 'جاري التحميل',
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) => Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (i) {
            final phase = (_c.value - i * 0.15) % 1.0;
            final lift = clamp01(math.sin(phase * math.pi));
            return Padding(
              padding: EdgeInsets.symmetric(horizontal: widget.size * 0.3),
              child: Transform.translate(
                offset: Offset(0, -lift * widget.size * 0.9),
                child: Container(
                  width: widget.size,
                  height: widget.size,
                  decoration: BoxDecoration(color: colors[i], shape: BoxShape.circle),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

/// Full-area loading state.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) => const Center(child: DoqLoader());
}

/// A dot with a soft ring that breathes: "this is live right now".
class PulseDot extends StatefulWidget {
  const PulseDot({super.key, this.color = DoqColors.secondary, this.size = 10});

  final Color color;
  final double size;

  @override
  State<PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<PulseDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (DoqMotion.reduced(context)) {
      _c.value = 0;
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.size;
    return SizedBox(
      width: s * 2.6,
      height: s * 2.6,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = Curves.easeOut.transform(_c.value);
          return Stack(alignment: Alignment.center, children: [
            Container(
              width: s + s * 1.6 * t,
              height: s + s * 1.6 * t,
              decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color.withValues(alpha: 0.35 * (1 - t))),
            ),
            Container(width: s, height: s, decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color)),
          ]);
        },
      ),
    );
  }
}

/// Order lifecycle as a short road: the scooter rides to the current step
/// (pending -> chef_accepted -> accepted -> out_for_delivery -> completed).
class OrderRoad extends StatelessWidget {
  const OrderRoad({super.key, required this.status, this.height = 34});

  final String status;
  final double height;

  static const steps = ['pending', 'chef_accepted', 'accepted', 'out_for_delivery', 'completed'];

  static double progressOf(String status) {
    final i = steps.indexOf(status);
    if (i < 0) return 0;
    return i / (steps.length - 1);
  }

  @override
  Widget build(BuildContext context) {
    final target = progressOf(status);
    final reduced = DoqMotion.reduced(context);
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: target),
      duration: reduced ? Duration.zero : const Duration(milliseconds: 1100),
      curve: DoqMotion.easeInOut,
      builder: (context, p, _) => LayoutBuilder(builder: (context, box) {
        final w = box.maxWidth;
        const dot = 26.0;
        final trackW = w - dot;
        final rtl = Directionality.of(context) == TextDirection.rtl;
        final x = dot / 2 + trackW * p;
        return SizedBox(
          height: height,
          child: Stack(clipBehavior: Clip.none, alignment: Alignment.centerLeft, children: [
            // road
            Positioned(
              left: dot / 2,
              right: dot / 2,
              child: Container(height: 6, decoration: BoxDecoration(color: DoqColors.ink.withValues(alpha: 0.85), borderRadius: BorderRadius.circular(99))),
            ),
            // travelled part
            Positioned(
              left: rtl ? w - x : dot / 2,
              right: rtl ? dot / 2 : w - x,
              child: Container(height: 6, decoration: BoxDecoration(color: DoqColors.secondary, borderRadius: BorderRadius.circular(99))),
            ),
            // stops
            for (var i = 0; i < steps.length; i++)
              Positioned(
                left: (rtl ? (1 - i / (steps.length - 1)) : i / (steps.length - 1)) * trackW + dot / 2 - 4,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i / (steps.length - 1) <= p + 0.001 ? Colors.white : DoqColors.line,
                    border: Border.all(color: DoqColors.ink.withValues(alpha: 0.85), width: 1.5),
                  ),
                ),
              ),
            // scooter
            Positioned(
              left: (rtl ? w - x : x) - dot / 2,
              child: Container(
                width: dot,
                height: dot,
                decoration: BoxDecoration(
                  color: DoqColors.secondary,
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: DoqColors.secondary.withValues(alpha: 0.35), blurRadius: 10, spreadRadius: 2)],
                ),
                child: Transform.flip(flipX: rtl, child: const Icon(Icons.delivery_dining_rounded, size: 17, color: Colors.white)),
              ),
            ),
          ]),
        );
      }),
    );
  }
}

/// Plays a short wiggle each time [trigger] grows (new notification on the bell).
class Wiggle extends StatefulWidget {
  const Wiggle({super.key, required this.trigger, required this.child});

  final int trigger;
  final Widget child;

  @override
  State<Wiggle> createState() => _WiggleState();
}

class _WiggleState extends State<Wiggle> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 650));

  @override
  void didUpdateWidget(covariant Wiggle oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.trigger > oldWidget.trigger && !DoqMotion.reduced(context)) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final t = _c.value;
        final angle = math.sin(t * math.pi * 6) * (1 - t) * 0.35;
        return Transform.rotate(angle: angle, alignment: Alignment.topCenter, child: child);
      },
    );
  }
}

/// App-wide scrolling: soft bounce at the edges on every platform.
class DoqScrollBehavior extends MaterialScrollBehavior {
  const DoqScrollBehavior();

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) => const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());
}

/// Opening animation: the DOQ logo pops in on the brand color, then the curtain lifts
/// and reveals the app (like the website intro). Shown once per app launch.
class LaunchCurtain extends StatefulWidget {
  const LaunchCurtain({super.key, required this.child});

  final Widget child;

  static DateTime? _liftAt;

  /// Time left before the curtain starts lifting (zero once the app is visible).
  static Duration remaining() {
    final at = _liftAt;
    if (at == null) return Duration.zero;
    final left = at.difference(DateTime.now());
    return left.isNegative ? Duration.zero : left;
  }

  @override
  State<LaunchCurtain> createState() => _LaunchCurtainState();
}

class _LaunchCurtainState extends State<LaunchCurtain> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500));
  bool _done = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.isAnimating || _done) return;
    if (DoqMotion.reduced(context)) {
      _done = true;
      return;
    }
    LaunchCurtain._liftAt = DateTime.now().add(_c.duration! * 0.6);
    _c.forward().whenComplete(() {
      if (mounted) setState(() => _done = true);
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_done) return widget.child;
    return Stack(fit: StackFit.expand, children: [
      widget.child,
      AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = _c.value;
          // 0.00-0.45 logo in, 0.45-0.60 hold, 0.60-1.00 curtain lifts
          final logo = DoqMotion.easeOut.transform(clamp01(t / 0.45));
          final lift = DoqMotion.easeInOut.transform(clamp01((t - 0.6) / 0.4));
          final h = MediaQuery.sizeOf(context).height;
          return IgnorePointer(
            ignoring: lift > 0.5,
            child: Transform.translate(
              offset: Offset(0, -h * lift),
              child: Material(
                color: const Color(0xFF1A0F0D),
                child: Center(
                  child: Opacity(
                  opacity: logo,
                  child: Transform.scale(
                    scale: 0.85 + 0.15 * logo,
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      ClipRRect(borderRadius: BorderRadius.circular(26), child: Image.asset('assets/images/logo.png', width: 96, height: 96)),
                      const SizedBox(height: 16),
                      const Text('دوق', style: TextStyle(color: Colors.white, fontSize: 44, fontWeight: FontWeight.w900, decoration: TextDecoration.none)),
                      const SizedBox(height: 2),
                      const Text('من مطبخ البيت لحد بابك', style: TextStyle(color: DoqColors.secondary, fontSize: 14, fontWeight: FontWeight.w700, decoration: TextDecoration.none)),
                    ]),
                  ),
                ),
                ),
              ),
            ),
          );
        },
      ),
    ]);
  }
}

/// Delay for the n-th item of a freshly loaded batch (30-80 ms stagger, capped).
Duration staggerDelay(int indexInBatch, {int stepMs = 55, int max = 8}) =>
    Duration(milliseconds: stepMs * math.min(math.max(indexInBatch, 0), max));

/// Brand gradient that drifts slowly, so the home header never looks frozen.
class LiveGradient extends StatefulWidget {
  const LiveGradient({super.key, required this.colors, required this.child, this.radius = 22, this.padding, this.margin});

  final List<Color> colors;
  final Widget child;
  final double radius;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  @override
  State<LiveGradient> createState() => _LiveGradientState();
}

class _LiveGradientState extends State<LiveGradient> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 9));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (DoqMotion.reduced(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_c.value);
        return Container(
          margin: widget.margin,
          padding: widget.padding,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment(1 - t * 0.9, -1),
              end: Alignment(-1 + t * 0.9, 1),
              colors: widget.colors,
            ),
          ),
          child: child,
        );
      },
    );
  }
}
