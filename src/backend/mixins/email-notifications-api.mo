import List "mo:core/List";
import Int "mo:core/Int";
import Time "mo:core/Time";
import Common "../types/common";
import AuthTypes "../types/auth";
import GoalTypes "../types/goals";
import EmailNotifications "../lib/email-notifications";
import EmailClient "mo:caffeineai-email/emailClient";
import Map "mo:core/Map";
import CheckInTypes "../types/checkins";
import CheckInsLib "../lib/checkins";
import Array "mo:core/Array";

mixin (
  goals : List.List<GoalTypes.Goal>,
  profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
  checkIns : List.List<CheckInTypes.CheckIn>,
  obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>,
) {
  func processEmailReminders() : async () {
    let nowNs : Int = Time.now();
    // One nanosecond day
    let dayNs : Int = 86_400_000_000_000;

    label nextGoal for (goal in goals.values()) {
      // Only process goals with email notifications enabled
      if (not goal.emailNotifications) continue nextGoal;

      // Skip if today is not a scheduled day for this goal (rest day)
      let tzOffsetForDay : Int = switch (profiles.get(goal.owner)) {
        case null 0;
        case (?p) p.timezoneOffsetMinutes;
      };
      let todayAbbr : Text = CheckInsLib.dayOfWeekAbbrPublic(nowNs, tzOffsetForDay);
      if (not CheckInsLib.isScheduledDayPublic(todayAbbr, goal.scheduledDays)) continue nextGoal;

      // Look up the owner's profile for timezone and email
      let (tzOffsetMins, ownerEmail) : (Int, ?Text) = switch (profiles.get(goal.owner)) {
        case null { continue nextGoal };
        case (?profile) { (profile.timezoneOffsetMinutes, profile.email) };
      };

      // Determine the time string to use as the reminder base
      let timeStr : ?Text = if (goal.isLockIn) { goal.startTime } else { goal.intentTime };

      // For Lock-In habits, only allow negative offsets (before start)
      let reminderOffset : ?Int = switch (goal.reminderOffset) {
        case null null;
        case (?o) {
          if (goal.isLockIn and o > 0) { ?0 } else { ?o }
        };
      };

      // ── BUG 2 FIX: Use the user's real timezoneOffsetMinutes ──────────────
      // JS Date.getTimezoneOffset() returns minutes such that:
      //   local_time = UTC - offset_minutes
      // So to convert UTC minute-of-day to local: (utc - tzOffset + 1440) % 1440
      // calcReminderUtcMinuteOfDay expects tzOffsetMins in the same convention
      // (positive = east of UTC, same as -jsOffset). Our stored value IS jsOffset
      // (e.g. UTC+2 → stored as -120), so we negate it for the helper.
      switch (EmailNotifications.calcReminderUtcMinuteOfDay(timeStr, reminderOffset, tzOffsetMins)) {
        case null {};
        case (?targetMinute) {
          if (EmailNotifications.isNow(targetMinute)) {
            // ── BUG 1 FIX: Calendar-day dedup using lastEmailSentAt ──────────
            // Compute the user's local "now" in nanoseconds
            let localNowNs : Int = nowNs + (tzOffsetMins * 60 * 1_000_000_000);
            let lastSentLocalNs : Int = goal.lastEmailSentAt + (tzOffsetMins * 60 * 1_000_000_000);
            let lastSentLocalDay : Int = lastSentLocalNs / dayNs;
            let todayLocalDay : Int = localNowNs / dayNs;

            // Skip if we already sent an email for this goal today (local calendar day)
            if (goal.lastEmailSentAt > 0 and lastSentLocalDay == todayLocalDay) {
              continue nextGoal;
            };

            // ── TERMINAL CHECK-IN GUARD ────────────────────────────────────
            // If the user has already completed or skipped this habit today,
            // do not send a reminder. #inProgress is NOT terminal — the user
            // is mid-session and may still need a Lock-In checkout reminder.
            let localMidnightNs : Int = localNowNs - (localNowNs % dayNs);
            let todayMidnightUtcNs : Int = localMidnightNs - (tzOffsetMins * 60 * 1_000_000_000);
            let todayCheckIns = CheckInsLib.getCheckInsForPeriod(
              checkIns,
              goal.id,
              goal.owner,
              todayMidnightUtcNs,
              nowNs,
            );
            let hasTerminalCheckIn = todayCheckIns.find<CheckInTypes.CheckIn>(func(c : CheckInTypes.CheckIn) {
              c.checkInType == #success or
              c.checkInType == #skip or
              c.checkInType == #missedCheckIn or
              c.checkInType == #missedCheckOut
            }) != null;
            if (hasTerminalCheckIn) continue nextGoal;

            // Send the email
            switch ownerEmail {
              case null {};
              case (?email) {
                let habitAction = goal.wish;

                // Resolve display name: prefer displayName, then username, then "there"
                let displayName : Text = switch (profiles.get(goal.owner)) {
                  case null { "there" };
                  case (?p) {
                    if (p.displayName != "") { p.displayName }
                    else if (p.username != "") { p.username }
                    else { "there" }
                  };
                };

                // Resolve obstacle text from template
                let obstacleText : Text = switch (goal.obstacleTemplateId) {
                  case null { "an obstacle" };
                  case (?oid) {
                    var obstacleTitle : Text = "an obstacle";
                    label obstacleLoop for (t in obstacleTemplates.values()) {
                      if (t.id == oid and t.owner == goal.owner) {
                        obstacleTitle := t.title;
                        break obstacleLoop;
                      };
                    };
                    obstacleTitle
                  };
                };

                // App URL for CTA button
                let appUrl = "https://cumulative.icp0.io";

                let (subject, htmlBody) = if (goal.isLockIn) {
                  // ── LOCK-IN TEMPLATE (Premium Gold) ──────────────────────
                  // Calculate duration from startTime and endTime
                  let durationText : Text = switch (goal.startTime, goal.endTime) {
                    case (?st, ?et) {
                      switch (EmailNotifications.parseMinutes(st), EmailNotifications.parseMinutes(et)) {
                        case (?startMins, ?endMins) {
                          let totalMins : Int = endMins - startMins;
                          let hrs : Int = totalMins / 60;
                          let mins : Int = totalMins % 60;
                          if (hrs > 0 and mins > 0) {
                            hrs.toText() # " hour" # (if (hrs == 1) "" else "s") # " " # mins.toText() # " minute" # (if (mins == 1) "" else "s")
                          } else if (hrs > 0) {
                            hrs.toText() # " hour" # (if (hrs == 1) "" else "s")
                          } else {
                            mins.toText() # " minute" # (if (mins == 1) "" else "s")
                          }
                        };
                        case _ { "your scheduled duration" };
                      }
                    };
                    case _ { "your scheduled duration" };
                  };
                  let startTimeText : Text = switch (goal.startTime) {
                    case (?t) { t };
                    case null { "your scheduled time" };
                  };
                  let lockInSubject = "Lock-In Starting Soon: " # habitAction;
                  let lockInBody = "<!DOCTYPE html><html><body style=\"background-color: #0A0A0A; margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\"><div style=\"max-width: 500px; margin: 0 auto; background-color: #141414; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 10px 10px 20px rgba(0,0,0,0.5), -4px -4px 10px rgba(255,255,255,0.02);\"><div style=\"margin-bottom: 20px; text-align: center;\"><span style=\"font-size: 32px;\">&#x1F512;</span></div><h1 style=\"color: #ffffff; font-size: 22px; margin-bottom: 24px; text-align: center; font-weight: 600;\">Lock-In Starting Soon: <span style=\"color: #D4AF37;\">" # habitAction # "</span></h1><p style=\"font-size: 16px; line-height: 1.6; color: #e2e8f0; margin-bottom: 24px;\">Hey <strong>" # displayName # "</strong>,<br><br>Your strict Lock-In window is approaching. You committed to <strong>" # habitAction # "</strong> for " # durationText # ".</p><div style=\"background-color: #0A0A0A; border-left: 4px solid #D4AF37; padding: 16px; border-radius: 6px; margin-bottom: 24px; border-top: 1px solid rgba(255,255,255,0.02); border-right: 1px solid rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.02);\"><p style=\"margin: 0; font-size: 15px; color: #a1a1aa; font-family: monospace;\"><strong style=\"color: #e2e8f0; font-family: sans-serif;\">Starts exactly at:</strong> " # startTimeText # "</p></div><p style=\"font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 32px;\">This is a strict time block. Remember your plan: If <strong>" # obstacleText # "</strong> happens, then you will <strong>" # goal.ifThenPlan # "</strong>.</p><div style=\"text-align: center;\"><a href=\"" # appUrl # "\" style=\"display: inline-block; background-color: #D4AF37; color: #000000; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(212, 175, 55, 0.3);\">Prepare to Lock In</a></div><div style=\"margin-top: 40px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px;\"><p style=\"font-size: 12px; color: #52525b; text-transform: uppercase; letter-spacing: 1px;\">Protect your time.</p></div></div></body></html>";
                  (lockInSubject, lockInBody)
                } else {
                  // ── NORMAL HABIT TEMPLATE (Emerald Green) ────────────────
                  let intentTimeText : Text = switch (goal.intentTime) {
                    case (?t) { t };
                    case null { "your planned time" };
                  };
                  let normalSubject = "Action required: " # habitAction;
                  // Normal habits do not have a dedicated duration field; use intent time context
                  let normalDurationText : Text = "your scheduled time";
                let normalBody = "<!DOCTYPE html><html><body style=\"background-color: #0A0A0A; margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\"><div style=\"max-width: 500px; margin: 0 auto; background-color: #141414; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 10px 10px 20px rgba(0,0,0,0.5), -4px -4px 10px rgba(255,255,255,0.02);\"><div style=\"margin-bottom: 20px; text-align: center;\"><span style=\"font-size: 32px;\">&#x23F3;</span></div><h1 style=\"color: #ffffff; font-size: 22px; margin-bottom: 24px; text-align: center; font-weight: 600;\">Action required: <span style=\"color: #10b981;\">" # habitAction # "</span></h1><p style=\"font-size: 16px; line-height: 1.6; color: #e2e8f0; margin-bottom: 24px;\">Hey <strong>" # displayName # "</strong>,<br><br>This is your accountability check. You committed to <strong>" # habitAction # "</strong> for " # normalDurationText # ".</p><div style=\"background-color: #0A0A0A; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 24px; border-top: 1px solid rgba(255,255,255,0.02); border-right: 1px solid rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.02);\"><p style=\"margin: 0; font-size: 15px; color: #a1a1aa; font-family: monospace;\"><strong style=\"color: #e2e8f0; font-family: sans-serif;\">Your Intent Time:</strong> " # intentTimeText # "</p></div><p style=\"font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 32px;\">Remember your plan: If <strong>" # obstacleText # "</strong> happens, then you will <strong>" # goal.ifThenPlan # "</strong>.</p><div style=\"text-align: center;\"><a href=\"" # appUrl # "\" style=\"display: inline-block; background-color: #10b981; color: #000000; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);\">Open App to Log Action</a></div><div style=\"margin-top: 40px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px;\"><p style=\"font-size: 12px; color: #52525b; text-transform: uppercase; letter-spacing: 1px;\">Own your actions.</p></div></div></body></html>";
                  (normalSubject, normalBody)
                };

                // Set the flag BEFORE the async yield so re-entrant heartbeats
                // see the updated value and do not send a duplicate email.
                goal.lastEmailSentAt := Time.now();
                ignore await EmailClient.sendServiceEmail(
                  "cumulative",
                  [email],
                  subject,
                  htmlBody,
                );
              };
            };
          };
        };
      };
    };
  };
};
