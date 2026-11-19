import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Error returned by the DOQ server (or a network failure when [status] is 0).
class ApiException implements Exception {
  ApiException(this.status, this.message);

  final int status;
  final String message;

  bool get unauthorized => status == 401;

  @override
  String toString() => message;
}

/// One page of a cursor-paginated list: `{ items, next_cursor, has_more }`.
class ApiPage {
  ApiPage(this.items, this.nextCursor, this.hasMore);

  final List<Map<String, dynamic>> items;
  final String? nextCursor;
  final bool hasMore;
}

/// HTTP client for the DOQ backend.
///
/// The backend authenticates with an httpOnly `session_token` cookie and protects
/// state-changing requests with a CSRF token bound to the `doq_csrf_seed` cookie.
/// This client keeps those cookies itself (persisted on the device) and fetches the
/// CSRF token from `/security/csrf` before POST / PUT / PATCH / DELETE.
class Api {
  Api._();

  static final Api instance = Api._();

  static const _cookieNames = ['session_token', 'doq_csrf_seed', 'pending_token'];
  static const _timeout = Duration(seconds: 20);

  final http.Client _client = http.Client();
  final Map<String, String> _cookies = {};
  late SharedPreferences _prefs;
  String baseUrl = '';
  String? _csrf;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    const fromBuild = String.fromEnvironment('DOQ_API_URL');
    baseUrl = normalize(_prefs.getString('server_url') ?? fromBuild);
    final saved = _prefs.getString('cookies');
    if (saved != null) {
      try {
        final decoded = jsonDecode(saved);
        if (decoded is Map) {
          decoded.forEach((key, value) => _cookies['$key'] = '$value');
        }
      } catch (_) {}
    }
  }

  static String normalize(String url) {
    var u = url.trim();
    while (u.endsWith('/')) {
      u = u.substring(0, u.length - 1);
    }
    if (u.isNotEmpty && !u.startsWith('http://') && !u.startsWith('https://')) {
      u = 'http://$u';
    }
    return u;
  }

  bool get hasServer => baseUrl.isNotEmpty;

  bool get hasSession => (_cookies['session_token'] ?? '').isNotEmpty;

  Future<void> setServer(String url) async {
    baseUrl = normalize(url);
    await _prefs.setString('server_url', baseUrl);
    await clearSession();
  }

  Future<void> clearSession() async {
    _cookies.clear();
    _csrf = null;
    await _saveCookies();
  }

  /// Turns `/uploads/x.jpg` into an absolute URL on the configured server.
  String imageUrl(dynamic path) {
    final p = (path ?? '').toString();
    if (p.isEmpty) return '';
    if (p.startsWith('http://') || p.startsWith('https://')) return p;
    return '$baseUrl${p.startsWith('/') ? '' : '/'}$p';
  }

  Future<void> _saveCookies() async {
    await _prefs.setString('cookies', jsonEncode(_cookies));
  }

  String _cookieHeader() => _cookies.entries.map((e) => '${e.key}=${e.value}').join('; ');

  /// Reads `Set-Cookie` (the http package joins several headers with commas).
  Future<void> _capture(http.BaseResponse response) async {
    final raw = response.headers['set-cookie'];
    if (raw == null || raw.isEmpty) return;
    var changed = false;
    for (final name in _cookieNames) {
      final match = RegExp('(?:^|[,;\\s])$name=([^;,]*)').firstMatch(raw);
      if (match == null) continue;
      final value = match.group(1) ?? '';
      if (value.isEmpty) {
        _cookies.remove(name);
      } else {
        _cookies[name] = value;
      }
      if (name == 'session_token') _csrf = null; // CSRF token is bound to the session
      changed = true;
    }
    if (changed) await _saveCookies();
  }

  Map<String, dynamic> _decode(http.Response response) {
    try {
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (body is Map<String, dynamic>) return body;
      if (body is Map) return Map<String, dynamic>.from(body);
    } catch (_) {}
    return <String, dynamic>{};
  }

  Future<String> _csrfToken() async {
    final cached = _csrf;
    if (cached != null) return cached;
    final response = await _raw('GET', Uri.parse('$baseUrl/security/csrf'), null, const {});
    final token = _decode(response)['token']?.toString() ?? '';
    _csrf = token;
    return token;
  }

  Future<http.Response> _raw(String method, Uri uri, Object? body, Map<String, String> extra) async {
    final request = http.Request(method, uri);
    request.headers['Accept'] = 'application/json';
    request.headers['X-Client'] = 'doq-flutter';
    if (body != null) {
      request.headers['Content-Type'] = 'application/json; charset=utf-8';
      request.body = jsonEncode(body);
    }
    if (_cookies.isNotEmpty) request.headers['Cookie'] = _cookieHeader();
    request.headers.addAll(extra);
    try {
      final streamed = await _client.send(request).timeout(_timeout);
      final response = await http.Response.fromStream(streamed).timeout(_timeout);
      await _capture(response);
      return response;
    } on TimeoutException {
      throw ApiException(0, 'السيرفر مش بيرد. اتأكد من الإنترنت وجرب تاني');
    } catch (_) {
      throw ApiException(0, 'تعذر الاتصال بالسيرفر. اتأكد من الإنترنت وعنوان السيرفر');
    }
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? query,
    Object? body,
    Map<String, String>? headers,
    bool retried = false,
  }) async {
    if (!hasServer) throw ApiException(0, 'حدد عنوان السيرفر الأول');
    var uri = Uri.parse('$baseUrl$path');
    if (query != null) {
      final q = <String, String>{...uri.queryParameters};
      query.forEach((key, value) {
        if (value != null && '$value'.isNotEmpty) q[key] = '$value';
      });
      uri = uri.replace(queryParameters: q.isEmpty ? null : q);
    }
    final extra = <String, String>{...?headers};
    if (method != 'GET') extra['x-csrf-token'] = await _csrfToken();

    final response = await _raw(method, uri, body, extra);
    final data = _decode(response);

    if (response.statusCode == 403 && data['code'] == 'CSRF_INVALID' && !retried) {
      _csrf = null;
      return _send(method, path, query: query, body: body, headers: headers, retried: true);
    }
    if (response.statusCode >= 400) {
      throw ApiException(response.statusCode, (data['message'] ?? 'حصل خطأ. حاول تاني').toString());
    }
    return data;
  }

  Future<Map<String, dynamic>> get(String path, [Map<String, dynamic>? query]) => _send('GET', path, query: query);

  Future<Map<String, dynamic>> post(String path, [Object? body, Map<String, String>? headers]) =>
      _send('POST', path, body: body ?? <String, dynamic>{}, headers: headers);

  Future<Map<String, dynamic>> put(String path, [Object? body]) => _send('PUT', path, body: body ?? <String, dynamic>{});

  Future<Map<String, dynamic>> patch(String path, [Object? body]) => _send('PATCH', path, body: body ?? <String, dynamic>{});

  Future<Map<String, dynamic>> delete(String path) => _send('DELETE', path, body: <String, dynamic>{});

  /// GET a cursor-paginated list from the mobile API.
  Future<ApiPage> page(String path, String? cursor, [Map<String, dynamic>? query]) async {
    final res = await get(path, {...?query, 'cursor': cursor});
    final data = asMap(res['data']);
    final items = asList(data['items']).map(asMap).toList();
    final next = data['next_cursor'];
    return ApiPage(items, next == null ? null : '$next', data['has_more'] == true);
  }
}

Map<String, dynamic> asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return <String, dynamic>{};
}

List<dynamic> asList(dynamic value) => value is List ? value : const [];

num asNum(dynamic value) {
  if (value is num) return value;
  return num.tryParse('${value ?? ''}') ?? 0;
}

int asInt(dynamic value) => asNum(value).toInt();

String asStr(dynamic value) => value == null ? '' : '$value';
