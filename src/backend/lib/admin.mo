import Principal "mo:core/Principal";

/// ─────────────────────────────────────────────────────────────────────────────
/// ADMIN PRINCIPAL CONFIGURATION
/// ─────────────────────────────────────────────────────────────────────────────
/// This module is the SINGLE source of truth for which Principals are granted
/// the `#admin` role. The list below is checked on every registration AND on
/// every sign-in (see `AuthLib.ensureAdminRole`), so adding a Principal here
/// promotes that user on their next login — no migration required.
///
/// HOW TO OBTAIN YOUR PRINCIPAL
///   1. Sign in to the app (draft or live).
///   2. Open your profile page in the app.
///   3. Copy the Principal string shown there (it looks like
///      "abcde-aa123-...-cai" — a dash-separated base32 text).
///
/// DRAFT vs LIVE — DIFFERENT CANISTER IDs, DIFFERENT PRINCIPALS
///   Draft and live run as SEPARATE canisters with DIFFERENT canister IDs, so
///   the SAME user has a DIFFERENT Principal in draft and in live. You MUST
///   add BOTH your draft Principal AND your live Principal to the list below
///   so admin promotion works in both environments.
///
/// THE EXACT EDIT TO MAKE
///   Replace the placeholder entry below with one line per Principal:
///       Principal.fromText("YOUR-PRINCIPAL-TEXT-HERE"),
///   Multiple entries are supported — keep one per environment (and per
///   additional admin) so they coexist. Leave the list empty (`[]`) to disable
///   admin promotion entirely.
/// ─────────────────────────────────────────────────────────────────────────────
module AdminConfig {
  /// Hardcoded list of admin Principals. Starts with a clearly-marked
  /// placeholder — replace it with your real draft and live Principals.
  /// To disable admin promotion, set this to `[]`.
  ///
  /// NOTE: This list is built inside `isAdminPrincipal` (not as a module-level
  /// `let`) because `Principal.fromText(...)` is a function call, which is a
  /// non-static expression and cannot appear in a module `let` initializer
  /// (compile error M0014).
  func adminPrincipals() : [Principal] {
    [
      Principal.fromText("osgyc-jamdg-lh4nm-2slhg-75ol2-t5r33-cv7pg-wi3jf-laa4i-755u4-sae"),
      // PLACEHOLDER — replace with your real Principal(s):
      //   Principal.fromText("YOUR-DRAFT-PRINCIPAL-TEXT-HERE"),
      //   Principal.fromText("YOUR-LIVE-PRINCIPAL-TEXT-HERE"),
    ];
  };

  /// Returns true iff `p` is in the hardcoded admin list above.
  public func isAdminPrincipal(p : Principal) : Bool {
    for (admin in adminPrincipals().vals()) {
      if (admin == p) { return true };
    };
    false;
  };
};
