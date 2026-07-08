import Common "common";
import CheckIns "checkins";
import Auth "auth";

module {
  public type FeedItem = {
    checkIn : CheckIns.CheckIn;
    goalName : Text;
    partnerDisplayName : Text;
    partnerAvatarShape : Auth.AvatarShape;
    partnerAvatarColor : Auth.AvatarColor;
    partnerAvatarColorMode : Auth.AvatarColorMode;
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
