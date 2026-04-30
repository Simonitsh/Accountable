import Common "common";
import CheckIns "checkins";

module {
  public type FeedItem = {
    checkIn : CheckIns.CheckIn;
    goalName : Text;
    partnerDisplayName : Text;
    highFiveCount : Nat;
  };

  public type Interaction = {
    id : Common.InteractionId;
    checkInId : Common.CheckInId;
    fromPrincipal : Common.UserId;
    interactionType : Common.InteractionType;
    timestamp : Common.Timestamp;
  };
};
