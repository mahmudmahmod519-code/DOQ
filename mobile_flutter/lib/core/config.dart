/// Where the DOQ app finds its backend.
///
/// Set [kProductionServerUrl] once to your live HTTPS address (the domain behind Cloudflare),
/// for example 'https://doq.example.org'. Then every build talks to that server and
/// customers never see a "server address" setting.
///
/// A build can still override it without editing code:
///   flutter build apk --dart-define=DOQ_API_URL=https://doq.example.org
/// (the GitHub workflows pass the repository variable DOQ_API_URL this way).
const String kProductionServerUrl = '';

// The workflows always pass --dart-define=DOQ_API_URL (empty when the GitHub variable is not set),
// so an empty value must fall back to the address written above.
const String _buildServerUrl = String.fromEnvironment('DOQ_API_URL');

/// The address used by this build: --dart-define when given, otherwise [kProductionServerUrl].
const String kServerUrl = _buildServerUrl == '' ? kProductionServerUrl : _buildServerUrl;

/// Lock the app to [kServerUrl] (hide the server setting): automatic once [kProductionServerUrl]
/// is set; --dart-define=DOQ_LOCK_SERVER=true forces it for any build.
const bool kLockServer = bool.fromEnvironment('DOQ_LOCK_SERVER') || kProductionServerUrl != '';
