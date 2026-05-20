import Map "mo:core/Map";
import List "mo:core/List";
import Int "mo:core/Int";
import Common "../types/common";
import AuthTypes "../types/auth";
import GoalTypes "../types/goals";
import EmailNotifications "../lib/email-notifications";
import EmailClient "mo:caffeineai-email/emailClient";

mixin (
  goals : List.List<GoalTypes.Goal>,
  profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
) {
  /// Tracks which (goalId, minute-slot) pairs have already had an email sent.
  /// Key: goalId # "_" # minuteOfDay
  let emailSentLog = Map.empty<Text, Bool>();

  func processEmailReminders() : async () {
    label nextGoal for (goal in goals.values()) {
      // Only process goals with email notifications enabled
      if (not goal.emailNotifications) continue nextGoal;

      // Determine the time string to use as the reminder base
      let timeStr : ?Text = if (goal.isLockIn) { goal.startTime } else { goal.intentTime };

      // For Lock-In habits, only allow negative offsets (before start)
      let reminderOffset : ?Int = switch (goal.reminderOffset) {
        case null null;
        case (?o) {
          if (goal.isLockIn and o > 0) { ?0 } else { ?o }
        };
      };

      // Use tzOffset = 0 (intentTime is already stored in user's local time;
      // we schedule relative to UTC midnight with no additional offset)
      switch (EmailNotifications.calcReminderUtcMinuteOfDay(timeStr, reminderOffset, 0)) {
        case null {};
        case (?targetMinute) {
          if (EmailNotifications.isNow(targetMinute)) {
            // Build a per-goal per-minute-slot dedup key
            let dedupKey = goal.id.toText() # "_" # targetMinute.toText();

            // Only send once per (goal, minute-slot)
            switch (emailSentLog.get(dedupKey)) {
              case (?true) {}; // already sent
              case _ {
                // Look up the owner's email
                switch (profiles.get(goal.owner)) {
                  case null {};
                  case (?profile) {
                    switch (profile.email) {
                      case null {};
                      case (?email) {
                        let habitName = goal.wish;
                        let subject = "Cumulative Reminder: " # habitName;
                        let htmlBody = "<p>This is your scheduled reminder for your habit: <strong>" # habitName # "</strong>.</p><p>Stay consistent!</p>";
                        ignore await EmailClient.sendServiceEmail(
                          "cumulative",
                          [email],
                          subject,
                          htmlBody,
                        );
                        emailSentLog.add(dedupKey, true);
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  };
};
