import Common "common";

module {
  public type Connection = {
    id : Common.ConnectionId;
    fromPrincipal : Common.UserId;
    toPrincipal : Common.UserId;
    var status : Common.ConnectionStatus;
    createdAt : Common.Timestamp;
  };

  public type ConnectionPublic = {
    id : Common.ConnectionId;
    fromPrincipal : Common.UserId;
    toPrincipal : Common.UserId;
    status : Common.ConnectionStatus;
    createdAt : Common.Timestamp;
  };
};
