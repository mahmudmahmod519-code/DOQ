/// Formatting helpers (Arabic UI).
String money(dynamic value) {
  final n = value is num ? value : num.tryParse('${value ?? ''}') ?? 0;
  final text = n == n.roundToDouble() ? n.toStringAsFixed(0) : n.toStringAsFixed(2);
  return '$text ج.م';
}

DateTime? parseDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse('$value')?.toLocal();
}

String timeAgo(dynamic value, {DateTime? now}) {
  final date = parseDate(value);
  if (date == null) return '';
  final diff = (now ?? DateTime.now()).difference(date);
  if (diff.inSeconds < 60) return 'دلوقتي';
  if (diff.inMinutes < 60) return 'من ${diff.inMinutes} دقيقة';
  if (diff.inHours < 24) return 'من ${diff.inHours} ساعة';
  if (diff.inDays < 7) return 'من ${diff.inDays} يوم';
  return '${date.day}/${date.month}/${date.year}';
}

String fullDate(dynamic value) {
  final d = parseDate(value);
  if (d == null) return '';
  final hour = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final minute = d.minute.toString().padLeft(2, '0');
  final period = d.hour < 12 ? 'ص' : 'م';
  return '${d.day}/${d.month} - $hour:$minute $period';
}

const orderStatusLabels = <String, String>{
  'pending': 'في انتظار المطبخ',
  'chef_accepted': 'المطبخ بيجهز طلبك',
  'accepted': 'المندوب في الطريق للمطبخ',
  'out_for_delivery': 'طلبك مع المندوب',
  'completed': 'اتسلم',
  'cancelled': 'اتلغى',
};

String statusLabel(String status) => orderStatusLabels[status] ?? status;

final _egyptPhone = RegExp(r'^(010|011|012|015)\d{8}$');
bool isEgyptPhone(String value) => _egyptPhone.hasMatch(value.trim());

final _strongPassword = RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$');
bool isStrongPassword(String value) => _strongPassword.hasMatch(value);
