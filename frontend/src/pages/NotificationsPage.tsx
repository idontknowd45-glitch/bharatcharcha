import { memo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGetNotifications, useGetUserProfile } from '../hooks/useQueries';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, UserPlus, Repeat2, AtSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Notification } from '../backend';

const NotificationItem = memo(({ notification }: { notification: Notification }) => {
  const navigate = useNavigate();
  const { data: fromProfile } = useGetUserProfile(notification.from);
  const timestamp = new Date(Number(notification.timestamp) / 1000000);

  const getIcon = useCallback(() => {
    switch (notification.kind) {
      case 'follow':
        return <UserPlus className="h-5 w-5 text-primary" />;
      case 'like':
        return <Heart className="h-5 w-5 text-destructive" />;
      case 'reply':
        return <MessageCircle className="h-5 w-5 text-accent" />;
      case 'repost':
        return <Repeat2 className="h-5 w-5 text-secondary" />;
      case 'mention':
        return <AtSign className="h-5 w-5 text-primary" />;
    }
  }, [notification.kind]);

  const getMessage = useCallback(() => {
    const username = fromProfile?.username || 'Someone';
    switch (notification.kind) {
      case 'follow':
        return `${username} started following you`;
      case 'like':
        return `${username} liked your post`;
      case 'reply':
        return `${username} replied to your post`;
      case 'repost':
        return `${username} reposted your post`;
      case 'mention':
        return `${username} mentioned you in a post`;
    }
  }, [notification.kind, fromProfile?.username]);

  const handleProfileClick = useCallback(() => {
    if (fromProfile?.username) {
      navigate({ to: '/$username', params: { username: fromProfile.username } });
    }
  }, [fromProfile?.username, navigate]);

  return (
    <Card className="notification-card-animate">
      <CardContent className="pt-6">
        <div className="flex gap-3">
          <div className="flex-shrink-0 notification-icon-animate">{getIcon()}</div>

          <button onClick={handleProfileClick} className="flex-shrink-0 avatar-hover">
            <Avatar>
              <AvatarImage src={fromProfile?.profilePicture || '/assets/generated/default-avatar.dim_100x100.png'} />
              <AvatarFallback>{fromProfile?.displayName?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
          </button>

          <div className="flex-1">
            <p className="font-medium">{getMessage()}</p>
            <p className="text-sm text-muted-foreground">{formatDistanceToNow(timestamp, { addSuffix: true })}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

NotificationItem.displayName = 'NotificationItem';

function NotificationsPage() {
  const { data: notifications, isLoading } = useGetNotifications();

  return (
    <div className="container py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="page-header-animate">
          <h1 className="text-3xl font-bold mb-2">Notifications</h1>
          <p className="text-muted-foreground">Stay updated with your latest interactions</p>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground">Loading notifications...</p>
        ) : notifications && notifications.length > 0 ? (
          <div className="space-y-4 notifications-container">
            {notifications.map((notification, index) => (
              <NotificationItem key={index} notification={notification} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 empty-state-animate">
            <img
              src="/assets/generated/notification-icon.dim_32x32.png"
              alt="No notifications"
              className="h-24 mx-auto opacity-50 mb-4"
            />
            <p className="text-muted-foreground">No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(NotificationsPage);
