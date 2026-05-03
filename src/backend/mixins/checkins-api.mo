import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";
import CheckInLib "../lib/checkins";

mixin (
  checkIns : List.List<CheckInTypes.CheckIn>,
  goals : List.List<GoalTypes.Goal>,
  nextCheckInId : [var Nat],
) {
  public shared ({ caller }) func recordCheckIn(request : CheckInTypes.RecordCheckInRequest) : async CheckInTypes.CheckIn {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot record check-ins");
    let id = nextCheckInId[0];
    nextCheckInId[0] += 1;
    CheckInLib.recordCheckIn(checkIns, goals, id, caller, request);
  };

  public shared query ({ caller }) func listMyCheckIns() : async [CheckInTypes.CheckIn] {
    CheckInLib.listCheckIns(checkIns, caller);
  };

  public shared query ({ caller }) func getCheckInsForGoal(goalId : Common.GoalId) : async [CheckInTypes.CheckIn] {
    CheckInLib.getCheckInsForGoal(checkIns, goalId, caller);
  };
  public shared ({ caller }) func deleteCheckIn(checkInId : Common.CheckInId) : async { #ok; #err : { #notFound; #unauthorized } } {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot delete check-ins");
    CheckInLib.deleteCheckIn(checkIns, checkInId, caller);
  };

  public shared query ({ caller }) func getCheckInsForPeriod(goalId : Common.GoalId, fromTimestamp : Int, toTimestamp : Int) : async [CheckInTypes.CheckIn] {
    CheckInLib.getCheckInsForPeriod(checkIns, goalId, caller, fromTimestamp, toTimestamp);
  };
};
