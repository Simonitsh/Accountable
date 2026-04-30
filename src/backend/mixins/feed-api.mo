import Map "mo:core/Map";
import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import FeedTypes "../types/feed";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";
import AuthTypes "../types/auth";
import ConnectionTypes "../types/connections";
import FeedLib "../lib/feed";
import ConnectionLib "../lib/connections";

mixin (
  checkIns : List.List<CheckInTypes.CheckIn>,
  goals : List.List<GoalTypes.Goal>,
  profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
  connections : List.List<ConnectionTypes.Connection>,
  interactions : List.List<FeedTypes.Interaction>,
  nextInteractionId : [var Nat],
) {
  public shared query ({ caller }) func getPartnerFeed() : async [FeedTypes.FeedItem] {
    let partnerIds = ConnectionLib.getAcceptedPartnerIds(connections, caller);
    FeedLib.getPartnerFeed(checkIns, goals, profiles, interactions, partnerIds);
  };

  public shared ({ caller }) func recordInteraction(checkInId : Common.CheckInId, interactionType : Common.InteractionType) : async FeedTypes.Interaction {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot record interactions");
    let id = nextInteractionId[0];
    nextInteractionId[0] += 1;
    FeedLib.recordInteraction(interactions, checkIns, id, caller, checkInId, interactionType);
  };

  public shared query ({ caller }) func getInteractionCount(checkInId : Common.CheckInId) : async Nat {
    FeedLib.getInteractionCount(interactions, checkInId);
  };
};
