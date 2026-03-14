import AccessControl "authorization/access-control";
import Principal "mo:base/Principal";
import OrderedMap "mo:base/OrderedMap";
import OrderedSet "mo:base/OrderedSet";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Int "mo:base/Int";
import Array "mo:base/Array";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import Migration "migration";

(with migration = Migration.run)
actor BharatCharcha {
  // Initialize the user system state
  let accessControlState = AccessControl.initState();

  // Initialize auth (first caller becomes admin, others become users)
  public shared ({ caller }) func initializeAccessControl() : async () {
    AccessControl.initialize(accessControlState, caller);
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    // Admin-only check happens inside
    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    AccessControl.isAdmin(accessControlState, caller);
  };

  public type UserProfile = {
    username : Text;
    displayName : Text;
    bio : Text;
    profilePicture : ?Text;
    languagePreference : Text;
    suspended : Bool;
  };

  var userProfiles = OrderedMap.Make<Principal>(Principal.compare).empty<UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view profiles");
    };
    OrderedMap.Make<Principal>(Principal.compare).get(userProfiles, caller);
  };

  // AUTHORIZATION: Public access - any caller including guests can view non-suspended user profiles
  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    // Guard: Validate caller has at least guest permission
    if (not (AccessControl.hasPermission(accessControlState, caller, #guest))) {
      Debug.trap("Unauthorized: Access denied");
    };

    switch (OrderedMap.Make<Principal>(Principal.compare).get(userProfiles, user)) {
      case (?profile) {
        // Guard: Hide suspended user profiles from public view
        if (profile.suspended) {
          null;
        } else {
          ?profile;
        };
      };
      case null null;
    };
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    // Guard: Only authenticated users can save profiles
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can save profiles");
    };

    // Guard: Suspended users cannot update profiles
    switch (OrderedMap.Make<Principal>(Principal.compare).get(userProfiles, caller)) {
      case (?existing) {
        if (existing.suspended) {
          Debug.trap("Unauthorized: Suspended users cannot update profiles");
        };
      };
      case null {};
    };

    userProfiles := OrderedMap.Make<Principal>(Principal.compare).put(userProfiles, caller, profile);
  };

  // Post Types
  public type Post = {
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
  };

  // Notification Types
  public type Notification = {
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
  };

  // Admin Types
  public type Report = {
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
  };

  public type AuditLog = {
    id : Nat;
    action : Text;
    performedBy : Principal;
    target : ?Principal;
    postId : ?Nat;
    timestamp : Int;
  };

  // Message Types
  public type Message = {
    id : Nat;
    from : Principal;
    to : Principal;
    content : Text;
    timestamp : Int;
  };

  // Storage for posts, notifications, reports, and audit logs
  var posts = OrderedMap.Make<Nat>(Nat.compare).empty<Post>();
  var reports = OrderedMap.Make<Nat>(Nat.compare).empty<Report>();
  var auditLogs = OrderedMap.Make<Nat>(Nat.compare).empty<AuditLog>();

  // Storage for followers and block lists
  var followers = OrderedMap.Make<Principal>(Principal.compare).empty<OrderedSet.Set<Principal>>();
  var following = OrderedMap.Make<Principal>(Principal.compare).empty<OrderedSet.Set<Principal>>();
  var blockList = OrderedMap.Make<Principal>(Principal.compare).empty<OrderedSet.Set<Principal>>();

  // Storage for notifications
  var notifications = OrderedMap.Make<Principal>(Principal.compare).empty<[Notification]>();

  // Storage for timelines
  var timelines = OrderedMap.Make<Principal>(Principal.compare).empty<[Nat]>();

  // Storage for trending hashtags
  var hashtagCounts = OrderedMap.Make<Text>(Text.compare).empty<Nat>();

  // Storage for post likes
  var postLikes = OrderedMap.Make<Nat>(Nat.compare).empty<OrderedSet.Set<Principal>>();

  // Storage for post IDs
  var nextPostId = 0;
  var nextReportId = 0;
  var nextAuditLogId = 0;
  var nextMessageId = 0;

  // Storage for media
  let storage = Storage.new();
  include MixinStorage(storage);

  // Storage for messages
  var messages = OrderedMap.Make<Text>(Text.compare).empty<[Message]>();

  // Helper function to check if user is suspended
  private func isUserSuspended(user : Principal) : Bool {
    switch (OrderedMap.Make<Principal>(Principal.compare).get(userProfiles, user)) {
      case (?profile) profile.suspended;
      case null false;
    };
  };

  // Helper function to check if user is blocked
  private func isBlocked(blocker : Principal, blocked : Principal) : Bool {
    switch (OrderedMap.Make<Principal>(Principal.compare).get(blockList, blocker)) {
      case null false;
      case (?blocks) OrderedSet.Make<Principal>(Principal.compare).contains(blocks, blocked);
    };
  };

  // Helper function to check if two users are friends (mutual followers)
  private func areFriends(user1 : Principal, user2 : Principal) : Bool {
    let user1Following = switch (OrderedMap.Make<Principal>(Principal.compare).get(following, user1)) {
      case null OrderedSet.Make<Principal>(Principal.compare).empty();
      case (?existing) existing;
    };
    let user2Following = switch (OrderedMap.Make<Principal>(Principal.compare).get(following, user2)) {
      case null OrderedSet.Make<Principal>(Principal.compare).empty();
      case (?existing) existing;
    };
    OrderedSet.Make<Principal>(Principal.compare).contains(user1Following, user2) and OrderedSet.Make<Principal>(Principal.compare).contains(user2Following, user1);
  };

  // Post Management
  public shared ({ caller }) func createPost(content : Text, hashtags : [Text], mediaIds : [Text], originalPostId : ?Nat) : async Nat {
    // Guard: Only authenticated users can create posts
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can create posts");
    };

    // Guard: Suspended users cannot create posts
    if (isUserSuspended(caller)) {
      Debug.trap("Unauthorized: Suspended users cannot create posts");
    };

    // Guard: If this is a reply or repost, validate original post and check blocks
    switch (originalPostId) {
      case (?origId) {
        switch (OrderedMap.Make<Nat>(Nat.compare).get(posts, origId)) {
          case null Debug.trap("Original post not found");
          case (?origPost) {
            if (origPost.deleted) {
              Debug.trap("Cannot reply to or repost a deleted post");
            };
            if (isBlocked(origPost.author, caller)) {
              Debug.trap("You are blocked by the post author");
            };
          };
        };
      };
      case null {};
    };

    let postId = nextPostId;
    nextPostId += 1;

    let post : Post = {
      id = postId;
      author = caller;
      content;
      timestamp = Time.now();
      hashtags;
      mediaIds;
      likes = 0;
      replies = 0;
      reposts = 0;
      originalPostId;
      deleted = false;
    };

    posts := OrderedMap.Make<Nat>(Nat.compare).put(posts, postId, post);

    // Update hashtag counts
    for (hashtag in hashtags.vals()) {
      let count = switch (OrderedMap.Make<Text>(Text.compare).get(hashtagCounts, hashtag)) {
        case null 1;
        case (?existing) existing + 1;
      };
      hashtagCounts := OrderedMap.Make<Text>(Text.compare).put(hashtagCounts, hashtag, count);
    };

    // Fan-out on write: Update author's own timeline
    let authorTimeline = switch (OrderedMap.Make<Principal>(Principal.compare).get(timelines, caller)) {
      case null [];
      case (?existing) existing;
    };
    let newAuthorTimeline = Array.append([postId], authorTimeline);
    timelines := OrderedMap.Make<Principal>(Principal.compare).put(timelines, caller, newAuthorTimeline);

    // Fan-out on write: Update timelines for all followers
    let authorFollowers = switch (OrderedMap.Make<Principal>(Principal.compare).get(followers, caller)) {
      case null OrderedSet.Make<Principal>(Principal.compare).empty();
      case (?existing) existing;
    };
    for (follower in OrderedSet.Make<Principal>(Principal.compare).vals(authorFollowers)) {
      let followerTimeline = switch (OrderedMap.Make<Principal>(Principal.compare).get(timelines, follower)) {
        case null [];
        case (?existing) existing;
      };
      let newTimeline = Array.append([postId], followerTimeline);
      timelines := OrderedMap.Make<Principal>(Principal.compare).put(timelines, follower, newTimeline);
    };

    // Create notification for original post author if this is a reply or repost
    switch (originalPostId) {
      case (?origId) {
        switch (OrderedMap.Make<Nat>(Nat.compare).get(posts, origId)) {
          case (?origPost) {
            if (origPost.author != caller) {
              let notifKind = if (content.size() > 0) { #reply } else { #repost };
              let notification : Notification = {
                kind = notifKind;
                from = caller;
                postId = ?postId;
                timestamp = Time.now();
              };
              let userNotifications = switch (OrderedMap.Make<Principal>(Principal.compare).get(notifications, origPost.author)) {
                case null [];
                case (?existing) existing;
              };
              let newNotifications = Array.append([notification], userNotifications);
              notifications := OrderedMap.Make<Principal>(Principal.compare).put(notifications, origPost.author, newNotifications);
            };
          };
          case null {};
        };
      };
      case null {};
    };

    postId;
  };

  // AUTHORIZATION: Public access - any caller including guests can view non-deleted posts from non-suspended users
  public query ({ caller }) func getPost(postId : Nat) : async ?Post {
    // Guard: Validate caller has at least guest permission
    if (not (AccessControl.hasPermission(accessControlState, caller, #guest))) {
      Debug.trap("Unauthorized: Access denied");
    };

    switch (OrderedMap.Make<Nat>(Nat.compare).get(posts, postId)) {
      case null null;
      case (?post) {
        // Guard: Hide deleted posts from public view
        if (post.deleted) {
          null;
        } else {
          // Guard: Hide posts from suspended users
          if (isUserSuspended(post.author)) {
            null;
          } else {
            ?post;
          };
        };
      };
    };
  };

  // AUTHORIZATION: Public access - any caller including guests can view posts by non-suspended authors
  public query ({ caller }) func getPostsByAuthor(author : Principal) : async [Post] {
    // Guard: Validate caller has at least guest permission
    if (not (AccessControl.hasPermission(accessControlState, caller, #guest))) {
      Debug.trap("Unauthorized: Access denied");
    };

    // Guard: Hide posts from suspended users
    if (isUserSuspended(author)) {
      return [];
    };

    Iter.toArray(
      Iter.map(
        Iter.filter(
          OrderedMap.Make<Nat>(Nat.compare).entries(posts),
          func((_, post) : (Nat, Post)) : Bool {
            post.author == author and not post.deleted;
          },
        ),
        func((_, post) : (Nat, Post)) : Post { post },
      )
    );
  };

  // AUTHORIZATION: Public access - any caller including guests can view trending hashtags
  public query ({ caller }) func getTrendingHashtags() : async [(Text, Nat)] {
    // Guard: Validate caller has at least guest permission
    if (not (AccessControl.hasPermission(accessControlState, caller, #guest))) {
      Debug.trap("Unauthorized: Access denied");
    };

    Iter.toArray(OrderedMap.Make<Text>(Text.compare).entries(hashtagCounts));
  };

  public shared ({ caller }) func deletePost(postId : Nat) : async () {
    // Guard: Only authenticated users can delete posts
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can delete posts");
    };

    switch (OrderedMap.Make<Nat>(Nat.compare).get(posts, postId)) {
      case null Debug.trap("Post not found");
      case (?post) {
        // Guard: Users can delete their own posts, admins can delete any post
        if (post.author != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Debug.trap("Unauthorized: Can only delete your own posts");
        };

        let updatedPost = {
          post with
          deleted = true;
        };
        posts := OrderedMap.Make<Nat>(Nat.compare).put(posts, postId, updatedPost);

        // Add audit log if admin deleted
        if (AccessControl.isAdmin(accessControlState, caller) and post.author != caller) {
          let auditLogId = nextAuditLogId;
          nextAuditLogId += 1;
          let auditLog : AuditLog = {
            id = auditLogId;
            action = "Post Deleted by Admin";
            performedBy = caller;
            target = ?post.author;
            postId = ?postId;
            timestamp = Time.now();
          };
          auditLogs := OrderedMap.Make<Nat>(Nat.compare).put(auditLogs, auditLogId, auditLog);
        };
      };
    };
  };

  // Like/Unlike functionality
  public shared ({ caller }) func likePost(postId : Nat) : async () {
    // Guard: Only authenticated users can like posts
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can like posts");
    };

    // Guard: Suspended users cannot like posts
    if (isUserSuspended(caller)) {
      Debug.trap("Unauthorized: Suspended users cannot like posts");
    };

    switch (OrderedMap.Make<Nat>(Nat.compare).get(posts, postId)) {
      case null Debug.trap("Post not found");
      case (?post) {
        // Guard: Cannot like deleted posts
        if (post.deleted) {
          Debug.trap("Cannot like a deleted post");
        };

        // Guard: Cannot like posts from suspended users
        if (isUserSuspended(post.author)) {
          Debug.trap("Cannot like posts from suspended users");
        };

        // Guard: Cannot like if blocked by post author
        if (isBlocked(post.author, caller)) {
          Debug.trap("You are blocked by the post author");
        };

        let currentLikes = switch (OrderedMap.Make<Nat>(Nat.compare).get(postLikes, postId)) {
          case null OrderedSet.Make<Principal>(Principal.compare).empty();
          case (?existing) existing;
        };

        // Guard: Cannot like the same post twice
        if (OrderedSet.Make<Principal>(Principal.compare).contains(currentLikes, caller)) {
          Debug.trap("Already liked this post");
        };

        let newLikes = OrderedSet.Make<Principal>(Principal.compare).put(currentLikes, caller);
        postLikes := OrderedMap.Make<Nat>(Nat.compare).put(postLikes, postId, newLikes);

        let updatedPost = {
          post with
          likes = post.likes + 1;
        };
        posts := OrderedMap.Make<Nat>(Nat.compare).put(posts, postId, updatedPost);

        // Create notification for post author
        if (post.author != caller) {
          let notification : Notification = {
            kind = #like;
            from = caller;
            postId = ?postId;
            timestamp = Time.now();
          };
          let userNotifications = switch (OrderedMap.Make<Principal>(Principal.compare).get(notifications, post.author)) {
            case null [];
            case (?existing) existing;
          };
          let newNotifications = Array.append([notification], userNotifications);
          notifications := OrderedMap.Make<Principal>(Principal.compare).put(notifications, post.author, newNotifications);
        };
      };
    };
  };

  public shared ({ caller }) func unlikePost(postId : Nat) : async () {
    // Guard: Only authenticated users can unlike posts
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can unlike posts");
    };

    switch (OrderedMap.Make<Nat>(Nat.compare).get(posts, postId)) {
      case null Debug.trap("Post not found");
      case (?post) {
        let currentLikes = switch (OrderedMap.Make<Nat>(Nat.compare).get(postLikes, postId)) {
          case null OrderedSet.Make<Principal>(Principal.compare).empty();
          case (?existing) existing;
        };

        // Guard: Cannot unlike if not already liked
        if (not OrderedSet.Make<Principal>(Principal.compare).contains(currentLikes, caller)) {
          Debug.trap("Post not liked");
        };

        let newLikes = OrderedSet.Make<Principal>(Principal.compare).delete(currentLikes, caller);
        postLikes := OrderedMap.Make<Nat>(Nat.compare).put(postLikes, postId, newLikes);

        let updatedPost = {
          post with
          likes = if (post.likes > 0) { post.likes - 1 : Nat } else { 0 };
        };
        posts := OrderedMap.Make<Nat>(Nat.compare).put(posts, postId, updatedPost);
      };
    };
  };

  // Follow/Unfollow
  public shared ({ caller }) func followUser(userToFollow : Principal) : async () {
    // Guard: Only authenticated users can follow others
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can follow others");
    };

    // Guard: Suspended users cannot follow others
    if (isUserSuspended(caller)) {
      Debug.trap("Unauthorized: Suspended users cannot follow others");
    };

    // Guard: Cannot follow yourself
    if (caller == userToFollow) {
      Debug.trap("Cannot follow yourself");
    };

    // Guard: Cannot follow suspended users
    if (isUserSuspended(userToFollow)) {
      Debug.trap("Cannot follow suspended users");
    };

    // Guard: Cannot follow if blocked by target user
    if (isBlocked(userToFollow, caller)) {
      Debug.trap("You are blocked by this user");
    };

    // Update following
    let currentFollowing = switch (OrderedMap.Make<Principal>(Principal.compare).get(following, caller)) {
      case null OrderedSet.Make<Principal>(Principal.compare).empty();
      case (?existing) existing;
    };

    // Guard: Cannot follow if already following
    if (OrderedSet.Make<Principal>(Principal.compare).contains(currentFollowing, userToFollow)) {
      Debug.trap("Already following this user");
    };

    let newFollowing = OrderedSet.Make<Principal>(Principal.compare).put(currentFollowing, userToFollow);
    following := OrderedMap.Make<Principal>(Principal.compare).put(following, caller, newFollowing);

    // Update followers
    let userFollowers = switch (OrderedMap.Make<Principal>(Principal.compare).get(followers, userToFollow)) {
      case null OrderedSet.Make<Principal>(Principal.compare).empty();
      case (?existing) existing;
    };
    let newFollowers = OrderedSet.Make<Principal>(Principal.compare).put(userFollowers, caller);
    followers := OrderedMap.Make<Principal>(Principal.compare).put(followers, userToFollow, newFollowers);

    // Create notification
    let notification : Notification = {
      kind = #follow;
      from = caller;
      postId = null;
      timestamp = Time.now();
    };
    let userNotifications = switch (OrderedMap.Make<Principal>(Principal.compare).get(notifications, userToFollow)) {
      case null [];
      case (?existing) existing;
    };
    let newNotifications = Array.append([notification], userNotifications);
    notifications := OrderedMap.Make<Principal>(Principal.compare).put(notifications, userToFollow, newNotifications);
  };

  public shared ({ caller }) func unfollowUser(userToUnfollow : Principal) : async () {
    // Guard: Only authenticated users can unfollow others
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can unfollow others");
    };

    // Guard: Cannot unfollow yourself
    if (caller == userToUnfollow) {
      Debug.trap("Cannot unfollow yourself");
    };

    // Update following
    let currentFollowing = switch (OrderedMap.Make<Principal>(Principal.compare).get(following, caller)) {
      case null OrderedSet.Make<Principal>(Principal.compare).empty();
      case (?existing) existing;
    };
    let newFollowing = OrderedSet.Make<Principal>(Principal.compare).delete(currentFollowing, userToUnfollow);
    following := OrderedMap.Make<Principal>(Principal.compare).put(following, caller, newFollowing);

    // Update followers
    let userFollowers = switch (OrderedMap.Make<Principal>(Principal.compare).get(followers, userToUnfollow)) {
      case null OrderedSet.Make<Principal>(Principal.compare).empty();
      case (?existing) existing;
    };
    let newFollowers = OrderedSet.Make<Principal>(Principal.compare).delete(userFollowers, caller);
    followers := OrderedMap.Make<Principal>(Principal.compare).put(followers, userToUnfollow, newFollowers);
  };

  // AUTHORIZATION: Public access - any caller including guests can view followers list
  // FUTURE: Add privacy settings to allow users to hide their followers list
  public query ({ caller }) func getFollowers(user : Principal) : async [Principal] {
    // Guard: Validate caller has at least guest permission
    if (not (AccessControl.hasPermission(accessControlState, caller, #guest))) {
      Debug.trap("Unauthorized: Access denied");
    };

    // Guard (FUTURE): Check if user has private followers list setting
    // if (hasPrivateFollowersList(user) and caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
    //   Debug.trap("Unauthorized: This user's followers list is private");
    // };

    switch (OrderedMap.Make<Principal>(Principal.compare).get(followers, user)) {
      case null [];
      case (?existing) Iter.toArray(OrderedSet.Make<Principal>(Principal.compare).vals(existing));
    };
  };

  // AUTHORIZATION: Public access - any caller including guests can view following list
  // FUTURE: Add privacy settings to allow users to hide their following list
  public query ({ caller }) func getFollowing(user : Principal) : async [Principal] {
    // Guard: Validate caller has at least guest permission
    if (not (AccessControl.hasPermission(accessControlState, caller, #guest))) {
      Debug.trap("Unauthorized: Access denied");
    };

    // Guard (FUTURE): Check if user has private following list setting
    // if (hasPrivateFollowingList(user) and caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
    //   Debug.trap("Unauthorized: This user's following list is private");
    // };

    switch (OrderedMap.Make<Principal>(Principal.compare).get(following, user)) {
      case null [];
      case (?existing) Iter.toArray(OrderedSet.Make<Principal>(Principal.compare).vals(existing));
    };
  };

  // Block List Management
  public shared ({ caller }) func blockUser(userToBlock : Principal) : async () {
    // Guard: Only authenticated users can block others
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can block others");
    };

    // Guard: Cannot block yourself
    if (caller == userToBlock) {
      Debug.trap("Cannot block yourself");
    };

    let currentBlockList = switch (OrderedMap.Make<Principal>(Principal.compare).get(blockList, caller)) {
      case null OrderedSet.Make<Principal>(Principal.compare).empty();
      case (?existing) existing;
    };
    let newBlockList = OrderedSet.Make<Principal>(Principal.compare).put(currentBlockList, userToBlock);
    blockList := OrderedMap.Make<Principal>(Principal.compare).put(blockList, caller, newBlockList);

    // Auto-unfollow if following
    let currentFollowing = switch (OrderedMap.Make<Principal>(Principal.compare).get(following, caller)) {
      case null OrderedSet.Make<Principal>(Principal.compare).empty();
      case (?existing) existing;
    };
    if (OrderedSet.Make<Principal>(Principal.compare).contains(currentFollowing, userToBlock)) {
      let newFollowing = OrderedSet.Make<Principal>(Principal.compare).delete(currentFollowing, userToBlock);
      following := OrderedMap.Make<Principal>(Principal.compare).put(following, caller, newFollowing);

      let userFollowers = switch (OrderedMap.Make<Principal>(Principal.compare).get(followers, userToBlock)) {
        case null OrderedSet.Make<Principal>(Principal.compare).empty();
        case (?existing) existing;
      };
      let newFollowers = OrderedSet.Make<Principal>(Principal.compare).delete(userFollowers, caller);
      followers := OrderedMap.Make<Principal>(Principal.compare).put(followers, userToBlock, newFollowers);
    };
  };

  public shared ({ caller }) func unblockUser(userToUnblock : Principal) : async () {
    // Guard: Only authenticated users can unblock others
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can unblock others");
    };

    // Guard: Cannot unblock yourself
    if (caller == userToUnblock) {
      Debug.trap("Cannot unblock yourself");
    };

    let currentBlockList = switch (OrderedMap.Make<Principal>(Principal.compare).get(blockList, caller)) {
      case null OrderedSet.Make<Principal>(Principal.compare).empty();
      case (?existing) existing;
    };
    let newBlockList = OrderedSet.Make<Principal>(Principal.compare).delete(currentBlockList, userToUnblock);
    blockList := OrderedMap.Make<Principal>(Principal.compare).put(blockList, caller, newBlockList);
  };

  // AUTHORIZATION: Private access - only owner or admin can view block list
  public query ({ caller }) func getBlockList(user : Principal) : async [Principal] {
    // Guard: Only owner or admin can view block list (privacy-sensitive)
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Debug.trap("Unauthorized: Can only view your own block list");
    };

    switch (OrderedMap.Make<Principal>(Principal.compare).get(blockList, user)) {
      case null [];
      case (?existing) Iter.toArray(OrderedSet.Make<Principal>(Principal.compare).vals(existing));
    };
  };

  // Notifications
  public query ({ caller }) func getNotifications() : async [Notification] {
    // Guard: Only authenticated users can view their notifications
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view notifications");
    };

    switch (OrderedMap.Make<Principal>(Principal.compare).get(notifications, caller)) {
      case null [];
      case (?existing) existing;
    };
  };

  // Admin Functions
  public shared ({ caller }) func reportPost(postId : Nat, reason : Text) : async () {
    // Guard: Only authenticated users can report posts
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can report posts");
    };

    // Verify post exists and is not deleted
    switch (OrderedMap.Make<Nat>(Nat.compare).get(posts, postId)) {
      case null Debug.trap("Post not found");
      case (?post) {
        if (post.deleted) {
          Debug.trap("Cannot report a deleted post");
        };
      };
    };

    let reportId = nextReportId;
    nextReportId += 1;

    let report : Report = {
      id = reportId;
      reportedBy = caller;
      postId;
      reason;
      timestamp = Time.now();
      status = #pending;
    };

    reports := OrderedMap.Make<Nat>(Nat.compare).put(reports, reportId, report);
  };

  public query ({ caller }) func getReports() : async [Report] {
    // Guard: Only admins can view reports
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can view reports");
    };

    Iter.toArray(
      Iter.map(
        OrderedMap.Make<Nat>(Nat.compare).entries(reports),
        func((_, report) : (Nat, Report)) : Report { report },
      )
    );
  };

  public shared ({ caller }) func updateReportStatus(reportId : Nat, status : { #pending; #reviewed; #actioned }) : async () {
    // Guard: Only admins can update report status
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can update report status");
    };

    switch (OrderedMap.Make<Nat>(Nat.compare).get(reports, reportId)) {
      case null Debug.trap("Report not found");
      case (?report) {
        let updatedReport = {
          report with
          status;
        };
        reports := OrderedMap.Make<Nat>(Nat.compare).put(reports, reportId, updatedReport);

        // Add audit log
        let auditLogId = nextAuditLogId;
        nextAuditLogId += 1;
        let auditLog : AuditLog = {
          id = auditLogId;
          action = "Report Status Updated";
          performedBy = caller;
          target = null;
          postId = ?report.postId;
          timestamp = Time.now();
        };
        auditLogs := OrderedMap.Make<Nat>(Nat.compare).put(auditLogs, auditLogId, auditLog);
      };
    };
  };

  public shared ({ caller }) func takedownPost(postId : Nat) : async () {
    // Guard: Only admins can takedown posts
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can takedown posts");
    };

    switch (OrderedMap.Make<Nat>(Nat.compare).get(posts, postId)) {
      case null Debug.trap("Post not found");
      case (?post) {
        let updatedPost = {
          post with
          deleted = true;
        };
        posts := OrderedMap.Make<Nat>(Nat.compare).put(posts, postId, updatedPost);

        // Add audit log
        let auditLogId = nextAuditLogId;
        nextAuditLogId += 1;
        let auditLog : AuditLog = {
          id = auditLogId;
          action = "Post Takedown";
          performedBy = caller;
          target = ?post.author;
          postId = ?postId;
          timestamp = Time.now();
        };
        auditLogs := OrderedMap.Make<Nat>(Nat.compare).put(auditLogs, auditLogId, auditLog);
      };
    };
  };

  public shared ({ caller }) func suspendUser(user : Principal) : async () {
    // Guard: Only admins can suspend users
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can suspend users");
    };

    // Guard: Cannot suspend yourself
    if (caller == user) {
      Debug.trap("Cannot suspend yourself");
    };

    switch (OrderedMap.Make<Principal>(Principal.compare).get(userProfiles, user)) {
      case null Debug.trap("User profile not found");
      case (?profile) {
        let updatedProfile = {
          profile with
          suspended = true;
        };
        userProfiles := OrderedMap.Make<Principal>(Principal.compare).put(userProfiles, user, updatedProfile);

        // Add audit log
        let auditLogId = nextAuditLogId;
        nextAuditLogId += 1;
        let auditLog : AuditLog = {
          id = auditLogId;
          action = "User Suspended";
          performedBy = caller;
          target = ?user;
          postId = null;
          timestamp = Time.now();
        };
        auditLogs := OrderedMap.Make<Nat>(Nat.compare).put(auditLogs, auditLogId, auditLog);
      };
    };
  };

  public shared ({ caller }) func unsuspendUser(user : Principal) : async () {
    // Guard: Only admins can unsuspend users
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can unsuspend users");
    };

    switch (OrderedMap.Make<Principal>(Principal.compare).get(userProfiles, user)) {
      case null Debug.trap("User profile not found");
      case (?profile) {
        let updatedProfile = {
          profile with
          suspended = false;
        };
        userProfiles := OrderedMap.Make<Principal>(Principal.compare).put(userProfiles, user, updatedProfile);

        // Add audit log
        let auditLogId = nextAuditLogId;
        nextAuditLogId += 1;
        let auditLog : AuditLog = {
          id = auditLogId;
          action = "User Unsuspended";
          performedBy = caller;
          target = ?user;
          postId = null;
          timestamp = Time.now();
        };
        auditLogs := OrderedMap.Make<Nat>(Nat.compare).put(auditLogs, auditLogId, auditLog);
      };
    };
  };

  public shared ({ caller }) func addAuditLog(action : Text, target : ?Principal, postId : ?Nat) : async () {
    // Guard: Only admins can add audit logs
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can add audit logs");
    };

    let auditLogId = nextAuditLogId;
    nextAuditLogId += 1;

    let auditLog : AuditLog = {
      id = auditLogId;
      action;
      performedBy = caller;
      target;
      postId;
      timestamp = Time.now();
    };

    auditLogs := OrderedMap.Make<Nat>(Nat.compare).put(auditLogs, auditLogId, auditLog);
  };

  public query ({ caller }) func getAuditLogs() : async [AuditLog] {
    // Guard: Only admins can view audit logs
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Debug.trap("Unauthorized: Only admins can view audit logs");
    };

    Iter.toArray(
      Iter.map(
        OrderedMap.Make<Nat>(Nat.compare).entries(auditLogs),
        func((_, log) : (Nat, AuditLog)) : AuditLog { log },
      )
    );
  };

  // Timeline Management
  public query ({ caller }) func getTimeline() : async [Post] {
    // Guard: Only authenticated users can view their timeline
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view timeline");
    };

    switch (OrderedMap.Make<Principal>(Principal.compare).get(timelines, caller)) {
      case null [];
      case (?postIds) {
        var timelinePosts : [Post] = [];
        for (postId in postIds.vals()) {
          switch (OrderedMap.Make<Nat>(Nat.compare).get(posts, postId)) {
            case (?post) {
              // Guard: Filter out deleted posts and posts from suspended users
              if (not post.deleted and not isUserSuspended(post.author)) {
                timelinePosts := Array.append(timelinePosts, [post]);
              };
            };
            case null {};
          };
        };
        timelinePosts;
      };
    };
  };

  // Data Deletion Request
  public shared ({ caller }) func requestDataDeletion() : async () {
    // Guard: Only authenticated users can request data deletion
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can request data deletion");
    };

    let auditLogId = nextAuditLogId;
    nextAuditLogId += 1;

    let auditLog : AuditLog = {
      id = auditLogId;
      action = "Data Deletion Request";
      performedBy = caller;
      target = ?caller;
      postId = null;
      timestamp = Time.now();
    };

    auditLogs := OrderedMap.Make<Nat>(Nat.compare).put(auditLogs, auditLogId, auditLog);
  };

  // Messaging Functions
  public shared ({ caller }) func sendMessage(to : Principal, content : Text) : async () {
    // Guard: Only authenticated users can send messages
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can send messages");
    };

    // Guard: Suspended users cannot send messages
    if (isUserSuspended(caller)) {
      Debug.trap("Unauthorized: Suspended users cannot send messages");
    };

    // Guard: Cannot send messages to yourself
    if (caller == to) {
      Debug.trap("Cannot send messages to yourself");
    };

    // Guard: Cannot send messages to suspended users
    if (isUserSuspended(to)) {
      Debug.trap("Cannot send messages to suspended users");
    };

    // Guard: Cannot send messages if blocked by recipient
    if (isBlocked(to, caller)) {
      Debug.trap("You are blocked by this user");
    };

    // Guard: Can only send messages to friends (mutual followers)
    if (not areFriends(caller, to)) {
      Debug.trap("Can only send messages to users in your friend list");
    };

    let messageId = nextMessageId;
    nextMessageId += 1;

    let message : Message = {
      id = messageId;
      from = caller;
      to;
      content;
      timestamp = Time.now();
    };

    let conversationKey1 = Principal.toText(caller) # "-" # Principal.toText(to);
    let conversationKey2 = Principal.toText(to) # "-" # Principal.toText(caller);

    // Update sender's message thread
    let senderMessages = switch (OrderedMap.Make<Text>(Text.compare).get(messages, conversationKey1)) {
      case null [];
      case (?existing) existing;
    };
    let newSenderMessages = Array.append(senderMessages, [message]);
    messages := OrderedMap.Make<Text>(Text.compare).put(messages, conversationKey1, newSenderMessages);

    // Update recipient's message thread
    let recipientMessages = switch (OrderedMap.Make<Text>(Text.compare).get(messages, conversationKey2)) {
      case null [];
      case (?existing) existing;
    };
    let newRecipientMessages = Array.append(recipientMessages, [message]);
    messages := OrderedMap.Make<Text>(Text.compare).put(messages, conversationKey2, newRecipientMessages);
  };

  public query ({ caller }) func getMessages(withUser : Principal) : async [Message] {
    // Guard: Only authenticated users can view messages
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view messages");
    };

    // Guard: Suspended users cannot view messages
    if (isUserSuspended(caller)) {
      Debug.trap("Unauthorized: Suspended users cannot view messages");
    };

    // Guard: Can only view messages with friends (mutual followers)
    if (not areFriends(caller, withUser)) {
      Debug.trap("Can only view messages with users in your friend list");
    };

    let conversationKey = Principal.toText(caller) # "-" # Principal.toText(withUser);
    switch (OrderedMap.Make<Text>(Text.compare).get(messages, conversationKey)) {
      case null [];
      case (?existing) existing;
    };
  };

  public query ({ caller }) func getRecentChats() : async [(Principal, Int)] {
    // Guard: Only authenticated users can view recent chats
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Debug.trap("Unauthorized: Only users can view recent chats");
    };

    // Guard: Suspended users cannot view recent chats
    if (isUserSuspended(caller)) {
      Debug.trap("Unauthorized: Suspended users cannot view recent chats");
    };

    let userFollowing = switch (OrderedMap.Make<Principal>(Principal.compare).get(following, caller)) {
      case null OrderedSet.Make<Principal>(Principal.compare).empty();
      case (?existing) existing;
    };

    var recentChats : [(Principal, Int)] = [];

    for (friend in OrderedSet.Make<Principal>(Principal.compare).vals(userFollowing)) {
      if (areFriends(caller, friend)) {
        let conversationKey = Principal.toText(caller) # "-" # Principal.toText(friend);
        switch (OrderedMap.Make<Text>(Text.compare).get(messages, conversationKey)) {
          case (?msgs) {
            if (msgs.size() > 0) {
              let lastMsg = msgs[msgs.size() - 1 : Nat];
              recentChats := Array.append(recentChats, [(friend, lastMsg.timestamp)]);
            };
          };
          case null {};
        };
      };
    };

    // Sort by timestamp descending
    Array.sort(
      recentChats,
      func(a : (Principal, Int), b : (Principal, Int)) : { #less; #equal; #greater } {
        if (a.1 > b.1) { #less } else if (a.1 < b.1) { #greater } else { #equal };
      },
    );
  };
};

