import List "mo:core/List";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Map "mo:core/Map";
import Common "../types/common";
import FeedTypes "../types/feed";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";
import AuthTypes "../types/auth";

module {
  public func getInteractionCount(
    interactions : List.List<FeedTypes.Interaction>,
    checkInId : Common.CheckInId,
  ) : Nat {
    interactions.values().filter(func(i) { i.checkInId == checkInId }).size();
  };

  /// Resolve the avatar color mode to surface for a feed item's partner.
  /// Returns the partner's selected `AvatarColorMode`, defaulting to `#Fill`
  /// when the partner has no profile.
  public func getPartnerAvatarColorMode(
    partnerProfile : ?AuthTypes.UserProfile,
  ) : AuthTypes.AvatarColorMode {
    switch (partnerProfile) {
      case (?p) p.avatarColorMode;
      case null #Fill;
    };
  };

  public func getPartnerFeed(
    checkIns : List.List<CheckInTypes.CheckIn>,
    goals : List.List<GoalTypes.Goal>,
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    interactions : List.List<FeedTypes.Interaction>,
    partnerIds : [Common.UserId],
  ) : [FeedTypes.FeedItem] {
    checkIns.values().filter(func(c) {
      partnerIds.find(func(p) { p == c.owner }) != null
    }).map(func(c) {
      let goalName = switch (goals.find(func(g) { g.id == c.goalId })) {
        case (?g) g.wish;
        case null "";
      };
      let partnerProfile = profiles.get(c.owner);
      let partnerDisplayName = switch (partnerProfile) {
        case (?p) p.username;
        case null c.owner.toText();
      };
      let partnerAvatarShape : AuthTypes.AvatarShape = switch (partnerProfile) {
        case (?p) p.avatarShape;
        case null null;
      };
      let partnerAvatarColor : AuthTypes.AvatarColor = switch (partnerProfile) {
        case (?p) p.avatarColor;
        case null null;
      };
      let partnerAvatarColorMode = getPartnerAvatarColorMode(partnerProfile);
      let highFiveCount = getInteractionCount(interactions, c.id);
      { checkIn = c; goalName; partnerDisplayName; partnerAvatarShape; partnerAvatarColor; partnerAvatarColorMode; highFiveCount };
    }).toArray();
  };

  public func recordInteraction(
    interactions : List.List<FeedTypes.Interaction>,
    checkIns : List.List<CheckInTypes.CheckIn>,
    nextId : Nat,
    caller : Common.UserId,
    checkInId : Common.CheckInId,
    interactionType : Common.InteractionType,
  ) : FeedTypes.Interaction {
    // Verify check-in exists
    switch (checkIns.find(func(c) { c.id == checkInId })) {
      case null Runtime.trap("Check-in not found");
      case (?_) {};
    };
    // Prevent duplicate interaction from same user on same check-in
    switch (interactions.find(func(i) {
      i.checkInId == checkInId and i.fromPrincipal == caller and i.interactionType == interactionType
    })) {
      case (?_) Runtime.trap("Already interacted");
      case null {};
    };
    let interaction : FeedTypes.Interaction = {
      id = nextId;
      checkInId = checkInId;
      fromPrincipal = caller;
      interactionType = interactionType;
      timestamp = Time.now();
    };
    interactions.add(interaction);
    interaction;
  };
};
