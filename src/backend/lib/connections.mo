import List "mo:core/List";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import ConnectionTypes "../types/connections";

module {
  public func toPublic(c : ConnectionTypes.Connection) : ConnectionTypes.ConnectionPublic {
    {
      id = c.id;
      fromPrincipal = c.fromPrincipal;
      toPrincipal = c.toPrincipal;
      status = c.status;
      createdAt = c.createdAt;
    };
  };

  public func hasDuplicateActive(
    connections : List.List<ConnectionTypes.Connection>,
    fromPrincipal : Common.UserId,
    toPrincipal : Common.UserId,
  ) : Bool {
    switch (connections.find(func(c) {
      (
        (c.fromPrincipal == fromPrincipal and c.toPrincipal == toPrincipal) or
        (c.fromPrincipal == toPrincipal and c.toPrincipal == fromPrincipal)
      ) and (c.status == #pending or c.status == #accepted)
    })) {
      case (?_) true;
      case null false;
    };
  };

  public func sendRequest(
    connections : List.List<ConnectionTypes.Connection>,
    nextId : Nat,
    caller : Common.UserId,
    target : Common.UserId,
  ) : ConnectionTypes.Connection {
    if (caller == target) Runtime.trap("Cannot connect to yourself");
    if (hasDuplicateActive(connections, caller, target)) {
      Runtime.trap("Connection request already exists or already connected");
    };
    let conn : ConnectionTypes.Connection = {
      id = nextId;
      fromPrincipal = caller;
      toPrincipal = target;
      var status = #pending;
      createdAt = Time.now();
    };
    connections.add(conn);
    conn;
  };

  public func respondToRequest(
    connections : List.List<ConnectionTypes.Connection>,
    connectionId : Common.ConnectionId,
    caller : Common.UserId,
    accept : Bool,
  ) : Bool {
    switch (connections.find(func(c) {
      c.id == connectionId and c.toPrincipal == caller and c.status == #pending
    })) {
      case null false;
      case (?conn) {
        conn.status := if (accept) #accepted else #rejected;
        true;
      };
    };
  };

  public func listAccepted(
    connections : List.List<ConnectionTypes.Connection>,
    caller : Common.UserId,
  ) : [ConnectionTypes.ConnectionPublic] {
    connections.values().filter(func(c) {
      c.status == #accepted and (c.fromPrincipal == caller or c.toPrincipal == caller)
    }).map<ConnectionTypes.Connection, ConnectionTypes.ConnectionPublic>(
      func(c) { toPublic(c) }
    ).toArray();
  };

  public func listPending(
    connections : List.List<ConnectionTypes.Connection>,
    caller : Common.UserId,
  ) : [ConnectionTypes.ConnectionPublic] {
    connections.values().filter(func(c) {
      c.status == #pending and c.toPrincipal == caller
    }).map<ConnectionTypes.Connection, ConnectionTypes.ConnectionPublic>(
      func(c) { toPublic(c) }
    ).toArray();
  };

  public func getAcceptedPartnerIds(
    connections : List.List<ConnectionTypes.Connection>,
    caller : Common.UserId,
  ) : [Common.UserId] {
    connections.values().filter(func(c) {
      c.status == #accepted and (c.fromPrincipal == caller or c.toPrincipal == caller)
    }).map<ConnectionTypes.Connection, Common.UserId>(func(c) {
      if (c.fromPrincipal == caller) c.toPrincipal else c.fromPrincipal
    }).toArray();
  };
};
