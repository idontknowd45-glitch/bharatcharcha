import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface AuditLog {
    id: bigint;
    action: string;
    target?: Principal;
    performedBy: Principal;
    timestamp: bigint;
    postId?: bigint;
}
export interface Post {
    id: bigint;
    deleted: boolean;
    content: string;
    hashtags: Array<string>;
    originalPostId?: bigint;
    author: Principal;
    mediaIds: Array<string>;
    likes: bigint;
    timestamp: bigint;
    replies: bigint;
    reposts: bigint;
}
export interface Notification {
    from: Principal;
    kind: Variant_repost_like_mention_reply_follow;
    timestamp: bigint;
    postId?: bigint;
}
export interface Message {
    id: bigint;
    to: Principal;
    content: string;
    from: Principal;
    timestamp: bigint;
}
export interface Report {
    id: bigint;
    status: Variant_pending_reviewed_actioned;
    reportedBy: Principal;
    timestamp: bigint;
    reason: string;
    postId: bigint;
}
export interface UserProfile {
    bio: string;
    languagePreference: string;
    username: string;
    displayName: string;
    profilePicture?: string;
    suspended: boolean;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum Variant_pending_reviewed_actioned {
    pending = "pending",
    reviewed = "reviewed",
    actioned = "actioned"
}
export enum Variant_repost_like_mention_reply_follow {
    repost = "repost",
    like = "like",
    mention = "mention",
    reply = "reply",
    follow = "follow"
}
export interface backendInterface {
    addAuditLog(action: string, target: Principal | null, postId: bigint | null): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    blockUser(userToBlock: Principal): Promise<void>;
    createPost(content: string, hashtags: Array<string>, mediaIds: Array<string>, originalPostId: bigint | null): Promise<bigint>;
    deletePost(postId: bigint): Promise<void>;
    followUser(userToFollow: Principal): Promise<void>;
    getAuditLogs(): Promise<Array<AuditLog>>;
    getBlockList(user: Principal): Promise<Array<Principal>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getFollowers(user: Principal): Promise<Array<Principal>>;
    getFollowing(user: Principal): Promise<Array<Principal>>;
    getMessages(withUser: Principal): Promise<Array<Message>>;
    getNotifications(): Promise<Array<Notification>>;
    getPost(postId: bigint): Promise<Post | null>;
    getPostsByAuthor(author: Principal): Promise<Array<Post>>;
    getRecentChats(): Promise<Array<[Principal, bigint]>>;
    getReports(): Promise<Array<Report>>;
    getTimeline(): Promise<Array<Post>>;
    getTrendingHashtags(): Promise<Array<[string, bigint]>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    initializeAccessControl(): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    likePost(postId: bigint): Promise<void>;
    reportPost(postId: bigint, reason: string): Promise<void>;
    requestDataDeletion(): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    sendMessage(to: Principal, content: string): Promise<void>;
    suspendUser(user: Principal): Promise<void>;
    takedownPost(postId: bigint): Promise<void>;
    unblockUser(userToUnblock: Principal): Promise<void>;
    unfollowUser(userToUnfollow: Principal): Promise<void>;
    unlikePost(postId: bigint): Promise<void>;
    unsuspendUser(user: Principal): Promise<void>;
    updateReportStatus(reportId: bigint, status: Variant_pending_reviewed_actioned): Promise<void>;
}
