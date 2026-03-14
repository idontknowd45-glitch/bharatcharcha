import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import OrderedSet "mo:base/OrderedSet";
import Int "mo:base/Int";

module {
  type OldActor = {
    userProfiles : OrderedMap.Map<Principal, {
      username : Text;
      displayName : Text;
      bio : Text;
      profilePicture : ?Text;
      languagePreference : Text;
      suspended : Bool;
    }>;
    posts : OrderedMap.Map<Nat, {
      id : Nat;
      author : Principal;
      content : Text;
      timestamp : Int;
      hashtags : [Text];
      mediaIds : [Text];
      likes : Nat;
      replies : Nat;
      reposts : Nat;
      originalPostId : ?Nat;
      deleted : Bool;
    }>;
    reports : OrderedMap.Map<Nat, {
      id : Nat;
      reportedBy : Principal;
      postId : Nat;
      reason : Text;
      timestamp : Int;
      status : {
        #pending;
        #reviewed;
        #actioned;
      };
    }>;
    auditLogs : OrderedMap.Map<Nat, {
      id : Nat;
      action : Text;
      performedBy : Principal;
      target : ?Principal;
      postId : ?Nat;
      timestamp : Int;
    }>;
    followers : OrderedMap.Map<Principal, OrderedSet.Set<Principal>>;
    following : OrderedMap.Map<Principal, OrderedSet.Set<Principal>>;
    blockList : OrderedMap.Map<Principal, OrderedSet.Set<Principal>>;
    notifications : OrderedMap.Map<Principal, [ {
      kind : {
        #follow;
        #like;
        #reply;
        #mention;
        #repost;
      };
      from : Principal;
      postId : ?Nat;
      timestamp : Int;
    } ]>;
    timelines : OrderedMap.Map<Principal, [Nat]>;
    hashtagCounts : OrderedMap.Map<Text, Nat>;
    postLikes : OrderedMap.Map<Nat, OrderedSet.Set<Principal>>;
    nextPostId : Nat;
    nextReportId : Nat;
    nextAuditLogId : Nat;
  };

  type NewActor = {
    userProfiles : OrderedMap.Map<Principal, {
      username : Text;
      displayName : Text;
      bio : Text;
      profilePicture : ?Text;
      languagePreference : Text;
      suspended : Bool;
    }>;
    posts : OrderedMap.Map<Nat, {
      id : Nat;
      author : Principal;
      content : Text;
      timestamp : Int;
      hashtags : [Text];
      mediaIds : [Text];
      likes : Nat;
      replies : Nat;
      reposts : Nat;
      originalPostId : ?Nat;
      deleted : Bool;
    }>;
    reports : OrderedMap.Map<Nat, {
      id : Nat;
      reportedBy : Principal;
      postId : Nat;
      reason : Text;
      timestamp : Int;
      status : {
        #pending;
        #reviewed;
        #actioned;
      };
    }>;
    auditLogs : OrderedMap.Map<Nat, {
      id : Nat;
      action : Text;
      performedBy : Principal;
      target : ?Principal;
      postId : ?Nat;
      timestamp : Int;
    }>;
    followers : OrderedMap.Map<Principal, OrderedSet.Set<Principal>>;
    following : OrderedMap.Map<Principal, OrderedSet.Set<Principal>>;
    blockList : OrderedMap.Map<Principal, OrderedSet.Set<Principal>>;
    notifications : OrderedMap.Map<Principal, [ {
      kind : {
        #follow;
        #like;
        #reply;
        #mention;
        #repost;
      };
      from : Principal;
      postId : ?Nat;
      timestamp : Int;
    } ]>;
    timelines : OrderedMap.Map<Principal, [Nat]>;
    hashtagCounts : OrderedMap.Map<Text, Nat>;
    postLikes : OrderedMap.Map<Nat, OrderedSet.Set<Principal>>;
    nextPostId : Nat;
    nextReportId : Nat;
    nextAuditLogId : Nat;
    nextMessageId : Nat;
    messages : OrderedMap.Map<Text, [{
      id : Nat;
      from : Principal;
      to : Principal;
      content : Text;
      timestamp : Int;
    }]>;
  };

  public func run(old : OldActor) : NewActor {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    {
      userProfiles = old.userProfiles;
      posts = old.posts;
      reports = old.reports;
      auditLogs = old.auditLogs;
      followers = old.followers;
      following = old.following;
      blockList = old.blockList;
      notifications = old.notifications;
      timelines = old.timelines;
      hashtagCounts = old.hashtagCounts;
      postLikes = old.postLikes;
      nextPostId = old.nextPostId;
      nextReportId = old.nextReportId;
      nextAuditLogId = old.nextAuditLogId;
      nextMessageId = 0;
      messages = textMap.empty();
    };
  };
};

