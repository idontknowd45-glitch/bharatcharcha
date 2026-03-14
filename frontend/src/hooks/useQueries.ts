import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useActor } from './useActor';
import { UserProfile, Post, Notification, Report, AuditLog, Variant_pending_reviewed_actioned, Message } from '../backend';
import { Principal } from '@icp-sdk/core/principal';

// User Profile Queries
export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useGetUserProfile(principal?: Principal) {
  const { actor, isFetching } = useActor();

  return useQuery<UserProfile | null>({
    queryKey: ['userProfile', principal?.toString()],
    queryFn: async () => {
      if (!actor || !principal) return null;
      return actor.getUserProfile(principal);
    },
    enabled: !!actor && !isFetching && !!principal,
  });
}

export function useGetUserProfileByUsername(username: string) {
  const { actor, isFetching } = useActor();

  return useQuery<{ principal: Principal; username: string; displayName: string; bio: string; profilePicture: string | null; suspended: boolean } | null>({
    queryKey: ['userProfileByUsername', username],
    queryFn: async () => {
      if (!actor) return null;
      // This is a workaround since backend doesn't have getUserByUsername
      // In a real app, you'd need to add this to the backend
      return null;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not available');
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    },
  });
}

// Post Queries with polling
export function useGetTimeline() {
  const { actor, isFetching } = useActor();

  return useQuery<Post[]>({
    queryKey: ['timeline'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTimeline();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 3000, // Poll every 3 seconds for live updates
    refetchIntervalInBackground: false,
  });
}

export function useGetPost(postId: bigint) {
  const { actor, isFetching } = useActor();

  return useQuery<Post | null>({
    queryKey: ['post', postId.toString()],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getPost(postId);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetPostsByAuthor(author?: Principal) {
  const { actor, isFetching } = useActor();

  return useQuery<Post[]>({
    queryKey: ['postsByAuthor', author?.toString()],
    queryFn: async () => {
      if (!actor || !author) return [];
      return actor.getPostsByAuthor(author);
    },
    enabled: !!actor && !isFetching && !!author,
  });
}

// Optimistic post creation
export function useCreatePost() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { content: string; hashtags: string[]; mediaIds: string[]; originalPostId: bigint | null }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createPost(params.content, params.hashtags, params.mediaIds, params.originalPostId);
    },
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['timeline'] });

      // Snapshot previous value
      const previousTimeline = queryClient.getQueryData<Post[]>(['timeline']);

      // Get current user identity for optimistic post
      const identity = queryClient.getQueryData<any>(['identity']);
      
      // Create optimistic post
      const optimisticPost: Post = {
        id: BigInt(Date.now()), // Temporary ID
        author: identity?.principal || Principal.anonymous(),
        content: params.content,
        timestamp: BigInt(Date.now() * 1000000),
        hashtags: params.hashtags,
        mediaIds: params.mediaIds,
        likes: BigInt(0),
        replies: BigInt(0),
        reposts: BigInt(0),
        originalPostId: params.originalPostId || undefined,
        deleted: false,
      };

      // Optimistically update timeline
      queryClient.setQueryData<Post[]>(['timeline'], (old) => {
        return [optimisticPost, ...(old || [])];
      });

      return { previousTimeline, optimisticPost };
    },
    onError: (err, params, context) => {
      // Rollback on error
      if (context?.previousTimeline) {
        queryClient.setQueryData(['timeline'], context.previousTimeline);
      }
    },
    onSuccess: (newPostId, params, context) => {
      // Replace optimistic post with real post
      queryClient.setQueryData<Post[]>(['timeline'], (old) => {
        if (!old) return old;
        return old.map(post => 
          post.id === context?.optimisticPost.id 
            ? { ...context.optimisticPost, id: newPostId }
            : post
        );
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['postsByAuthor'] });
      queryClient.invalidateQueries({ queryKey: ['trendingHashtags'] });
    },
  });
}

export function useDeletePost() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      return actor.deletePost(postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['postsByAuthor'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
    },
  });
}

// Optimistic like/unlike
export function useLikePost() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      return actor.likePost(postId);
    },
    onMutate: async (postId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['timeline'] });
      await queryClient.cancelQueries({ queryKey: ['post', postId.toString()] });

      // Snapshot previous values
      const previousTimeline = queryClient.getQueryData<Post[]>(['timeline']);
      const previousPost = queryClient.getQueryData<Post | null>(['post', postId.toString()]);

      // Optimistically update timeline
      queryClient.setQueryData<Post[]>(['timeline'], (old) => {
        if (!old) return old;
        return old.map(post => 
          post.id === postId 
            ? { ...post, likes: post.likes + BigInt(1) }
            : post
        );
      });

      // Optimistically update individual post
      queryClient.setQueryData<Post | null>(['post', postId.toString()], (old) => {
        if (!old) return old;
        return { ...old, likes: old.likes + BigInt(1) };
      });

      return { previousTimeline, previousPost };
    },
    onError: (err, postId, context) => {
      // Rollback on error
      if (context?.previousTimeline) {
        queryClient.setQueryData(['timeline'], context.previousTimeline);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(['post', postId.toString()], context.previousPost);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: ['postsByAuthor'] });
    },
  });
}

export function useUnlikePost() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      return actor.unlikePost(postId);
    },
    onMutate: async (postId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['timeline'] });
      await queryClient.cancelQueries({ queryKey: ['post', postId.toString()] });

      // Snapshot previous values
      const previousTimeline = queryClient.getQueryData<Post[]>(['timeline']);
      const previousPost = queryClient.getQueryData<Post | null>(['post', postId.toString()]);

      // Optimistically update timeline
      queryClient.setQueryData<Post[]>(['timeline'], (old) => {
        if (!old) return old;
        return old.map(post => 
          post.id === postId 
            ? { ...post, likes: post.likes > BigInt(0) ? post.likes - BigInt(1) : BigInt(0) }
            : post
        );
      });

      // Optimistically update individual post
      queryClient.setQueryData<Post | null>(['post', postId.toString()], (old) => {
        if (!old) return old;
        return { ...old, likes: old.likes > BigInt(0) ? old.likes - BigInt(1) : BigInt(0) };
      });

      return { previousTimeline, previousPost };
    },
    onError: (err, postId, context) => {
      // Rollback on error
      if (context?.previousTimeline) {
        queryClient.setQueryData(['timeline'], context.previousTimeline);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(['post', postId.toString()], context.previousPost);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: ['postsByAuthor'] });
    },
  });
}

// Follow/Unfollow
export function useFollowUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userToFollow: Principal) => {
      if (!actor) throw new Error('Actor not available');
      return actor.followUser(userToFollow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

export function useUnfollowUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userToUnfollow: Principal) => {
      if (!actor) throw new Error('Actor not available');
      return actor.unfollowUser(userToUnfollow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

export function useGetFollowers(user?: Principal) {
  const { actor, isFetching } = useActor();

  return useQuery<Principal[]>({
    queryKey: ['followers', user?.toString()],
    queryFn: async () => {
      if (!actor || !user) return [];
      return actor.getFollowers(user);
    },
    enabled: !!actor && !isFetching && !!user,
  });
}

export function useGetFollowing(user?: Principal) {
  const { actor, isFetching } = useActor();

  return useQuery<Principal[]>({
    queryKey: ['following', user?.toString()],
    queryFn: async () => {
      if (!actor || !user) return [];
      return actor.getFollowing(user);
    },
    enabled: !!actor && !isFetching && !!user,
  });
}

// Block/Unblock
export function useBlockUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userToBlock: Principal) => {
      if (!actor) throw new Error('Actor not available');
      return actor.blockUser(userToBlock);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockList'] });
    },
  });
}

export function useUnblockUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userToUnblock: Principal) => {
      if (!actor) throw new Error('Actor not available');
      return actor.unblockUser(userToUnblock);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockList'] });
    },
  });
}

// Trending Hashtags
export function useGetTrendingHashtags() {
  const { actor, isFetching } = useActor();

  return useQuery<[string, bigint][]>({
    queryKey: ['trendingHashtags'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTrendingHashtags();
    },
    enabled: !!actor && !isFetching,
  });
}

// Notifications
export function useGetNotifications() {
  const { actor, isFetching } = useActor();

  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getNotifications();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5000, // Poll every 5 seconds for notifications
    refetchIntervalInBackground: false,
  });
}

// Messaging Functions
export function useGetRecentChats() {
  const { actor, isFetching } = useActor();

  return useQuery<[Principal, bigint][]>({
    queryKey: ['recentChats'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getRecentChats();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 2000, // Poll every 2 seconds for message updates
    refetchIntervalInBackground: false,
  });
}

export function useGetMessages(withUser: Principal | null) {
  const { actor, isFetching } = useActor();

  return useQuery<Message[]>({
    queryKey: ['messages', withUser?.toString()],
    queryFn: async () => {
      if (!actor || !withUser) return [];
      return actor.getMessages(withUser);
    },
    enabled: !!actor && !isFetching && !!withUser,
    refetchInterval: 2000, // Poll every 2 seconds for message updates
    refetchIntervalInBackground: false,
  });
}

export function useSendMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { to: Principal; content: string }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.sendMessage(params.to, params.content);
    },
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', params.to.toString()] });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<Message[]>(['messages', params.to.toString()]);

      // Get current user identity for optimistic message
      const identity = queryClient.getQueryData<any>(['identity']);
      
      // Create optimistic message
      const optimisticMessage: Message = {
        id: BigInt(Date.now()), // Temporary ID
        from: identity?.principal || Principal.anonymous(),
        to: params.to,
        content: params.content,
        timestamp: BigInt(Date.now() * 1000000),
      };

      // Optimistically update messages
      queryClient.setQueryData<Message[]>(['messages', params.to.toString()], (old) => {
        return [...(old || []), optimisticMessage];
      });

      return { previousMessages, optimisticMessage };
    },
    onError: (err, params, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', params.to.toString()], context.previousMessages);
      }
    },
    onSettled: (data, error, params) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['messages', params.to.toString()] });
      queryClient.invalidateQueries({ queryKey: ['recentChats'] });
    },
  });
}

// Admin Functions
export function useIsCallerAdmin() {
  const { actor, isFetching } = useActor();

  return useQuery<boolean>({
    queryKey: ['isAdmin'],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetReports() {
  const { actor, isFetching } = useActor();

  return useQuery<Report[]>({
    queryKey: ['reports'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getReports();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetAuditLogs() {
  const { actor, isFetching } = useActor();

  return useQuery<AuditLog[]>({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAuditLogs();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useReportPost() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { postId: bigint; reason: string }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.reportPost(params.postId, params.reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useUpdateReportStatus() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { reportId: bigint; status: Variant_pending_reviewed_actioned }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateReportStatus(params.reportId, params.status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

export function useTakedownPost() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      return actor.takedownPost(postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: ['postsByAuthor'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

export function useSuspendUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (user: Principal) => {
      if (!actor) throw new Error('Actor not available');
      return actor.suspendUser(user);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

export function useUnsuspendUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (user: Principal) => {
      if (!actor) throw new Error('Actor not available');
      return actor.unsuspendUser(user);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

export function useRequestDataDeletion() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.requestDataDeletion();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}
