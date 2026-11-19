import 'package:doq_customer/core/api.dart';
import 'package:doq_customer/core/format.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('money formats whole and fractional prices', () {
    expect(money(45), '45 ج.م');
    expect(money('45.50'), '45.50 ج.م');
    expect(money(null), '0 ج.م');
  });

  test('server url is normalised', () {
    expect(Api.normalize('192.168.1.10:8080/'), 'http://192.168.1.10:8080');
    expect(Api.normalize(' https://doq.example.com// '), 'https://doq.example.com');
  });

  test('egyptian phone and strong password rules match the backend', () {
    expect(isEgyptPhone('01012345678'), isTrue);
    expect(isEgyptPhone('0101234567'), isFalse);
    expect(isStrongPassword('TestAccount123!'), isTrue);
    expect(isStrongPassword('weakpass'), isFalse);
  });

  test('order status labels', () {
    expect(statusLabel('out_for_delivery'), 'طلبك مع المندوب');
    expect(statusLabel('unknown'), 'unknown');
  });

  test('timeAgo', () {
    final now = DateTime(2026, 1, 1, 12);
    expect(timeAgo(now.subtract(const Duration(minutes: 5)).toIso8601String(), now: now), 'من 5 دقيقة');
  });
}
