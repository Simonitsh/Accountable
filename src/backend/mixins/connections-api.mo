import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import ConnectionTypes "../types/connections";
import ConnectionLib "../lib/connections";

mixin (
  connections : List.List<ConnectionTypes.Connection>,
  nextConnectionId : [var Nat],
) {
  public shared ({ caller }) func sendConnectionRequest(target : Common.UserId) : async ConnectionTypes.ConnectionPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot send connection requests");
    let id = nextConnectionId[0];
    nextConnectionId[0] += 1;
    let conn = ConnectionLib.sendRequest(connections, id, caller, target);
    ConnectionLib.toPublic(conn);
  };

  public shared ({ caller }) func respondToConnection(connectionId : Common.ConnectionId, accept : Bool) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot respond to connections");
    ConnectionLib.respondToRequest(connections, connectionId, caller, accept);
  };

  public shared query ({ caller }) func listConnections() : async [ConnectionTypes.ConnectionPublic] {
    ConnectionLib.listAccepted(connections, caller);
  };

  public shared query ({ caller }) func listPendingRequests() : async [ConnectionTypes.ConnectionPublic] {
    ConnectionLib.listPending(connections, caller);
  };
};
